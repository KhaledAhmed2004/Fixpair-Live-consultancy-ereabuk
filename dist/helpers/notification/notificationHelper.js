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
const node_apn_1 = __importDefault(require("@parse/node-apn"));
const crypto_1 = __importDefault(require("crypto"));
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = __importDefault(require("../../config"));
const logger_1 = require("../../shared/logger");
// -------------------------------------------------------------
// 1. Firebase Admin Initialization (for Android & General Push)
// -------------------------------------------------------------
let isFcmInitialized = false;
try {
    if (firebase_admin_1.default.apps.length === 0) {
        if (config_1.default.fcm.serviceAccountBase64) {
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
// -------------------------------------------------------------
// 2. Apple APNs Provider Initialization (for iOS VoIP PushKit)
// -------------------------------------------------------------
let apnProvider = null;
try {
    const p8Path = path_1.default.resolve(config_1.default.apns.p8FilePath);
    if (fs_1.default.existsSync(p8Path) && config_1.default.apns.keyId && config_1.default.apns.teamId) {
        apnProvider = new node_apn_1.default.Provider({
            token: {
                key: p8Path,
                keyId: config_1.default.apns.keyId,
                teamId: config_1.default.apns.teamId,
            },
            production: config_1.default.apns.isProduction,
        });
        logger_1.logger.info(`✓ Apple APNs VoIP Provider initialized (${config_1.default.apns.isProduction ? 'Production' : 'Sandbox'})`);
    }
    else {
        logger_1.logger.warn(`! APNs AuthKey file not found at ${p8Path} or KeyId/TeamId missing. iOS VoIP pushes disabled.`);
    }
}
catch (error) {
    logger_1.errorLogger.error('Failed to initialize APNs Provider:', error);
}
// -------------------------------------------------------------
// 3. Platform-Specific Incoming Call Notification Engine
// -------------------------------------------------------------
/**
 * Sends incoming video/audio call push notifications targeting iOS (APNs PushKit)
 * and/or Android (FCM High-Priority Data-Only).
 */
const sendIncomingCallNotification = (_a) => __awaiter(void 0, [_a], void 0, function* ({ recipient, sessionData, }) {
    var _b, _c;
    const callerDisplayName = sessionData.callerName || sessionData.consultantName || 'Consultant';
    const callUuid = crypto_1.default.randomUUID();
    const results = {};
    // 🍎 iOS DEVICE: Direct APNs VoIP Push (PushKit & CallKit)
    if (recipient.deviceType === 'ios' || recipient.voipToken) {
        if (!recipient.voipToken) {
            logger_1.logger.warn(`[VoIP Warning] No VoIP token registered for iOS user: ${recipient.userId || 'unknown'}`);
        }
        else if (!apnProvider) {
            logger_1.logger.warn('[VoIP Warning] APNs Provider is not initialized');
        }
        else {
            const notification = new node_apn_1.default.Notification();
            notification.topic = config_1.default.apns.topic; // e.g. "com.fixpair.app.voip"
            notification.priority = 10;
            notification.pushType = 'voip';
            notification.expiry = 0; // Deliver immediately or discard
            notification.rawPayload = {
                aps: {
                    'content-available': 1,
                },
                id: callUuid,
                nameCaller: callerDisplayName,
                handle: 'Video Consultation',
                type: 1, // 1: video, 0: audio
                extra: {
                    sessionId: String(sessionData.sessionId),
                    token: String(sessionData.agoraToken),
                    channelName: String(sessionData.channelName),
                    callerName: String(callerDisplayName),
                    callerAvatar: String(sessionData.callerAvatar || sessionData.consultantAvatar || ''),
                    bookingId: String(sessionData.bookingId || ''),
                },
            };
            try {
                const apnResult = yield apnProvider.send(notification, recipient.voipToken);
                logger_1.logger.info(`✅ APNs VoIP Push sent: sent=${apnResult.sent.length}, failed=${apnResult.failed.length}`);
                if (apnResult.failed.length > 0) {
                    logger_1.logger.warn(`APNs failure details: ${JSON.stringify(apnResult.failed)}`);
                }
                results.ios = apnResult;
            }
            catch (err) {
                logger_1.errorLogger.error('❌ Failed to send APNs VoIP Push:', err);
            }
        }
    }
    // 🤖 ANDROID DEVICE: FCM High-Priority DATA-ONLY Push
    if (recipient.deviceType === 'android' ||
        (!recipient.deviceType && !recipient.voipToken && ((_b = recipient.fcmTokens) === null || _b === void 0 ? void 0 : _b.length))) {
        const fcmTokens = (recipient.fcmTokens || []).filter(t => Boolean(t));
        if (fcmTokens.length === 0) {
            logger_1.logger.warn(`[FCM Warning] No FCM tokens found for user: ${recipient.userId || 'unknown'}`);
        }
        else if (!isFcmInitialized) {
            logger_1.logger.warn('[FCM Warning] Firebase Admin is not initialized');
        }
        else {
            // CRITICAL: MUST NOT include 'notification' object to avoid suppressing custom background receiver
            const message = {
                tokens: fcmTokens,
                android: {
                    priority: 'high',
                    ttl: 30 * 1000, // 30 seconds
                },
                data: {
                    type: 'INCOMING_CALL',
                    id: callUuid,
                    sessionId: String(sessionData.sessionId),
                    token: String(sessionData.agoraToken),
                    channelName: String(sessionData.channelName),
                    callerName: String(callerDisplayName),
                    callerAvatar: String(sessionData.callerAvatar || sessionData.consultantAvatar || ''),
                    bookingId: String(sessionData.bookingId || ''),
                },
            };
            try {
                const fcmResult = yield firebase_admin_1.default.messaging().sendEachForMulticast(message);
                logger_1.logger.info(`✅ Android FCM Call Push sent: successCount=${fcmResult.successCount}`);
                results.android = fcmResult;
            }
            catch (err) {
                logger_1.errorLogger.error('❌ Failed to send Android FCM Call Push:', err);
            }
        }
    }
    // 💻 DESKTOP WEB / WEBPUSH CLIENTS
    if (recipient.deviceType === 'web' && ((_c = recipient.fcmTokens) === null || _c === void 0 ? void 0 : _c.length) && isFcmInitialized) {
        const webTokens = recipient.fcmTokens.filter(t => Boolean(t));
        if (webTokens.length > 0) {
            const webMessage = {
                tokens: webTokens,
                notification: {
                    title: `Incoming Video Call: ${callerDisplayName}`,
                    body: 'Click to answer the consultation call',
                },
                data: {
                    type: 'INCOMING_CALL',
                    sessionId: String(sessionData.sessionId),
                    token: String(sessionData.agoraToken),
                    channelName: String(sessionData.channelName),
                    callerName: String(callerDisplayName),
                    callerAvatar: String(sessionData.callerAvatar || sessionData.consultantAvatar || ''),
                    bookingId: String(sessionData.bookingId || ''),
                },
                webpush: {
                    headers: { Urgency: 'high' },
                    notification: {
                        title: `Incoming Video Call: ${callerDisplayName}`,
                        body: 'Click to answer the consultation call',
                        icon: sessionData.callerAvatar || sessionData.consultantAvatar || '/favicon.ico',
                        badge: '/favicon.ico',
                        requireInteraction: true,
                        tag: String(sessionData.sessionId || 'call'),
                    },
                    fcmOptions: {
                        link: sessionData.bookingId
                            ? `/consultation/${sessionData.bookingId}`
                            : sessionData.sessionId
                                ? `/consultation/session/${sessionData.sessionId}`
                                : '/',
                    },
                },
            };
            try {
                const webResult = yield firebase_admin_1.default.messaging().sendEachForMulticast(webMessage);
                logger_1.logger.info(`✅ WebPush Call Notification sent: successCount=${webResult.successCount}`);
                results.web = webResult;
            }
            catch (err) {
                logger_1.errorLogger.error('❌ Failed to send WebPush Call Notification:', err);
            }
        }
    }
    return results;
});
// -------------------------------------------------------------
// 4. Call Cancellation Notification Engine
// -------------------------------------------------------------
/**
 * Broadcasts a call cancellation push to dismiss ringing CallKit / incoming call screens
 * on iOS and Android when caller hangs up or timeout occurs.
 */
const sendCallCancellationNotification = (_a) => __awaiter(void 0, [_a], void 0, function* ({ recipient, sessionId, status = 'cancelled', }) {
    const results = {};
    // 🍎 iOS: Send APNs VoIP Cancellation Push
    if ((recipient.deviceType === 'ios' || recipient.voipToken) && recipient.voipToken && apnProvider) {
        const notification = new node_apn_1.default.Notification();
        notification.topic = config_1.default.apns.topic;
        notification.priority = 10;
        notification.pushType = 'voip';
        notification.expiry = 0;
        notification.rawPayload = {
            aps: { 'content-available': 1 },
            id: crypto_1.default.randomUUID(),
            type: 'CALL_CANCELLED',
            extra: {
                sessionId: String(sessionId),
                status,
            },
        };
        try {
            results.ios = yield apnProvider.send(notification, recipient.voipToken);
            logger_1.logger.info('✅ iOS VoIP Call Cancellation push sent');
        }
        catch (err) {
            logger_1.errorLogger.error('❌ Failed to send iOS VoIP Cancellation push:', err);
        }
    }
    // 🤖 ANDROID: Send FCM Data-Only Cancellation Push
    const fcmTokens = (recipient.fcmTokens || []).filter(t => Boolean(t));
    if (fcmTokens.length > 0 && isFcmInitialized) {
        const message = {
            tokens: fcmTokens,
            android: {
                priority: 'high',
            },
            data: {
                type: 'CALL_CANCELLED',
                sessionId: String(sessionId),
                status,
            },
        };
        try {
            results.android = yield firebase_admin_1.default.messaging().sendEachForMulticast(message);
            logger_1.logger.info('✅ Android FCM Call Cancellation push sent');
        }
        catch (err) {
            logger_1.errorLogger.error('❌ Failed to send Android FCM Call Cancellation push:', err);
        }
    }
    return results;
});
// -------------------------------------------------------------
// 5. General Push Notifications (Chat, Booking updates, etc.)
// -------------------------------------------------------------
const sendPushNotification = (tokens, data) => __awaiter(void 0, void 0, void 0, function* () {
    if (!isFcmInitialized) {
        logger_1.logger.warn('Skipping push notification: Firebase Admin not initialized');
        return null;
    }
    const tokenList = (Array.isArray(tokens) ? tokens : [tokens]).filter(t => Boolean(t));
    if (tokenList.length === 0) {
        logger_1.logger.warn('Skipping push notification: No tokens provided');
        return null;
    }
    const isIncomingCall = data.type === 'INCOMING_CALL';
    const isCallCancelled = data.type === 'CALL_CANCELLED' || data.type === 'CALL_REJECTED';
    const callerDisplayName = data.callerName || data.consultantName || 'Consultant';
    const notificationTitle = isIncomingCall
        ? 'Incoming Video Call'
        : data.title || 'Notification';
    const notificationBody = isIncomingCall
        ? `${callerDisplayName} is calling you...`
        : data.body || '';
    // If this is an incoming call, we must NOT put a notification object on Android
    // so the Android background handler can launch CallKit!
    const message = Object.assign(Object.assign({ tokens: tokenList }, (!isIncomingCall && !isCallCancelled && {
        notification: {
            title: notificationTitle,
            body: notificationBody,
        },
    })), { data: Object.assign(Object.assign({}, data), { click_action: 'FLUTTER_NOTIFICATION_CLICK' }), android: Object.assign({ priority: 'high', ttl: isIncomingCall ? 30 * 1000 : undefined }, (!isIncomingCall && !isCallCancelled && {
            notification: {
                channelId: 'default',
                sound: 'default',
            },
        })), apns: {
            payload: {
                aps: {
                    contentAvailable: true,
                    sound: isIncomingCall ? undefined : 'default',
                },
            },
            headers: {
                'apns-priority': '10',
                'apns-push-type': 'alert',
            },
        }, webpush: {
            headers: {
                Urgency: 'high',
            },
            notification: {
                title: isIncomingCall
                    ? `Incoming Call: ${callerDisplayName}`
                    : data.title || 'Notification',
                body: isIncomingCall
                    ? 'Click to answer the consultation call'
                    : data.body || '',
                icon: data.callerAvatar || data.consultantAvatar || '/favicon.ico',
                badge: '/favicon.ico',
                requireInteraction: isIncomingCall,
                tag: isIncomingCall ? data.sessionId || 'call' : undefined,
            },
            fcmOptions: {
                link: data.bookingId
                    ? `/consultation/${data.bookingId}`
                    : data.sessionId
                        ? `/consultation/session/${data.sessionId}`
                        : '/',
            },
        } });
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
    sendIncomingCallNotification,
    sendCallCancellationNotification,
};
