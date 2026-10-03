"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranscriptionRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const transcription_controller_1 = require("./transcription.controller");
const router = express_1.default.Router();
// Start transcription
router.post('/start', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN), transcription_controller_1.TranscriptionController.startTranscription);
router.post('/:consultationId/start', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN), transcription_controller_1.TranscriptionController.startTranscription);
// Stop transcription
router.post('/stop', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN), transcription_controller_1.TranscriptionController.stopTranscription);
router.post('/:consultationId/stop', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN), transcription_controller_1.TranscriptionController.stopTranscription);
// Get history
router.get('/history', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN), transcription_controller_1.TranscriptionController.getTranscriptHistory);
router.get('/:consultationId/history', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN), transcription_controller_1.TranscriptionController.getTranscriptHistory);
// Live caption relay: the STT bot (UID 9001) publishes recognized text as an
// RTC data-stream message inside the channel, which only connected clients can
// receive. A participant's client forwards each chunk here so the backend can
// persist finalized transcripts and re-broadcast them (e.g. to a web dashboard
// that isn't joined to the RTC channel) over Socket.IO.
router.post('/:consultationId/ingest', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN), transcription_controller_1.TranscriptionController.ingestTranscript);
exports.TranscriptionRoutes = router;
