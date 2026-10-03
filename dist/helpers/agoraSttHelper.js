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
exports.AgoraSttHelper = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-undef */
const axios_1 = __importDefault(require("axios"));
const config_1 = __importDefault(require("../config"));
const ApiError_1 = __importDefault(require("../errors/ApiError"));
const http_status_codes_1 = require("http-status-codes");
const logger_1 = require("../shared/logger");
// Agora Real-Time STT REST API v7.x
// Old path (/v1/projects/{appId}/rt-transcription/...) was removed by Agora.
const AGORA_STT_BASE_URL = 'https://api.agora.io/api/speech-to-text/v1/projects';
const getBasicAuth = () => {
    var _a, _b;
    const customerId = (_a = config_1.default.agora.customerId) === null || _a === void 0 ? void 0 : _a.trim();
    const customerSecret = (_b = config_1.default.agora.customerSecret) === null || _b === void 0 ? void 0 : _b.trim();
    if (!customerId || !customerSecret) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Agora Customer ID or Secret not configured');
    }
    const credentials = Buffer.from(`${customerId}:${customerSecret}`).toString('base64');
    return `Basic ${credentials}`;
};
/**
 * Start an Agora Real-Time STT agent in the channel.
 * Single API call — no separate "acquire" step in v7.x.
 * Returns the agent_id used for subsequent stop calls.
 */
const startTranscription = (channelName, botToken) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    const appId = (_a = config_1.default.agora.appId) === null || _a === void 0 ? void 0 : _a.trim();
    if (!appId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Agora App ID not configured');
    }
    try {
        // Sanity-check the token before sending — an empty/undefined token means
        // the STT agent will be rejected by Agora and UID 9001 never joins.
        const tokenStatus = !botToken
            ? 'MISSING'
            : botToken.length < 20
                ? `SUSPICIOUSLY_SHORT(${botToken.length})`
                : `OK(len=${botToken.length})`;
        logger_1.logger.info(`Agora STT agent starting | appId=${appId} channel=${channelName} botToken=${tokenStatus} subscribeUids=1001,2001`);
        const response = yield axios_1.default.post(`${AGORA_STT_BASE_URL}/${appId}/join`, {
            name: `stt-${channelName}`,
            languages: ['en-US'],
            maxIdleTime: 50,
            rtcConfig: {
                channelName,
                subBotUid: '9001',
                subBotToken: botToken,
                pubBotUid: '9001',
                pubBotToken: botToken,
                // Push captions as gzip-compressed JSON (not Protobuf) so clients can
                // TextDecoder + JSON.parse. Agora default is Protobuf.
                enableJsonProtocol: true,
            },
        }, {
            headers: { Authorization: getBasicAuth() },
        });
        const agentId = response.data.agent_id;
        logger_1.logger.info(`Agora STT agent started | appId=${appId} channel=${channelName} agentId=${agentId} status=${response.data.status}`);
        return agentId;
    }
    catch (error) {
        const status = (_b = error.response) === null || _b === void 0 ? void 0 : _b.status;
        const errorMessage = ((_d = (_c = error.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.message) || error.message;
        // 409 Conflict means an STT agent is already active in this channel (e.g. started by joinSession)
        if (status === 409 || status === http_status_codes_1.StatusCodes.CONFLICT) {
            logger_1.logger.info(`Agora STT agent already active in channel (409 Conflict) | appId=${appId} channel=${channelName}`);
            return ((_f = (_e = error.response) === null || _e === void 0 ? void 0 : _e.data) === null || _f === void 0 ? void 0 : _f.agent_id) || 'ALREADY_ACTIVE';
        }
        logger_1.errorLogger.error(`Agora STT start failed | appId=${appId} channel=${channelName} status=${status} message=${errorMessage}`);
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, `Agora Start Error: ${errorMessage}`);
    }
});
/**
 * Stop a running Agora STT agent by its agent_id.
 */
const stopTranscription = (agentId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const appId = (_a = config_1.default.agora.appId) === null || _a === void 0 ? void 0 : _a.trim();
    try {
        yield axios_1.default.post(`${AGORA_STT_BASE_URL}/${appId}/agents/${agentId}/leave`, {}, {
            headers: { Authorization: getBasicAuth() },
        });
        logger_1.logger.info(`Agora STT agent stopped | appId=${appId} agentId=${agentId}`);
    }
    catch (error) {
        // Non-fatal — agent may have already exited on its own (maxIdleTime).
        logger_1.errorLogger.error(`Agora STT stop failed | appId=${appId} agentId=${agentId} message=${((_c = (_b = error.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.message) || error.message}`);
    }
});
exports.AgoraSttHelper = { startTranscription, stopTranscription };
