/* eslint-disable no-console */
/* eslint-disable no-undef */
import admin from 'firebase-admin';
import config from '../../config';
import { logger, errorLogger } from '../../shared/logger';

let isFcmInitialized = false;

try {
  if (admin.apps.length === 0) {
    if (config.fcm.serviceAccountBase64) {
      // Decoded service account from base64 string in .env
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
      logger.info(
        'Note: If you have an FCM_SERVER_KEY, please note that this project uses the modern Firebase Admin SDK which requires a Service Account JSON (base64 encoded).',
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

const sendPushNotification = async (
  tokens: string | string[],
  data: Record<string, string>,
) => {
  if (!isFcmInitialized) {
    logger.warn('Skipping push notification: Firebase Admin not initialized');
    return null;
  }

  const tokenList = Array.isArray(tokens) ? tokens : [tokens];

  if (tokenList.length === 0) {
    logger.warn('Skipping push notification: No tokens provided');
    return null;
  }

  const isIncomingCall = data.type === 'INCOMING_CALL';

  const callerDisplayName =
    data.callerName || data.consultantName || 'Consultant';
  const notificationTitle = isIncomingCall
    ? 'Incoming Video Call'
    : data.title || 'Notification';
  const notificationBody = isIncomingCall
    ? `${callerDisplayName} is calling you...`
    : data.body || '';

  const message: admin.messaging.MulticastMessage = {
    tokens: tokenList,
    notification: {
      title: notificationTitle,
      body: notificationBody,
    },
    data: {
      ...data,
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
    },
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
    const response = await admin.messaging().sendEachForMulticast(message);
    logger.info(
      `Successfully sent ${response.successCount} push notifications`,
    );
    return response;
  } catch (error) {
    errorLogger.error('Error sending FCM message:', error);
    throw error;
  }
};

export const NotificationHelper = {
  sendPushNotification,
};
