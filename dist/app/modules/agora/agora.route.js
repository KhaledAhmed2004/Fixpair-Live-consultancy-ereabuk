"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgoraRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const agora_controller_1 = require("./agora.controller");
const router = express_1.default.Router();
router.get('/token', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN), agora_controller_1.AgoraController.getToken);
exports.AgoraRoutes = router;
