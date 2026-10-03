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
exports.VideoSessionService = void 0;
/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
/* eslint-disable no-undef */
const http_status_codes_1 = require("http-status-codes");
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../../../config"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const consultation_model_1 = require("../consultation/consultation.model");
const videoSession_model_1 = require("./videoSession.model");
const agoraTokenHelper_1 = require("../../../helpers/agoraTokenHelper");
const notification_service_1 = require("../notification/notification.service");
const createSession = (user, consultationId) => __awaiter(void 0, void 0, void 0, function* () {
    const consultation = yield consultation_model_1.Consultation.findById(consultationId);
    if (!consultation) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Consultation not found');
    }
    // Verify that the user is part of the consultation
    if (consultation.user.toString() !== user.id &&
        consultation.consultant.toString() !== user.id) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You are not part of this consultation');
    }
    const ALLOWED_STATUSES = ['pending', 'confirmed', 'accepted'];
    if (!ALLOWED_STATUSES.includes(consultation.status)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Cannot create a video session for a consultation with status: ${consultation.status}`);
    }
    // Check if a session already exists for this consultation
    const existingSession = yield videoSession_model_1.VideoSession.findOne({
        consultation: consultationId,
    });
    if (existingSession) {
        if (existingSession.status === 'ended') {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'This consultation session has already ended');
        }
        return existingSession;
    }
    const channelName = `consultation_${consultationId}`;
    // User UID: 1001, Consultant UID: 2001 as per requirement
    const uid = user.role === 'USER' ? 1001 : 2001;
    const token = (0, agoraTokenHelper_1.generateAgoraToken)(channelName, uid);
    const sessionData = {
        consultation: new mongoose_1.default.Types.ObjectId(consultationId),
        user: consultation.user,
        consultant: consultation.consultant,
        channelName,
        token,
        status: 'pending',
    };
    const result = yield videoSession_model_1.VideoSession.create(sessionData);
    // --- Real-time Signaling ---
    const recipientId = user.role === 'USER'
        ? consultation.consultant.toString()
        : consultation.user.toString();
    const recipient = yield user_model_1.User.findById(recipientId);
    if (!recipient)
        return Object.assign(Object.assign({}, result.toObject()), { uid });
    // Fetch consultant details for the FCM payload
    const consultantDetails = yield user_model_1.User.findById(consultation.consultant);
    const consultantName = (consultantDetails === null || consultantDetails === void 0 ? void 0 : consultantDetails.name) || 'Consultant';
    let consultantAvatar = (consultantDetails === null || consultantDetails === void 0 ? void 0 : consultantDetails.image) || (consultantDetails === null || consultantDetails === void 0 ? void 0 : consultantDetails.avatar) || '';
    if (consultantAvatar && !consultantAvatar.startsWith('http')) {
        // Convert relative path to full URL
        const baseUrl = process.env.BASE_URL || 'https://nayem5000.binarybards.online';
        consultantAvatar = `${baseUrl}${consultantAvatar.startsWith('/') ? '' : '/'}${consultantAvatar}`;
    }
    // Generate a token specifically for the recipient
    const recipientUid = recipient.role === 'USER' ? 1001 : 2001;
    const recipientToken = (0, agoraTokenHelper_1.generateAgoraToken)(channelName, recipientUid);
    const signalingData = {
        sessionId: result._id.toString(),
        callerName: user.name || 'A user',
        callerAvatar: user.image || user.avatar || '',
        appId: config_1.default.agora.appId,
        token: recipientToken, // Send the recipient's specific token
        channelName: result.channelName,
        bookingId: consultationId,
        consultantName: consultantName,
        consultantAvatar: consultantAvatar,
    };
    // 1. Real-time signaling via Socket.io (for Desktop Web / Active clients)
    socketHelper_1.socketHelper.emitToUser(recipientId, 'incoming-call', Object.assign(Object.assign({}, signalingData), { uid: recipientUid }));
    // 2. Push Notification via FCM (for Mobile and Desktop WebPush)
    if (recipient.fcmTokens && recipient.fcmTokens.length > 0) {
        yield notificationHelper_1.NotificationHelper.sendPushNotification(recipient.fcmTokens, Object.assign(Object.assign({ type: 'INCOMING_CALL' }, signalingData), { uid: String(recipientUid) })).catch(err => console.error('FCM Error in session creation:', err));
    }
    return Object.assign(Object.assign({}, result.toObject()), { uid });
});
const billing_service_1 = require("../payment/billing.service");
const invoice_service_1 = require("../payment/invoice.service");
const notificationHelper_1 = require("../../../helpers/notification/notificationHelper");
const socketHelper_1 = require("../../../helpers/socketHelper");
const user_model_1 = require("../user/user.model");
const transcription_service_1 = require("../transcription/transcription.service");
const report_service_1 = require("../report/report.service");
const joinSession = (user, sessionId) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield videoSession_model_1.VideoSession.findById(sessionId);
    if (!session) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Video session not found');
    }
    if (session.status === 'ended') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'This session has already ended');
    }
    const consultation = yield consultation_model_1.Consultation.findById(session.consultation);
    // Verify that the user is part of the session
    if (session.user.toString() !== user.id &&
        session.consultant.toString() !== user.id) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You are not part of this session');
    }
    const uid = user.role === 'USER' ? 1001 : 2001;
    if (session.status === 'pending') {
        // Atomic update to prevent race conditions when both users join simultaneously
        const updatedSession = yield videoSession_model_1.VideoSession.findOneAndUpdate({ _id: sessionId, status: 'pending' }, { status: 'ongoing', startedAt: new Date() }, { new: true });
        if (updatedSession) {
            // 1. Trigger billing first (this includes the 5-minute pre-auth check)
            try {
                yield billing_service_1.BillingService.startBilling(session.consultation.toString());
                yield mongoose_1.default.model('Consultation').updateOne({ _id: session.consultation }, { status: 'ongoing' });
            }
            catch (error) {
                // If billing fails, revert status so it can be retried
                yield videoSession_model_1.VideoSession.updateOne({ _id: sessionId }, { status: 'pending', startedAt: null });
                throw error;
            }
            // 2. Start Transcription
            transcription_service_1.TranscriptionService.startTranscription(session.consultation.toString())
                .catch((sttError) => __awaiter(void 0, void 0, void 0, function* () {
                console.error('STT startup failed:', sttError);
                yield videoSession_model_1.VideoSession.findByIdAndUpdate(sessionId, {
                    $set: { transcriptionStatus: 'failed' },
                });
                socketHelper_1.socketHelper.emitToUser(user.id, 'transcription-failed', {
                    sessionId,
                    consultationId: session.consultation.toString(),
                    message: 'Transcription could not be started. Billing continues normally.',
                });
            }));
        }
    }
    // Generate a fresh token for this specific user/UID
    const token = (0, agoraTokenHelper_1.generateAgoraToken)(session.channelName, uid);
    const freshSession = yield videoSession_model_1.VideoSession.findById(sessionId);
    return Object.assign(Object.assign({}, freshSession.toObject()), { token, // Return the fresh token instead of the one in DB
        uid, appId: config_1.default.agora.appId });
});
const endSession = (user, sessionId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const session = yield videoSession_model_1.VideoSession.findById(sessionId);
    if (!session) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Video session not found');
    }
    if (session.status === 'ended') {
        return yield videoSession_model_1.VideoSession.findById(sessionId);
    }
    // Verify that the user is part of the session
    if (session.user.toString() !== user.id &&
        session.consultant.toString() !== user.id) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You are not authorized to end this session');
    }
    const endedAt = new Date();
    const duration = session.startedAt
        ? Math.floor((endedAt.getTime() - session.startedAt.getTime()) / 1000)
        : 0;
    yield videoSession_model_1.VideoSession.findByIdAndUpdate(sessionId, {
        status: 'ended',
        endedAt,
        duration,
        transcriptionStatus: 'stopping',
    });
    // Stop transcription
    try {
        yield transcription_service_1.TranscriptionService.stopTranscription(session.consultation.toString());
    }
    catch (err) {
        console.error('Failed to stop transcription:', err);
    }
    // Stop billing and generate invoice
    yield billing_service_1.BillingService.stopBilling(session.consultation.toString());
    yield invoice_service_1.InvoiceService.finalizeInvoice(session.consultation.toString());
    const updatedConsultation = yield consultation_model_1.Consultation.findById(session.consultation).populate('user consultant');
    if (updatedConsultation) {
        const client = ((_a = updatedConsultation.user) === null || _a === void 0 ? void 0 : _a.name) || 'Client';
        const consultant = ((_b = updatedConsultation.consultant) === null || _b === void 0 ? void 0 : _b.name) || 'Consultant';
        const finalAmount = updatedConsultation.consumedAmount || 0;
        let finalDurationMins = 0;
        if (updatedConsultation.perMinuteRate > 0) {
            const fee = updatedConsultation.platformFee || 0;
            if (finalAmount >= fee) {
                finalDurationMins = Math.round((finalAmount - fee) / updatedConsultation.perMinuteRate);
            }
        }
        else {
            finalDurationMins = Math.max(1, Math.round(duration / 60)); // minimum 1 min if fallback
        }
        yield notification_service_1.NotificationService.notifyAdmins({
            title: 'Consultation Completed',
            message: `Session ended between ${client} and ${consultant}. Duration: ${finalDurationMins} mins, Amount Generated: $${finalAmount}.`,
            type: 'CONSULTATION_STATUS',
            relatedBooking: updatedConsultation._id.toString(),
            metadata: {
                clientName: client,
                consultantName: consultant,
                durationMinutes: finalDurationMins,
                amount: finalAmount,
            }
        });
    }
    // 4. Asynchronously generate AI consultation summary with Gemini
    report_service_1.ReportService.generateOrGetAiSummary(session.consultation.toString()).catch((err) => {
        console.error(`Failed to generate AI summary for consultation ${session.consultation}:`, err);
    });
    // Notify the other participant and the room that the session has ended
    const recipientId = user.id === session.user.toString()
        ? session.consultant.toString()
        : session.user.toString();
    socketHelper_1.socketHelper.emitToUser(recipientId, 'call-ended', {
        sessionId,
        consultationId: session.consultation.toString(),
        bookingId: session.consultation.toString(),
        endedBy: user.id,
    });
    socketHelper_1.socketHelper.emitToRoom(`consultation:${session.consultation}`, 'call-ended', {
        sessionId,
        consultationId: session.consultation.toString(),
        bookingId: session.consultation.toString(),
        endedBy: user.id,
    });
    return yield videoSession_model_1.VideoSession.findById(sessionId);
});
const getMySessions = (user, query) => __awaiter(void 0, void 0, void 0, function* () {
    const filter = {};
    if (user.role === 'USER') {
        filter.user = user.id;
    }
    else if (user.role === 'CONSULTANT') {
        filter.consultant = user.id;
    }
    const sessionQuery = new QueryBuilder_1.default(videoSession_model_1.VideoSession.find(filter), query)
        .filter()
        .sort()
        .paginate()
        .fields();
    const result = yield sessionQuery.modelQuery.populate([
        { path: 'user', select: 'name image avatar' },
        { path: 'consultant', select: 'name image avatar' },
        { path: 'consultation' },
    ]);
    const meta = yield sessionQuery.getPaginationInfo();
    return { meta, result };
});
const handleCallAction = (user, sessionId, action) => __awaiter(void 0, void 0, void 0, function* () {
    if (action === 'END') {
        return yield endSession(user, sessionId);
    }
    const session = yield videoSession_model_1.VideoSession.findById(sessionId);
    if (!session) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Session not found');
    }
    const recipientId = user.id === session.user.toString()
        ? session.consultant.toString()
        : session.user.toString();
    const recipient = yield user_model_1.User.findById(recipientId);
    if (action === 'REJECT') {
        // Recipient rejected the call
        const endedAt = new Date();
        yield videoSession_model_1.VideoSession.findByIdAndUpdate(sessionId, {
            status: 'ended',
            endedAt,
            duration: 0,
        });
        yield consultation_model_1.Consultation.findByIdAndUpdate(session.consultation, {
            status: 'cancelled',
            terminationReason: 'manual',
            cancelledAt: endedAt,
        });
        // Notify the caller via user socket & room
        socketHelper_1.socketHelper.emitToUser(recipientId, 'call-rejected', {
            sessionId,
            consultationId: session.consultation.toString(),
            bookingId: session.consultation.toString(),
        });
        socketHelper_1.socketHelper.emitToRoom(`consultation:${session.consultation}`, 'call-rejected', {
            sessionId,
            consultationId: session.consultation.toString(),
            bookingId: session.consultation.toString(),
        });
        if ((recipient === null || recipient === void 0 ? void 0 : recipient.fcmTokens) && recipient.fcmTokens.length > 0) {
            yield notificationHelper_1.NotificationHelper.sendPushNotification(recipient.fcmTokens, {
                type: 'CALL_REJECTED',
                sessionId,
                consultationId: session.consultation.toString(),
            }).catch((err) => console.error('FCM Error in REJECT:', err));
        }
    }
    else if (action === 'CANCEL') {
        // Caller cancelled the call
        const endedAt = new Date();
        yield videoSession_model_1.VideoSession.findByIdAndUpdate(sessionId, {
            status: 'ended',
            endedAt,
            duration: 0,
        });
        yield consultation_model_1.Consultation.findByIdAndUpdate(session.consultation, {
            status: 'cancelled',
            terminationReason: 'manual',
            cancelledAt: endedAt,
        });
        // Notify the recipient via user socket & room
        socketHelper_1.socketHelper.emitToUser(recipientId, 'call-cancelled', {
            sessionId,
            consultationId: session.consultation.toString(),
            bookingId: session.consultation.toString(),
        });
        socketHelper_1.socketHelper.emitToRoom(`consultation:${session.consultation}`, 'call-cancelled', {
            sessionId,
            consultationId: session.consultation.toString(),
            bookingId: session.consultation.toString(),
        });
        if ((recipient === null || recipient === void 0 ? void 0 : recipient.fcmTokens) && recipient.fcmTokens.length > 0) {
            yield notificationHelper_1.NotificationHelper.sendPushNotification(recipient.fcmTokens, {
                type: 'CALL_CANCELLED',
                sessionId,
                consultationId: session.consultation.toString(),
            }).catch((err) => console.error('FCM Error in CANCEL:', err));
        }
    }
    return { success: true };
});
exports.VideoSessionService = {
    createSession,
    joinSession,
    endSession,
    getMySessions,
    handleCallAction,
};
