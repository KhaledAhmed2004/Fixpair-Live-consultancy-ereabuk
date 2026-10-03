"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAgoraToken = void 0;
const agora_token_1 = require("agora-token");
const config_1 = __importDefault(require("../config"));
const ApiError_1 = __importDefault(require("../errors/ApiError"));
const http_status_codes_1 = require("http-status-codes");
const generateAgoraToken = (channelName, uid = 0, role = 'publisher') => {
    var _a, _b;
    const appId = (_a = config_1.default.agora.appId) === null || _a === void 0 ? void 0 : _a.trim();
    const appCertificate = (_b = config_1.default.agora.appCertificate) === null || _b === void 0 ? void 0 : _b.trim();
    if (!appId || !appCertificate) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Agora App ID or Certificate not configured');
    }
    const expirationTimeInSeconds = config_1.default.agora.expirationTime || 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
    // Map string role to Agora RtcRole
    const agoraRole = role === 'subscriber' ? agora_token_1.RtcRole.SUBSCRIBER : agora_token_1.RtcRole.PUBLISHER;
    const token = agora_token_1.RtcTokenBuilder.buildTokenWithUid(appId, appCertificate, channelName, uid, agoraRole, privilegeExpiredTs, privilegeExpiredTs);
    return token;
};
exports.generateAgoraToken = generateAgoraToken;
