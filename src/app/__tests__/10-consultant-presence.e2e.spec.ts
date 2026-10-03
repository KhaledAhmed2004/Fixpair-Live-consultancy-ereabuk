import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as SocketClient, Socket } from 'socket.io-client';
import app from '../../app';
import { User } from '../modules/user/user.model';
import { StatusCodes } from 'http-status-codes';
import { startTestDb, stopTestDb } from './helpers/setupTestDb';
import { createTestUsers, TestUsers } from './helpers/createTestUsers';
import { socketHelper } from '../../helpers/socketHelper';

import config from '../../config';

vi.setConfig({ testTimeout: 30000 });

describe('Consultant Real-Time Presence & Status Management E2E Tests', () => {
  let testUsers: TestUsers;
  let httpServer: ReturnType<typeof createServer>;
  let io: SocketIOServer;
  let userSocket: Socket;
  let serverUrl: string;

  const capturedStatusEvents: any[] = [];

  const waitForStatusEvent = (
    predicate: (data: any) => boolean,
    timeoutMs = 5000,
  ): Promise<any> => {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + timeoutMs;
      const interval = setInterval(() => {
        const found = capturedStatusEvents.find(predicate);
        if (found) {
          clearInterval(interval);
          resolve(found);
        } else if (Date.now() > deadline) {
          clearInterval(interval);
          reject(
            new Error(
              `Timed out waiting for matching consultant:status-changed event after ${timeoutMs}ms. Captured: ${JSON.stringify(capturedStatusEvents)}`,
            ),
          );
        }
      }, 50);
    });
  };

  beforeAll(async () => {
    await startTestDb();
    testUsers = await createTestUsers(app);

    httpServer = createServer(app);
    io = new SocketIOServer(httpServer, { cors: { origin: '*' } });
    socketHelper.socket(io);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    global.io = io;

    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const addr = httpServer.address() as { port: number };
    serverUrl = `http://127.0.0.1:${addr.port}`;

    // Connect user socket to receive presence broadcast events
    userSocket = SocketClient(serverUrl, {
      auth: { token: testUsers.normalUserToken },
      transports: ['websocket'],
    });

    userSocket.on('consultant:status-changed', (data) => {
      capturedStatusEvents.push(data);
    });

    await new Promise<void>((resolve) => {
      if (userSocket.connected) resolve();
      else userSocket.on('connect', () => resolve());
    });
  });

  afterAll(async () => {
    if (userSocket?.connected) {
      userSocket.disconnect();
    }
    if (httpServer?.listening) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
    await stopTestDb();
  });

  it('should broadcast consultant:status-changed when consultant manually toggles status', async () => {
    capturedStatusEvents.length = 0;

    // 1. Toggle to offline
    const resOffline = await request(app)
      .patch('/api/v1/user/toggle-status')
      .set('Authorization', `Bearer ${testUsers.consultantToken}`)
      .send({ activeStatus: false });

    expect(resOffline.status).toBe(StatusCodes.OK);
    expect(resOffline.body.data.activeStatus).toBe(false);

    const offlineEvent = await waitForStatusEvent(
      (e) =>
        e.consultantId === testUsers.consultantId && e.activeStatus === false,
    );
    expect(offlineEvent).toBeDefined();
    expect(offlineEvent.activeStatus).toBe(false);

    // 2. Toggle back to online
    const resOnline = await request(app)
      .patch('/api/v1/user/toggle-status')
      .set('Authorization', `Bearer ${testUsers.consultantToken}`)
      .send({ activeStatus: true });

    expect(resOnline.status).toBe(StatusCodes.OK);
    expect(resOnline.body.data.activeStatus).toBe(true);

    const onlineEvent = await waitForStatusEvent(
      (e) =>
        e.consultantId === testUsers.consultantId && e.activeStatus === true,
    );
    expect(onlineEvent).toBeDefined();
    expect(onlineEvent.activeStatus).toBe(true);
  });

  it('should set activeStatus to false and broadcast offline on POST /api/v1/auth/logout', async () => {
    capturedStatusEvents.length = 0;

    // Ensure consultant currently has an active FCM token
    const testFcmToken = 'fcm_token_consultant_presence_test_123';
    await User.findByIdAndUpdate(testUsers.consultantId, {
      activeStatus: true,
      $addToSet: { fcmTokens: testFcmToken },
    });

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${testUsers.consultantToken}`)
      .send({ deviceToken: testFcmToken });

    expect(res.status).toBe(StatusCodes.OK);
    expect(res.body.success).toBe(true);

    // Verify DB updated
    const updatedConsultant = await User.findById(testUsers.consultantId);
    expect(updatedConsultant?.activeStatus).toBe(false);
    expect(updatedConsultant?.fcmTokens).not.toContain(testFcmToken);

    // Verify socket event broadcasted
    const logoutEvent = await waitForStatusEvent(
      (e) =>
        e.consultantId === testUsers.consultantId && e.activeStatus === false,
    );
    expect(logoutEvent).toBeDefined();
    expect(logoutEvent.activeStatus).toBe(false);
  });

  it('should reject instant consultation booking when consultant is offline / logged out', async () => {
    // Attempt instant consultation with logged-out consultant
    const res = await request(app)
      .post('/api/v1/consultation/book')
      .set('Authorization', `Bearer ${testUsers.normalUserToken}`)
      .send({
        consultantId: testUsers.consultantId,
        bookingType: 'instant',
      });

    expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    expect(res.body.message).toMatch(/unavailable for instant consultation/i);
  });

  it('should set activeStatus to true and broadcast online on POST /api/v1/auth/login', async () => {
    capturedStatusEvents.length = 0;

    // Consultant is currently offline (from previous logout test)
    const consultantBefore = await User.findById(testUsers.consultantId);
    expect(consultantBefore?.activeStatus).toBe(false);

    // Log in again
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUsers.consultantEmail,
        password: 'ConsultantPassword123!',
      });

    expect(res.status).toBe(StatusCodes.OK);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();

    // Verify DB updated to activeStatus: true
    const updatedConsultant = await User.findById(testUsers.consultantId);
    expect(updatedConsultant?.activeStatus).toBe(true);

    // Verify socket event broadcasted
    const loginEvent = await waitForStatusEvent(
      (e) =>
        e.consultantId === testUsers.consultantId && e.activeStatus === true,
    );
    expect(loginEvent).toBeDefined();
    expect(loginEvent.activeStatus).toBe(true);
  });

  it('should automatically set activeStatus to false and broadcast offline after socket disconnect grace period', async () => {
    capturedStatusEvents.length = 0;

    // Configure a short grace period for this test
    config.socket.disconnectGracePeriodMs = 300;

    // Connect consultant socket
    const consultantSocket = SocketClient(serverUrl, {
      auth: { token: testUsers.consultantToken },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      if (consultantSocket.connected) resolve();
      else consultantSocket.on('connect', () => resolve());
    });

    // Ensure consultant is online in DB
    await User.findByIdAndUpdate(testUsers.consultantId, { activeStatus: true });

    // Now disconnect the consultant socket unexpectedly
    consultantSocket.disconnect();

    // Wait for the grace period to expire and the broadcast event to be received
    const disconnectEvent = await waitForStatusEvent(
      (e) =>
        e.consultantId === testUsers.consultantId && e.activeStatus === false,
      3000,
    );

    expect(disconnectEvent).toBeDefined();
    expect(disconnectEvent.activeStatus).toBe(false);

    // Verify DB was updated to false
    const consultantAfter = await User.findById(testUsers.consultantId);
    expect(consultantAfter?.activeStatus).toBe(false);
  });
});

