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
exports.TranscriptionController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const transcription_service_1 = require("./transcription.service");
const startTranscription = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const consultationId = req.params.consultationId || req.body.consultationId;
    if (!consultationId) {
        return (0, sendResponse_1.default)(res, {
            success: false,
            statusCode: http_status_codes_1.StatusCodes.BAD_REQUEST,
            message: 'consultationId is required',
        });
    }
    const result = yield transcription_service_1.TranscriptionService.startTranscription(consultationId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Transcription started successfully',
        data: result,
    });
}));
const stopTranscription = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const consultationId = req.params.consultationId || req.body.consultationId;
    if (!consultationId) {
        return (0, sendResponse_1.default)(res, {
            success: false,
            statusCode: http_status_codes_1.StatusCodes.BAD_REQUEST,
            message: 'consultationId is required',
        });
    }
    yield transcription_service_1.TranscriptionService.stopTranscription(consultationId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Transcription stopped successfully',
    });
}));
const getTranscriptHistory = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const consultationId = req.params.consultationId || req.query.consultationId;
    if (!consultationId) {
        return (0, sendResponse_1.default)(res, {
            success: false,
            statusCode: http_status_codes_1.StatusCodes.BAD_REQUEST,
            message: 'consultationId is required',
        });
    }
    const result = yield transcription_service_1.TranscriptionService.getTranscriptHistory(consultationId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Transcript history retrieved successfully',
        data: result,
    });
}));
const ingestTranscript = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const consultationId = req.params.consultationId;
    const { uid, text, isFinal, timestamp } = req.body;
    if (!consultationId ||
        uid === undefined ||
        !text ||
        timestamp === undefined) {
        return (0, sendResponse_1.default)(res, {
            success: false,
            statusCode: http_status_codes_1.StatusCodes.BAD_REQUEST,
            message: 'uid, text and timestamp are required',
        });
    }
    yield transcription_service_1.TranscriptionService.ingestTranscriptChunk(req.user, consultationId, {
        uid: Number(uid),
        text: String(text),
        isFinal: Boolean(isFinal),
        timestamp,
    });
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Transcript chunk received',
    });
}));
exports.TranscriptionController = {
    startTranscription,
    stopTranscription,
    getTranscriptHistory,
    ingestTranscript,
};
