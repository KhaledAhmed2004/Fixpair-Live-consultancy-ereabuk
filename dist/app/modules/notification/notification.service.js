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
exports.NotificationService = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const notification_model_1 = require("./notification.model");
const socketHelper_1 = require("../../../helpers/socketHelper");
const notificationHelper_1 = require("../../../helpers/notification/notificationHelper");
const user_model_1 = require("../user/user.model");
const logger_1 = require("../../../shared/logger");
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
/**
 * Send a notification to a user (In-app + Push)
 */
const sendNotification = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 0. Idempotency Check
        if (payload.idempotencyKey) {
            const existingNotification = yield notification_model_1.Notification.findOne({
                idempotencyKey: payload.idempotencyKey,
            });
            if (existingNotification) {
                logger_1.logger.info(`Duplicate notification blocked: ${payload.idempotencyKey}`);
                return existingNotification;
            }
        }
        // 1. Save to Database
        const notification = yield notification_model_1.Notification.create(Object.assign(Object.assign({}, payload), { read: false }));
        // 2. Real-time In-app notification via Socket.io
        socketHelper_1.socketHelper.emitToUser(payload.user, 'notification', notification);
        // 3. Push Notification via FCM
        const targetUser = yield user_model_1.User.findById(payload.user);
        if (targetUser && targetUser.fcmTokens && targetUser.fcmTokens.length > 0) {
            const fcmData = Object.assign({ title: payload.title, body: payload.message, type: payload.type, relatedBooking: payload.relatedBooking || '' }, Object.entries(payload.metadata || {}).reduce((acc, [key, val]) => (Object.assign(Object.assign({}, acc), { [key]: String(val) })), {}));
            const pushResponse = yield notificationHelper_1.NotificationHelper.sendPushNotification(targetUser.fcmTokens, fcmData);
            // Handle invalid tokens
            if (pushResponse && pushResponse.responses) {
                const invalidTokens = [];
                pushResponse.responses.forEach((resp, idx) => {
                    if (!resp.success && resp.error) {
                        const error = resp.error;
                        if (error.code === 'messaging/invalid-registration-token' ||
                            error.code === 'messaging/registration-token-not-registered') {
                            invalidTokens.push(targetUser.fcmTokens[idx]);
                        }
                    }
                });
                if (invalidTokens.length > 0) {
                    yield user_model_1.User.findByIdAndUpdate(payload.user, {
                        $pull: { fcmTokens: { $in: invalidTokens } },
                    });
                    logger_1.logger.info(`Removed ${invalidTokens.length} invalid FCM tokens for user ${payload.user}`);
                }
            }
        }
        return notification;
    }
    catch (error) {
        // Handle race condition where two notifications with same idempotencyKey are created simultaneously
        if (error.code === 11000 && payload.idempotencyKey) {
            logger_1.logger.info(`Duplicate notification blocked via unique index: ${payload.idempotencyKey}`);
            return yield notification_model_1.Notification.findOne({
                idempotencyKey: payload.idempotencyKey,
            });
        }
        logger_1.logger.error('Error in sendNotification:', error);
        // Do not throw error to avoid crashing the main flow
        return null;
    }
});
const getMyNotifications = (user, query) => __awaiter(void 0, void 0, void 0, function* () {
    const notificationQuery = new QueryBuilder_1.default(notification_model_1.Notification.find({ user: user.id }), query)
        .search(['title', 'message'])
        .filter()
        .sort()
        .paginate()
        .fields();
    const result = yield notificationQuery.modelQuery;
    const meta = yield notificationQuery.getPaginationInfo();
    return { result, meta };
});
const markAsRead = (user, notificationId) => __awaiter(void 0, void 0, void 0, function* () {
    const notification = yield notification_model_1.Notification.findOneAndUpdate({ _id: notificationId, user: user.id }, { read: true }, { new: true });
    if (!notification) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Notification not found');
    }
    return notification;
});
const markAllAsRead = (user) => __awaiter(void 0, void 0, void 0, function* () {
    yield notification_model_1.Notification.updateMany({ user: user.id, read: false }, { read: true });
    return { message: 'All notifications marked as read' };
});
const getUnreadCount = (user) => __awaiter(void 0, void 0, void 0, function* () {
    const count = yield notification_model_1.Notification.countDocuments({
        user: user.id,
        read: false,
    });
    return { count };
});
const notifyAdmins = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const admins = yield user_model_1.User.find({ role: { $in: ['ADMIN', 'SUPER_ADMIN'] } }).select('_id');
        const promises = admins.map(admin => sendNotification(Object.assign(Object.assign({}, payload), { user: admin._id.toString() })));
        yield Promise.allSettled(promises);
    }
    catch (error) {
        logger_1.logger.error('Error in notifyAdmins:', error);
    }
});
exports.NotificationService = {
    sendNotification,
    notifyAdmins,
    getMyNotifications,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
};
