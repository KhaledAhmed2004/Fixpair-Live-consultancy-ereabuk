import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { StatusCodes } from 'http-status-codes';
import { logApi } from './testLogger';
import { startTestDb, stopTestDb } from './helpers/setupTestDb';
import { createTestUsers, TestUsers } from './helpers/createTestUsers';

vi.setConfig({ testTimeout: 60000 });

describe('Scheduled Session E2E Tests (Fixpair)', () => {
  let testUsers: TestUsers;
  let scheduledConsultationId: string;
  const slotDate = new Date();
  slotDate.setDate(slotDate.getDate() + 1); // Tomorrow
  const dateString = slotDate.toISOString();

  beforeAll(async () => {
    await startTestDb();
    testUsers = await createTestUsers(app);
  });

  afterAll(async () => {
    await stopTestDb();
  });

  describe('Scheduled Consultation Flow', () => {
    it('should set availability for the consultant', async () => {
      console.info(`
📝 USER STORY:
Title: Set My Availability For Scheduled Consultations

As a consultant
I want to set my availability for scheduled consultations
So that users can book future sessions with me

📖 BDD SCENARIO: SET AVAILABILITY FOR SCHEDULED
Feature: Scheduled Consultation Flow

Given I am an active consultant
When I send a POST request with specific date and time slots
Then my availability should be recorded successfully
`);
      const payload = {
        slots: [
          {
            date: dateString,
            startTime: '14:00',
            endTime: '15:00',
          },
        ],
      };

      const res = await request(app)
        .post('/api/v1/consultation/availability')
        .set('Authorization', `Bearer ${testUsers.consultantToken}`)
        .send(payload);

      logApi(
        'POST',
        '/api/v1/consultation/availability',
        { headers: { Authorization: 'Bearer ***' }, body: payload },
        res.body,
        'POST-SET-AVAILABILITY',
        'Consultant sets available slots',
      );

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
    });

    it('should book a scheduled consultation', async () => {
      console.info(`
📝 USER STORY:
Title: Book A Scheduled Consultation

As a regular user
I want to book a scheduled consultation
So that I can guarantee a specific time slot with a consultant

📖 BDD SCENARIO: BOOK SCHEDULED CONSULTATION
Feature: Scheduled Consultation Flow

Given a consultant has available slots
When I send a POST request to book a scheduled consultation for that slot
Then the consultation is created successfully with pending status
`);
      const payload = {
        consultantId: testUsers.consultantId,
        bookingType: 'scheduled',
        date: dateString,
        startTime: '10:00',
        endTime: '11:00',
        notes: 'I need a scheduled review of my code.',
      };

      const res = await request(app)
        .post('/api/v1/consultation/book')
        .set('Authorization', `Bearer ${testUsers.normalUserToken}`)
        .send(payload);

      logApi(
        'POST',
        '/api/v1/consultation/book',
        { headers: { Authorization: 'Bearer ***' }, body: payload },
        res.body,
        'POST-BOOK-SCHEDULED',
        'User books a scheduled consultation',
      );

      expect(res.status).toBe(StatusCodes.CREATED);
      expect(res.body.success).toBe(true);

      scheduledConsultationId = res.body.data.consultation._id;
    });

    it('should accept the scheduled booking', async () => {
      console.info(`
📝 USER STORY:
Title: Accept A Scheduled Booking Request

As a consultant
I want to accept a scheduled booking request
So that the user knows their time slot is confirmed

📖 BDD SCENARIO: ACCEPT SCHEDULED BOOKING
Feature: Scheduled Consultation Flow

Given a user has booked a scheduled consultation with me
When I send a PATCH request to update the status to accepted
Then the consultation status should change to confirmed
`);
      const payload = {
        status: 'accepted',
      };

      const res = await request(app)
        .patch(`/api/v1/consultation/status/${scheduledConsultationId}`)
        .set('Authorization', `Bearer ${testUsers.consultantToken}`)
        .send(payload);

      logApi(
        'PATCH',
        `/api/v1/consultation/status/${scheduledConsultationId}`,
        { headers: { Authorization: 'Bearer ***' }, body: payload },
        res.body,
        'PATCH-ACCEPT-SCHEDULED',
        'Consultant accepts the scheduled consultation',
      );

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('confirmed');
    });

    it('should complete the scheduled booking', async () => {
      console.info(`
📝 USER STORY:
Title: Complete A Scheduled Consultation

As a consultant
I want to complete a scheduled consultation
So that the session is marked as finished and finalized

📖 BDD SCENARIO: COMPLETE SCHEDULED BOOKING
Feature: Scheduled Consultation Flow

Given a scheduled consultation is confirmed and the session has occurred
When I send a PATCH request to update the status to completed
Then the consultation status should successfully change to completed
`);
      const payload = {
        status: 'completed',
      };

      const res = await request(app)
        .patch(`/api/v1/consultation/status/${scheduledConsultationId}`)
        .set('Authorization', `Bearer ${testUsers.consultantToken}`)
        .send(payload);

      logApi(
        'PATCH',
        `/api/v1/consultation/status/${scheduledConsultationId}`,
        { headers: { Authorization: 'Bearer ***' }, body: payload },
        res.body,
        'PATCH-COMPLETE-SCHEDULED',
        'Consultant completes the scheduled consultation',
      );

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('completed');
    });
  });
});
