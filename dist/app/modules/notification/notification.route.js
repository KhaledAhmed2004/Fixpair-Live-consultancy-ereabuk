"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const notification_controller_1 = require("./notification.controller");
const router = express_1.default.Router();
router.get('/', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), notification_controller_1.NotificationController.getMyNotifications);
router.get('/unread-count', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), notification_controller_1.NotificationController.getUnreadCount);
router.patch('/mark-all-read', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), notification_controller_1.NotificationController.markAllAsRead);
router.patch('/:id', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), notification_controller_1.NotificationController.markAsRead);
exports.NotificationRoutes = router;
