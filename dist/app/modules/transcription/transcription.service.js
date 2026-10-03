"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranscriptionService = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const consultation_model_1 = require("../consultation/consultation.model");
const videoSession_model_1 = require("../videoSession/videoSession.model");
const agoraSttHelper_1 = require("../../../helpers/agoraSttHelper");
const transcription_model_1 = require("./transcription.model");
const socketHelper_1 = require("../../../helpers/socketHelper");
const agoraTokenHelper_1 = require("../../../helpers/agoraTokenHelper");
const startTranscription = (consultationId) => __awaiter(void 0, void 0, void 0, function* () {
    const consultation = yield consultation_model_1.Consultation.findById(consultationId);
    if (!consultation) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Consultation not found');
    }
    const session = yield videoSession_model_1.VideoSession.findOne({ consultation: consultationId });
    if (!session) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Video session not found');
    }
    // Idempotency: if already running (e.g. auto-started by joinSession and
    // frontend also calls /start), skip creating a second agent.
    if (['starting', 'active'].includes(session.transcriptionStatus) && session.sttTaskId) {
        return { agentId: session.sttTaskId };
    }
    // Single API call in Agora STT v7.x — no separate "acquire" step.
    const sttToken = (0, agoraTokenHelper_1.generateAgoraToken)(session.channelName, 9001);
    const agentId = yield agoraSttHelper_1.AgoraSttHelper.startTranscription(session.channelName, sttToken);
    const finalAgentId = agentId || session.sttTaskId || 'ACTIVE_AGENT';
    yield videoSession_model_1.VideoSession.findByIdAndUpdate(session._id, {
        $set: {
            sttTaskId: finalAgentId,
            transcriptionStatus: 'active',
        },
    });
    return { agentId: finalAgentId };
});
const stopTranscription = (consultationId) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield videoSession_model_1.VideoSession.findOne({ consultation: consultationId });
    if (!session || !session.sttTaskId) {
        // Mark as stopped even if no agent was started
        if (session) {
            yield videoSession_model_1.VideoSession.findByIdAndUpdate(session._id, {
                $set: { transcriptionStatus: 'stopped' },
            });
        }
        return;
    }
    try {
        // 1. Stop transcription
        yield agoraSttHelper_1.AgoraSttHelper.stopTranscription(session.sttTaskId);
    }
    catch (e) {
        console.error('Failed to stop Agora STT:', e);
    }
    // 2. Update session
    yield videoSession_model_1.VideoSession.findByIdAndUpdate(session._id, {
        $set: {
            transcriptionStatus: 'stopped',
        },
    });
});
/**
 * The Agora STT bot (UID 9001) publishes recognized text as RTC data-stream
 * messages inside the channel — only clients connected to that channel can
 * receive them, Agora does not push results to the backend over HTTP. A
 * participant's client relays each chunk it receives here so the backend can
 * persist finalized transcripts and re-broadcast them (e.g. to a web dashboard
 * that isn't joined to the RTC channel) over Socket.IO.
 *
 * channelName/consultation are derived from the session — never trusted from
 * the client — so a participant cannot write transcripts into a consultation
 * they aren't part of.
 */
const ingestTranscriptChunk = (user, consultationId, chunk) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield videoSession_model_1.VideoSession.findOne({ consultation: consultationId });
    if (!session) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Video session not found');
    }
    if (session.user.toString() !== user.id &&
        session.consultant.toString() !== user.id) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You are not part of this session');
    }
    // Grace period check: allow ingestion during ongoing, starting, active, or within 60s of stopping
    const allowedTranscriptionStatuses = ['starting', 'active', 'stopping'];
    const isSessionOngoing = session.status === 'ongoing';
    const isTranscriptionInProgress = allowedTranscriptionStatuses.includes(session.transcriptionStatus);
    // If session ended recently, check 60s grace period via session.endedAt
    const isWithinGrace = session.endedAt
        ? Date.now() - session.endedAt.getTime() < 60000
        : false;
    if (!isSessionOngoing && !isTranscriptionInProgress && !isWithinGrace) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'Transcript ingestion is no longer active for this session');
    }
    const { uid, text, isFinal, timestamp } = chunk;
    // Only the known speaker UIDs (client=1001, consultant=2001) are valid —
    // the STT bot (9001) never appears as a "speaker" in recognize results.
    if (uid !== 1001 && uid !== 2001) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Unrecognized speaker uid');
    }
    const speakerRole = uid === 1001 ? 'user' : 'consultant';
    const chunkTimestamp = new Date(timestamp);
    const socketPayload = {
        consultationId: session.consultation.toString(),
        speakerUid: uid,
        speakerRole,
        text,
        isFinal,
        timestamp: chunkTimestamp,
    };
    // 1. Live captions: broadcast every chunk (interim + final) to the
    // consultation room so both participants receive it regardless of socket
    // reconnections (room-based, not fragile userId→socketId map lookups).
    socketHelper_1.socketHelper.emitToRoom(`consultation:${session.consultation.toString()}`, 'transcript:new', socketPayload);
    // 2. History: persist only finalized chunks. Both participants receive and
    // relay the same data-stream message, so de-dupe on the natural key before
    // writing to avoid double entries in the saved transcript.
    if (isFinal) {
        const exists = yield transcription_model_1.Transcript.findOne({
            consultation: session.consultation,
            speakerUid: uid,
            text,
            timestamp: chunkTimestamp,
        });
        if (!exists) {
            if (session.transcriptionStatus === 'starting') {
                yield videoSession_model_1.VideoSession.findByIdAndUpdate(session._id, {
                    $set: { transcriptionStatus: 'active' },
                });
            }
            yield transcription_model_1.Transcript.create({
                consultation: session.consultation,
                channelName: session.channelName,
                speakerUid: uid,
                speakerRole,
                text,
                isFinal,
                timestamp: chunkTimestamp,
            });
        }
    }
});
const getTranscriptHistory = (consultationId) => __awaiter(void 0, void 0, void 0, function* () {
    return yield transcription_model_1.Transcript.find({ consultation: consultationId }).sort({
        timestamp: 1,
    });
});
exports.TranscriptionService = {
    startTranscription,
    stopTranscription,
    ingestTranscriptChunk,
    getTranscriptHistory,
};
