"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoSessionRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const videoSession_controller_1 = require("./videoSession.controller");
const videoSession_validation_1 = require("./videoSession.validation");
const router = express_1.default.Router();
router.post('/create', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT), (0, validateRequest_1.default)(videoSession_validation_1.VideoSessionValidation.createSessionZodSchema), videoSession_controller_1.VideoSessionController.createSession);
router.get('/', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), videoSession_controller_1.VideoSessionController.getMySessions);
router.post('/join', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT), (0, validateRequest_1.default)(videoSession_validation_1.VideoSessionValidation.joinSessionZodSchema), videoSession_controller_1.VideoSessionController.joinSession);
router.post('/end', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT), (0, validateRequest_1.default)(videoSession_validation_1.VideoSessionValidation.endSessionZodSchema), videoSession_controller_1.VideoSessionController.endSession);
router.post('/action', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT), (0, validateRequest_1.default)(videoSession_validation_1.VideoSessionValidation.callActionZodSchema), videoSession_controller_1.VideoSessionController.handleCallAction);
exports.VideoSessionRoutes = router;
