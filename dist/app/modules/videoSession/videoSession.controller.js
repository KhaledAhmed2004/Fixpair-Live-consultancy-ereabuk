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
exports.VideoSessionController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const videoSession_service_1 = require("./videoSession.service");
const createSession = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { consultationId } = req.body;
    const result = yield videoSession_service_1.VideoSessionService.createSession(user, consultationId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        message: 'Video session created successfully',
        data: result,
    });
}));
const joinSession = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { sessionId } = req.body;
    const result = yield videoSession_service_1.VideoSessionService.joinSession(user, sessionId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Joined video session successfully',
        data: result,
    });
}));
const endSession = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { sessionId } = req.body;
    const result = yield videoSession_service_1.VideoSessionService.endSession(user, sessionId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Video session ended successfully',
        data: result,
    });
}));
const getMySessions = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield videoSession_service_1.VideoSessionService.getMySessions(user, req.query);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Video sessions retrieved successfully',
        pagination: result.meta,
        data: result.result,
    });
}));
const handleCallAction = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { sessionId, action } = req.body;
    const result = yield videoSession_service_1.VideoSessionService.handleCallAction(user, sessionId, action);
    const actionMsg = action === 'REJECT'
        ? 'Call rejected successfully'
        : action === 'CANCEL'
            ? 'Call cancelled successfully'
            : 'Video session ended successfully';
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: actionMsg,
        data: result,
    });
}));
exports.VideoSessionController = {
    createSession,
    joinSession,
    endSession,
    getMySessions,
    handleCallAction,
};
