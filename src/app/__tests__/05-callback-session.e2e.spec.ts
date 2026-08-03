import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { StatusCodes } from 'http-status-codes';
import { logApi } from './testLogger';
import { startTestDb, stopTestDb } from './helpers/setupTestDb';
import { createTestUsers, TestUsers } from './helpers/createTestUsers';

vi.setConfig({ testTimeout: 60000 });

describe('Callback Session E2E Tests (Fixpair)', () => {
  let testUsers: TestUsers;
  let callbackConsultationId: string;

  beforeAll(async () => {
    await startTestDb();
    testUsers = await createTestUsers(app);
  });

  afterAll(async () => {
    await stopTestDb();
  });

  describe('Callback Consultation Flow', () => {
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

    it('should accept the callback booking', async () => {
      console.info(`
📝 USER STORY:
Title: Accept A Callback Request

As a consultant
I want to accept a callback request
So that the user knows I will be calling them during their preferred window

📖 BDD SCENARIO: ACCEPT CALLBACK BOOKING
Feature: Callback Consultation Flow

Given a user has requested a callback consultation
When I send a PATCH request to update the status to accepted
Then the consultation status should change to confirmed
`);
      const payload = {
        status: 'accepted'
      };

      const res = await request(app)
        .patch(`/api/v1/consultation/status/${callbackConsultationId}`)
        .set('Authorization', `Bearer ${testUsers.consultantToken}`)
        .send(payload);

      logApi('PATCH', `/api/v1/consultation/status/${callbackConsultationId}`, { headers: { Authorization: 'Bearer ***' }, body: payload }, res.body, 'PATCH-ACCEPT-CALLBACK', 'Consultant accepts the callback consultation');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('confirmed');
    });

    it('should complete the callback booking', async () => {
      console.info(`
📝 USER STORY:
Title: Mark A Callback Consultation As Completed

As a consultant
I want to mark a callback consultation as completed
So that the record reflects that the call happened

📖 BDD SCENARIO: COMPLETE CALLBACK BOOKING
Feature: Callback Consultation Flow

Given a callback consultation is confirmed
When I send a PATCH request to update the status to completed
Then the consultation status should successfully change to completed
`);
      const payload = {
        status: 'completed'
      };

      const res = await request(app)
        .patch(`/api/v1/consultation/status/${callbackConsultationId}`)
        .set('Authorization', `Bearer ${testUsers.consultantToken}`)
        .send(payload);

      logApi('PATCH', `/api/v1/consultation/status/${callbackConsultationId}`, { headers: { Authorization: 'Bearer ***' }, body: payload }, res.body, 'PATCH-COMPLETE-CALLBACK', 'Consultant completes the callback consultation');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('completed');
    });
  });
});
