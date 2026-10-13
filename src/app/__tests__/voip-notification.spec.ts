import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationHelper } from '../../helpers/notification/notificationHelper';
import admin from 'firebase-admin';

// Mock Firebase Admin and APN
vi.mock('firebase-admin', () => {
  const sendEachForMulticastMock = vi.fn().mockResolvedValue({
    successCount: 1,
    failureCount: 0,
    responses: [{ success: true }],
  });

  return {
    default: {
      apps: [{ name: '[DEFAULT]' }],
      initializeApp: vi.fn(),
      credential: {
        cert: vi.fn(),
      },
      messaging: vi.fn(() => ({
        sendEachForMulticast: sendEachForMulticastMock,
      })),
    },
  };
});

describe('Push Notification & VoIP CallKit System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send a pure DATA-ONLY message for Android incoming calls with NO notification property', async () => {
    const sendMock = admin.messaging().sendEachForMulticast as any;

    await NotificationHelper.sendIncomingCallNotification({
      recipient: {
        userId: 'user_123',
        deviceType: 'android',
        fcmTokens: ['android_fcm_token_xyz'],
      },
      sessionData: {
        sessionId: 'session_456',
        agoraToken: 'fake_agora_token',
        channelName: 'consultation_789',
        callerName: 'Dr. John Doe',
        callerAvatar: 'https://example.com/avatar.png',
        bookingId: 'booking_001',
      },
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const sentPayload = sendMock.mock.calls[0][0];

    // 1. Must NOT include top-level notification object
    expect(sentPayload.notification).toBeUndefined();

    // 2. Android config must have high priority and NO android.notification object
    expect(sentPayload.android).toBeDefined();
    expect(sentPayload.android.priority).toBe('high');
    expect(sentPayload.android.notification).toBeUndefined();

    // 3. Data must contain the call signaling parameters as strings
    expect(sentPayload.data).toMatchObject({
      type: 'INCOMING_CALL',
      sessionId: 'session_456',
      token: 'fake_agora_token',
      channelName: 'consultation_789',
      callerName: 'Dr. John Doe',
    });
  });

  it('should send a pure DATA-ONLY message for Android call cancellation', async () => {
    const sendMock = admin.messaging().sendEachForMulticast as any;

    await NotificationHelper.sendCallCancellationNotification({
      recipient: {
        userId: 'user_123',
        deviceType: 'android',
        fcmTokens: ['android_fcm_token_xyz'],
      },
      sessionId: 'session_456',
      status: 'cancelled',
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const sentPayload = sendMock.mock.calls[0][0];

    // Must NOT have notification block
    expect(sentPayload.notification).toBeUndefined();
    expect(sentPayload.android?.notification).toBeUndefined();

    expect(sentPayload.data).toMatchObject({
      type: 'CALL_CANCELLED',
      sessionId: 'session_456',
      status: 'cancelled',
    });
  });

  it('should retain notification object for standard non-call push notifications', async () => {
    const sendMock = admin.messaging().sendEachForMulticast as any;

    await NotificationHelper.sendPushNotification(['fcm_token_abc'], {
      type: 'CHAT_MESSAGE',
      title: 'New Message',
      body: 'Hello there!',
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const sentPayload = sendMock.mock.calls[0][0];

    // Regular notification MUST have notification block
    expect(sentPayload.notification).toBeDefined();
    expect(sentPayload.notification.title).toBe('New Message');
    expect(sentPayload.notification.body).toBe('Hello there!');
  });
});
