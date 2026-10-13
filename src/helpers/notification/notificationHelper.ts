/* eslint-disable no-console */
/* eslint-disable no-undef */
import apn from '@parse/node-apn';
import crypto from 'crypto';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import config from '../../config';
import { errorLogger, logger } from '../../shared/logger';

// -------------------------------------------------------------
// 1. Firebase Admin Initialization (for Android & General Push)
// -------------------------------------------------------------
let isFcmInitialized = false;

try {
  if (admin.apps.length === 0) {
    if (config.fcm.serviceAccountBase64) {
      const decodedServiceAccount = Buffer.from(
        config.fcm.serviceAccountBase64,
        'base64',
      ).toString('utf-8');

      const serviceAccount = JSON.parse(decodedServiceAccount);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      isFcmInitialized = true;
      logger.info('✓ Firebase Admin initialized successfully');
    } else {
      logger.warn(
        '! Firebase Service Account Base64 is missing in .env (FCM_SERVICE_ACCOUNT_BASE64)',
      );
    }
  } else {
    isFcmInitialized = true;
  }
} catch (error) {
  errorLogger.error('Failed to initialize Firebase Admin:', error);
  logger.warn(
    '! FCM features will be disabled. Check your FCM_SERVICE_ACCOUNT_BASE64 in .env',
  );
}

// -------------------------------------------------------------
// 2. Apple APNs Provider Initialization (for iOS VoIP PushKit)
// -------------------------------------------------------------
let apnProvider: apn.Provider | null = null;

try {
  const p8Path = path.resolve(config.apns.p8FilePath);
  if (fs.existsSync(p8Path) && config.apns.keyId && config.apns.teamId) {
    apnProvider = new apn.Provider({
      token: {
        key: p8Path,
        keyId: config.apns.keyId,
        teamId: config.apns.teamId,
      },
      production: config.apns.isProduction,
    });
    logger.info(
      `✓ Apple APNs VoIP Provider initialized (${config.apns.isProduction ? 'Production' : 'Sandbox'})`,
    );
  } else {
    logger.warn(
      `! APNs AuthKey file not found at ${p8Path} or KeyId/TeamId missing. iOS VoIP pushes disabled.`,
    );
  }
} catch (error) {
  errorLogger.error('Failed to initialize APNs Provider:', error);
}

// -------------------------------------------------------------
// Type Definitions
// -------------------------------------------------------------
export interface IIncomingCallSessionData {
  sessionId: string;
  agoraToken: string;
  channelName: string;
  callerName?: string;
  callerAvatar?: string;
  bookingId?: string;
  consultantName?: string;
  consultantAvatar?: string;
}

export interface IRecipientNotificationTarget {
  userId?: string;
  deviceType?: 'android' | 'ios' | 'web' | string;
  fcmTokens?: string[];
  voipToken?: string;
}

// -------------------------------------------------------------
// 3. Platform-Specific Incoming Call Notification Engine
// -------------------------------------------------------------

/**
 * Sends incoming video/audio call push notifications targeting iOS (APNs PushKit)
 * and/or Android (FCM High-Priority Data-Only).
 */
const sendIncomingCallNotification = async ({
  recipient,
  sessionData,
}: {
  recipient: IRecipientNotificationTarget;
  sessionData: IIncomingCallSessionData;
}) => {
  const callerDisplayName =
    sessionData.callerName || sessionData.consultantName || 'Consultant';
  const callUuid = crypto.randomUUID();

  const results: { ios?: any; android?: any; web?: any } = {};

  // 🍎 iOS DEVICE: Direct APNs VoIP Push (PushKit & CallKit)
  if (recipient.deviceType === 'ios' || recipient.voipToken) {
    if (!recipient.voipToken) {
      logger.warn(
        `[VoIP Warning] No VoIP token registered for iOS user: ${recipient.userId || 'unknown'}`,
      );
    } else if (!apnProvider) {
      logger.warn('[VoIP Warning] APNs Provider is not initialized');
    } else {
      const notification = new apn.Notification();
      notification.topic = config.apns.topic; // e.g. "com.fixpair.app.voip"
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
        const apnResult = await apnProvider.send(notification, recipient.voipToken);
        logger.info(
          `✅ APNs VoIP Push sent: sent=${apnResult.sent.length}, failed=${apnResult.failed.length}`,
        );
        if (apnResult.failed.length > 0) {
          logger.warn(`APNs failure details: ${JSON.stringify(apnResult.failed)}`);
        }
        results.ios = apnResult;
      } catch (err) {
        errorLogger.error('❌ Failed to send APNs VoIP Push:', err);
      }
    }
  }

  // 🤖 ANDROID DEVICE: FCM High-Priority DATA-ONLY Push
  if (
    recipient.deviceType === 'android' ||
    (!recipient.deviceType && !recipient.voipToken && recipient.fcmTokens?.length)
  ) {
    const fcmTokens = (recipient.fcmTokens || []).filter(t => Boolean(t));
    if (fcmTokens.length === 0) {
      logger.warn(
        `[FCM Warning] No FCM tokens found for user: ${recipient.userId || 'unknown'}`,
      );
    } else if (!isFcmInitialized) {
      logger.warn('[FCM Warning] Firebase Admin is not initialized');
    } else {
      // CRITICAL: MUST NOT include 'notification' object to avoid suppressing custom background receiver
      const message: admin.messaging.MulticastMessage = {
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
        const fcmResult = await admin.messaging().sendEachForMulticast(message);
        logger.info(`✅ Android FCM Call Push sent: successCount=${fcmResult.successCount}`);
        results.android = fcmResult;
      } catch (err) {
        errorLogger.error('❌ Failed to send Android FCM Call Push:', err);
      }
    }
  }

  // 💻 DESKTOP WEB / WEBPUSH CLIENTS
  if (recipient.deviceType === 'web' && recipient.fcmTokens?.length && isFcmInitialized) {
    const webTokens = recipient.fcmTokens.filter(t => Boolean(t));
    if (webTokens.length > 0) {
      const webMessage: admin.messaging.MulticastMessage = {
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
        const webResult = await admin.messaging().sendEachForMulticast(webMessage);
        logger.info(`✅ WebPush Call Notification sent: successCount=${webResult.successCount}`);
        results.web = webResult;
      } catch (err) {
        errorLogger.error('❌ Failed to send WebPush Call Notification:', err);
      }
    }
  }

  return results;
};

// -------------------------------------------------------------
// 4. Call Cancellation Notification Engine
// -------------------------------------------------------------

/**
 * Broadcasts a call cancellation push to dismiss ringing CallKit / incoming call screens
 * on iOS and Android when caller hangs up or timeout occurs.
 */
const sendCallCancellationNotification = async ({
  recipient,
  sessionId,
  status = 'cancelled',
}: {
  recipient: IRecipientNotificationTarget;
  sessionId: string;
  status?: string;
}) => {
  const results: { ios?: any; android?: any } = {};

  // 🍎 iOS: Send APNs VoIP Cancellation Push
  if ((recipient.deviceType === 'ios' || recipient.voipToken) && recipient.voipToken && apnProvider) {
    const notification = new apn.Notification();
    notification.topic = config.apns.topic;
    notification.priority = 10;
    notification.pushType = 'voip';
    notification.expiry = 0;
    notification.rawPayload = {
      aps: { 'content-available': 1 },
      id: crypto.randomUUID(),
      type: 'CALL_CANCELLED',
      extra: {
        sessionId: String(sessionId),
        status,
      },
    };

    try {
      results.ios = await apnProvider.send(notification, recipient.voipToken);
      logger.info('✅ iOS VoIP Call Cancellation push sent');
    } catch (err) {
      errorLogger.error('❌ Failed to send iOS VoIP Cancellation push:', err);
    }
  }

  // 🤖 ANDROID: Send FCM Data-Only Cancellation Push
  const fcmTokens = (recipient.fcmTokens || []).filter(t => Boolean(t));
  if (fcmTokens.length > 0 && isFcmInitialized) {
    const message: admin.messaging.MulticastMessage = {
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
      results.android = await admin.messaging().sendEachForMulticast(message);
      logger.info('✅ Android FCM Call Cancellation push sent');
    } catch (err) {
      errorLogger.error('❌ Failed to send Android FCM Call Cancellation push:', err);
    }
  }

  return results;
};

// -------------------------------------------------------------
// 5. General Push Notifications (Chat, Booking updates, etc.)
// -------------------------------------------------------------

const sendPushNotification = async (
  tokens: string | string[],
  data: Record<string, string>,
) => {
  if (!isFcmInitialized) {
    logger.warn('Skipping push notification: Firebase Admin not initialized');
    return null;
  }

  const tokenList = (Array.isArray(tokens) ? tokens : [tokens]).filter(t => Boolean(t));

  if (tokenList.length === 0) {
    logger.warn('Skipping push notification: No tokens provided');
    return null;
  }

  const isIncomingCall = data.type === 'INCOMING_CALL';
  const isCallCancelled = data.type === 'CALL_CANCELLED' || data.type === 'CALL_REJECTED';

  const callerDisplayName =
    data.callerName || data.consultantName || 'Consultant';
  const notificationTitle = isIncomingCall
    ? 'Incoming Video Call'
    : data.title || 'Notification';
  const notificationBody = isIncomingCall
    ? `${callerDisplayName} is calling you...`
    : data.body || '';

  // If this is an incoming call, we must NOT put a notification object on Android
  // so the Android background handler can launch CallKit!
  const message: admin.messaging.MulticastMessage = {
    tokens: tokenList,
    // Only include top-level notification for non-call updates
    ...(!isIncomingCall && !isCallCancelled && {
      notification: {
        title: notificationTitle,
        body: notificationBody,
      },
    }),
    data: {
      ...data,
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
    },
    android: {
      priority: 'high',
      ttl: isIncomingCall ? 30 * 1000 : undefined,
      // For general notifications, specify android channel. For incoming calls, leave out notification!
      ...(!isIncomingCall && !isCallCancelled && {
        notification: {
          channelId: 'default',
          sound: 'default',
        },
      }),
    },
    apns: {
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
    },
    webpush: {
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
    },
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    logger.info(`Successfully sent ${response.successCount} push notifications`);
    return response;
  } catch (error) {
    errorLogger.error('Error sending FCM message:', error);
    throw error;
  }
};

export const NotificationHelper = {
  sendPushNotification,
  sendIncomingCallNotification,
  sendCallCancellationNotification,
};
