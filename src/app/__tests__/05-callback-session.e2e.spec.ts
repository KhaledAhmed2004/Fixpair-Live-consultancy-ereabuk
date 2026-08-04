import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as SocketClient, Socket } from 'socket.io-client';
import app from '../../app';
import { User } from '../modules/user/user.model';
import { StatusCodes } from 'http-status-codes';
import { logApi } from './testLogger';
import { startTestDb, stopTestDb } from './helpers/setupTestDb';
import { createTestUsers, TestUsers } from './helpers/createTestUsers';
import { socketHelper } from '../../helpers/socketHelper';
import config from '../../config';

vi.setConfig({ testTimeout: 60000 });
config.payment.billing.intervalMs = 2000;

describe('Callback Session E2E Tests (Fixpair)', () => {
  let testUsers: TestUsers;
  let callbackConsultationId: string;
  let sessionId: string;

  // Socket.IO test infrastructure
  let httpServer: ReturnType<typeof createServer>;
  let io: SocketIOServer;
  let consultantSocket: Socket;
  let userSocket: Socket;

  // Captured socket events
  const capturedEvents: Record<string, any[]> = {
    'incoming-call': [],
    'billing-updated': [],
    'billing-warning': [],
    'transcript:new': [],
    'consultation-auto-ended': [],
  };

  /**
   * Helper: wait until an event arrives in capturedEvents or timeout
   */
  const waitForEvent = (
    eventName: string,
    timeoutMs = 5000,
  ): Promise<any> => {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + timeoutMs;
      const interval = setInterval(() => {
        if (capturedEvents[eventName]?.length > 0) {
          clearInterval(interval);
          resolve(capturedEvents[eventName][0]);
        } else if (Date.now() > deadline) {
          clearInterval(interval);
          reject(
            new Error(
              `Timed out waiting for socket event "${eventName}" after ${timeoutMs}ms`,
            ),
          );
        }
      }, 50);
    });
  };

  beforeAll(async () => {
    await startTestDb();
    testUsers = await createTestUsers(app);

    // ── Spin up a real HTTP + Socket.IO server so global.io is populated ──
    httpServer = createServer(app);
    io = new SocketIOServer(httpServer, { cors: { origin: '*' } });
    socketHelper.socket(io);
    // Make it globally available exactly like server.ts does
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    global.io = io;

    await new Promise<void>((resolve) => httpServer.listen(0, resolve)); // port 0 = random free port
    const addr = httpServer.address() as { port: number };
    const serverUrl = `http://127.0.0.1:${addr.port}`;

    // Connect consultant socket (will receive billing-updated, billing-warning etc.)
    consultantSocket = SocketClient(serverUrl, {
      auth: { token: testUsers.consultantToken },
      transports: ['websocket'],
    });

    // Connect user socket (will receive incoming-call)
    userSocket = SocketClient(serverUrl, {
      auth: { token: testUsers.normalUserToken },
      transports: ['websocket'],
    });

    // Register event listeners on user socket (because for callback, consultant calls user)
    userSocket.on('incoming-call', (data) =>
      capturedEvents['incoming-call'].push(data),
    );

    // Register event listeners on consultant socket
    consultantSocket.on('billing-updated', (data) =>
      capturedEvents['billing-updated'].push(data),
    );
    consultantSocket.on('billing-warning', (data) =>
      capturedEvents['billing-warning'].push(data),
    );
    consultantSocket.on('consultation-auto-ended', (data) =>
      capturedEvents['consultation-auto-ended'].push(data),
    );

    // Wait until both sockets are connected
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        consultantSocket.once('connect', resolve);
        consultantSocket.once('connect_error', reject);
        setTimeout(() => reject(new Error('Consultant socket connect timeout')), 5000);
      }),
      new Promise<void>((resolve, reject) => {
        userSocket.once('connect', resolve);
        userSocket.once('connect_error', reject);
        setTimeout(() => reject(new Error('User socket connect timeout')), 5000);
      }),
    ]);
  });

  afterAll(async () => {
    consultantSocket?.disconnect();
    userSocket?.disconnect();
    await new Promise<void>((resolve) => io.close(() => resolve()));
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    // @ts-ignore
    delete global.io;
    await stopTestDb();
  });

  describe('Callback Consultation Flow', () => {
    it('should setup the normal user with a mock payment method', async () => {
      await User.findOneAndUpdate(
        { email: testUsers.normalUserEmail },
        {
          stripeCustomerId: 'cus_test_12345',
          paymentMethods: [
            {
              provider: 'stripe',
              methodId: 'pm_card_visa', // Special test token for bypassing Stripe pre-auth in billing.service.ts
              last4: '4242',
              brand: 'visa',
              isDefault: true,
            },
          ],
        }
      );
    });

    it('should book a callback consultation', async () => {
      console.info(`
📝 USER STORY:
Title: Request A Callback Consultation

As a regular user
I want to request a callback consultation
So that the consultant can reach out to me when they are available

📖 BDD SCENARIO: BOOK CALLBACK CONSULTATION
Feature: Callback Consultation Flow

Given I am logged in as a normal user
When I send a POST request to book a callback consultation with my preferred window
Then the consultation is created successfully with pending status
`);
      // Ensure user is online for receiving socket call later
      await request(app)
        .patch('/api/v1/user/toggle-status')
        .set('Authorization', `Bearer ${testUsers.normalUserToken}`)
        .send({ activeStatus: true });

      const payload = {
        consultantId: testUsers.consultantId.toString(),
        bookingType: 'callback',
        preferredWindow: 'asap',
        notes: 'Please call me back at +1234567890.',
      };

      const res = await request(app)
        .post('/api/v1/consultation/book')
        .set('Authorization', `Bearer ${testUsers.normalUserToken}`)
        .send(payload);

      logApi('POST', '/api/v1/consultation/book', { headers: { Authorization: 'Bearer ***' }, body: payload }, res.body, 'POST-BOOK-CALLBACK', 'User books a callback consultation');

      expect(res.status).toBe(StatusCodes.CREATED);
      expect(res.body.success).toBe(true);
      
      callbackConsultationId = res.body.data.consultation._id;
    });

    it('should initiate the callback booking', async () => {
      console.info(`
📝 USER STORY:
Title: Initiate A Callback Request

As a consultant
I want to initiate a callback request
So that I can immediately start a video session with the user

📖 BDD SCENARIO: INITIATE CALLBACK BOOKING
Feature: Callback Consultation Flow

Given a user has requested a callback consultation
When I send a POST request to initiate the callback
Then the consultation status should change to confirmed and a session is returned
`);

      const res = await request(app)
        .post(`/api/v1/consultation/initiate-callback/${callbackConsultationId}`)
        .set('Authorization', `Bearer ${testUsers.consultantToken}`)
        .send();

      logApi('POST', `/api/v1/consultation/initiate-callback/${callbackConsultationId}`, { headers: { Authorization: 'Bearer ***' } }, res.body, 'POST-INITIATE-CALLBACK', 'Consultant initiates the callback consultation');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.consultation.status).toBe('confirmed');
      expect(res.body.data.session).toBeDefined();
      expect(res.body.data.session.token).toBeDefined();

      sessionId = res.body.data.session._id;
    });



    it('should allow the user to join the session', async () => {
      const payload = {
        consultationId: callbackConsultationId,
        sessionId: sessionId,
      };

      const res = await request(app)
        .post('/api/v1/video-session/join')
        .set('Authorization', `Bearer ${testUsers.normalUserToken}`)
        .send(payload);

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
    });

    it('should complete one full billing cycle using configured interval', async () => {
      console.info(`
🔌 BDD SCENARIO: CONTINUOUS BILLING (D2 ARCHITECTURE)
Feature: Billing Engine

Given both users have joined a callback consultation
When the billing interval ticks
Then billing transactions should be recorded in the DB
`);
      
      await new Promise(resolve => setTimeout(resolve, 2500));

      const transactions = await mongoose.model('BillingTransaction').find({ consultationId: callbackConsultationId, type: 'charge' });
      expect(transactions.length).toBeGreaterThanOrEqual(1);
    });

    it('should end the session successfully', async () => {
      const payload = {
        sessionId: sessionId,
      };

      const res = await request(app)
        .post('/api/v1/video-session/end')
        .set('Authorization', `Bearer ${testUsers.consultantToken}`) // Consultant ends the call
        .send(payload);

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      
      // The consultation status should be 'completed'
      const checkRes = await request(app)
        .get(`/api/v1/consultation/my-bookings`)
        .set('Authorization', `Bearer ${testUsers.normalUserToken}`);
      
      const booking = checkRes.body.data.find((b: any) => b._id === callbackConsultationId);
      expect(booking.status).toBe('completed');
    });
  });
});
