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
exports.NotificationHelper = void 0;
/* eslint-disable no-console */
/* eslint-disable no-undef */
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const config_1 = __importDefault(require("../../config"));
const logger_1 = require("../../shared/logger");
let isFcmInitialized = false;
try {
    if (firebase_admin_1.default.apps.length === 0) {
        if (config_1.default.fcm.serviceAccountBase64) {
            // Decoded service account from base64 string in .env
            const decodedServiceAccount = Buffer.from(config_1.default.fcm.serviceAccountBase64, 'base64').toString('utf-8');
            const serviceAccount = JSON.parse(decodedServiceAccount);
            firebase_admin_1.default.initializeApp({
                credential: firebase_admin_1.default.credential.cert(serviceAccount),
            });
            isFcmInitialized = true;
            logger_1.logger.info('✓ Firebase Admin initialized successfully');
        }
        else {
            logger_1.logger.warn('! Firebase Service Account Base64 is missing in .env (FCM_SERVICE_ACCOUNT_BASE64)');
            logger_1.logger.info('Note: If you have an FCM_SERVER_KEY, please note that this project uses the modern Firebase Admin SDK which requires a Service Account JSON (base64 encoded).');
        }
    }
    else {
        isFcmInitialized = true;
    }
}
catch (error) {
    logger_1.errorLogger.error('Failed to initialize Firebase Admin:', error);
    logger_1.logger.warn('! FCM features will be disabled. Check your FCM_SERVICE_ACCOUNT_BASE64 in .env');
}
const sendPushNotification = (tokens, data) => __awaiter(void 0, void 0, void 0, function* () {
    if (!isFcmInitialized) {
        logger_1.logger.warn('Skipping push notification: Firebase Admin not initialized');
        return null;
    }
    const tokenList = Array.isArray(tokens) ? tokens : [tokens];
    if (tokenList.length === 0) {
        logger_1.logger.warn('Skipping push notification: No tokens provided');
        return null;
    }
    const isIncomingCall = data.type === 'INCOMING_CALL';
    const callerDisplayName = data.callerName || data.consultantName || 'Consultant';
    const notificationTitle = isIncomingCall
        ? 'Incoming Video Call'
        : data.title || 'Notification';
    const notificationBody = isIncomingCall
        ? `${callerDisplayName} is calling you...`
        : data.body || '';
    const message = {
        tokens: tokenList,
        notification: {
            title: notificationTitle,
            body: notificationBody,
        },
        data: Object.assign(Object.assign({}, data), { click_action: 'FLUTTER_NOTIFICATION_CLICK' }),
        android: {
            priority: 'high',
            notification: isIncomingCall
                ? {
                    channelId: 'incoming_call',
                    priority: 'max',
                    defaultSound: true,
                    defaultVibrateTimings: true,
                }
                : {
                    channelId: 'default',
                    sound: 'default',
                },
        },
        apns: {
            payload: {
                aps: isIncomingCall
                    ? {
                        alert: {
                            title: notificationTitle,
                            body: notificationBody,
                        },
                        sound: 'default',
                        badge: 1,
                        contentAvailable: true,
                    }
                    : {
                        contentAvailable: true,
                        sound: 'default',
                    },
            },
            headers: {
                'apns-priority': '10',
                'apns-push-type': 'alert',
            },
        },
        webpush: {
            headers: {
                Urgency: 'high',
            },
            notification: {
                title: isIncomingCall
                    ? `Incoming Call: ${data.callerName || data.consultantName || 'Someone is calling'}`
                    : (data.title || 'Notification'),
                body: isIncomingCall
                    ? 'Click to answer the consultation call'
                    : (data.body || ''),
                icon: data.callerAvatar || data.consultantAvatar || '/favicon.ico',
                badge: '/favicon.ico',
                requireInteraction: isIncomingCall,
                tag: isIncomingCall ? (data.sessionId || 'call') : undefined,
            },
            fcmOptions: {
                link: data.bookingId
                    ? `/consultation/${data.bookingId}`
                    : (data.sessionId ? `/consultation/session/${data.sessionId}` : '/'),
            },
        },
    };
    try {
        const response = yield firebase_admin_1.default.messaging().sendEachForMulticast(message);
        logger_1.logger.info(`Successfully sent ${response.successCount} push notifications`);
        return response;
    }
    catch (error) {
        logger_1.errorLogger.error('Error sending FCM message:', error);
        throw error;
    }
});
exports.NotificationHelper = {
    sendPushNotification,
};
