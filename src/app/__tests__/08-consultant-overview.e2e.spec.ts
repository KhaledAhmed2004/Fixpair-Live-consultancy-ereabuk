import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app';
import { StatusCodes } from 'http-status-codes';
import { logApi } from './testLogger';
import { startTestDb, stopTestDb } from './helpers/setupTestDb';
import { createTestUsers, TestUsers } from './helpers/createTestUsers';
import { Consultation } from '../modules/consultation/consultation.model';
import { Review } from '../modules/review/review.model';

vi.setConfig({ testTimeout: 60000 });

describe('Consultant Overview E2E Tests (Fixpair)', () => {
  let testUsers: TestUsers;
  let normalUserId: string;

  beforeAll(async () => {
    await startTestDb();
    testUsers = await createTestUsers(app);

    const normalUser = await mongoose
      .model('User')
      .findOne({ email: testUsers.normalUserEmail });
    normalUserId = normalUser._id.toString();

    const completedConsultation = await Consultation.create({
      user: normalUserId,
      consultant: testUsers.consultantId,
      bookingType: 'instant',
      perMinuteRate: 5,
      platformFee: 2,
      status: 'completed',
      billingStatus: 'completed',
      paymentStatus: 'paid',
    });

    await Consultation.create({
      user: normalUserId,
      consultant: testUsers.consultantId,
      bookingType: 'scheduled',
      date: new Date(),
      startTime: '10:00',
      endTime: '11:00',
      perMinuteRate: 5,
      platformFee: 2,
      status: 'confirmed',
    });

    await Consultation.create({
      user: normalUserId,
      consultant: testUsers.consultantId,
      bookingType: 'scheduled',
      perMinuteRate: 5,
      platformFee: 2,
      status: 'cancelled',
      cancelledAt: new Date(),
    });

    await Review.create({
      user: normalUserId,
      consultant: testUsers.consultantId,
      consultation: completedConsultation._id,
      rating: 5,
      comment: 'Excellent consultation!',
    });
  });

  afterAll(async () => {
    await stopTestDb();
  });

  describe('Consultant Overview APIs', () => {
    it('should fetch consultant dashboard summary cards', async () => {
      console.info(`
📝 USER STORY:
Title: View Consultant Dashboard Summary

As a consultant
I want to view upcoming, completed, total, and cancelled consultation cards
So that I can track my session performance
`);

      const res = await request(app)
        .get('/api/v1/consultant/dashboard-summary')
        .set('Authorization', `Bearer ${testUsers.consultantToken}`);

      logApi(
        'GET',
        '/api/v1/consultant/dashboard-summary',
        { headers: { Authorization: 'Bearer ***' } },
        res.body,
        'GET-CONSULTANT-DASHBOARD-SUMMARY',
        'Consultant fetches dashboard summary',
      );

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.meta).toEqual({ comparisonPeriod: '30d' });
      expect(res.body.data.upcomingConsultations).toMatchObject({
        value: expect.any(Number),
        changePct: expect.any(Number),
        direction: expect.stringMatching(/^(up|down|neutral)$/),
      });
      expect(res.body.data.completedConsultations.value).toBeGreaterThanOrEqual(1);
      expect(res.body.data.cancelledConsultations.value).toBeGreaterThanOrEqual(1);
      expect(res.body.data.totalSessions.value).toBeGreaterThanOrEqual(3);
    });

    it('should fetch last 30 days consultation trend by default', async () => {
      console.info(`
📝 USER STORY:
Title: View Consultation Trend Chart (30 days)

As a consultant
I want to see consultation volume over the last 30 days
So that I can understand recent booking activity
`);

      const res = await request(app)
        .get('/api/v1/consultant/consultation-trend?days=30')
        .set('Authorization', `Bearer ${testUsers.consultantToken}`);

      logApi(
        'GET',
        '/api/v1/consultant/consultation-trend?days=30',
        { headers: { Authorization: 'Bearer ***' } },
        res.body,
        'GET-CONSULTANT-CONSULTATION-TREND-30D',
        'Consultant fetches 30-day consultation trend',
      );

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.period.days).toBe(30);
      expect(Array.isArray(res.body.data.points)).toBe(true);
      expect(res.body.data.points).toHaveLength(30);

      const todayPoint = res.body.data.points[res.body.data.points.length - 1];
      expect(todayPoint).toMatchObject({
        upcoming: expect.any(Number),
        completed: expect.any(Number),
        cancelled: expect.any(Number),
      });
      expect(todayPoint.upcoming).toBeGreaterThanOrEqual(1);
      expect(todayPoint.completed).toBeGreaterThanOrEqual(1);
      expect(todayPoint.cancelled).toBeGreaterThanOrEqual(1);
    });

    it('should fetch last 7 days consultation trend', async () => {
      console.info(`
📝 USER STORY:
Title: View Consultation Trend Chart (7 days)

As a consultant
I want to see consultation volume over the last 7 days
So that I can review short-term booking activity
`);

      const res = await request(app)
        .get('/api/v1/consultant/consultation-trend?days=7')
        .set('Authorization', `Bearer ${testUsers.consultantToken}`);

      logApi(
        'GET',
        '/api/v1/consultant/consultation-trend?days=7',
        { headers: { Authorization: 'Bearer ***' } },
        res.body,
        'GET-CONSULTANT-CONSULTATION-TREND-7D',
        'Consultant fetches 7-day consultation trend',
      );

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.period.days).toBe(7);
      expect(res.body.data.points).toHaveLength(7);
    });

    it('should fetch my ratings with star breakdown', async () => {
      console.info(`
📝 USER STORY:
Title: View My Ratings

As a consultant
I want to see total ratings, average rating, and 5–1 star counts
So that I can understand client feedback quality
`);

      const res = await request(app)
        .get('/api/v1/consultant/my-ratings')
        .set('Authorization', `Bearer ${testUsers.consultantToken}`);

      logApi(
        'GET',
        '/api/v1/consultant/my-ratings',
        { headers: { Authorization: 'Bearer ***' } },
        res.body,
        'GET-CONSULTANT-MY-RATINGS',
        'Consultant fetches rating breakdown',
      );

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalRatings).toBeGreaterThanOrEqual(1);
      expect(res.body.data.averageRating).toBe(5);
      expect(res.body.data.label).toBe('Excellent');
      expect(res.body.data.breakdown).toHaveLength(5);
      expect(res.body.data.breakdown[0]).toEqual({
        stars: 5,
        count: 1,
        percentage: 100,
      });
      expect(res.body.data.breakdown.map((b: { stars: number }) => b.stars)).toEqual([
        5, 4, 3, 2, 1,
      ]);
    });

    it('should fetch recent bookings with client image and status', async () => {
      console.info(`
📝 USER STORY:
Title: View Recent Bookings

As a consultant
I want to see recent bookings with client details, date/time, and status
So that I can quickly review upcoming and past sessions
`);

      const res = await request(app)
        .get('/api/v1/consultant/recent-bookings?limit=5')
        .set('Authorization', `Bearer ${testUsers.consultantToken}`);

      logApi(
        'GET',
        '/api/v1/consultant/recent-bookings?limit=5',
        { headers: { Authorization: 'Bearer ***' } },
        res.body,
        'GET-CONSULTANT-RECENT-BOOKINGS',
        'Consultant fetches recent bookings',
      );

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0]).toMatchObject({
        consultationId: expect.any(String),
        clientName: expect.any(String),
        scheduledAt: expect.any(String),
        status: expect.any(String),
      });
      expect(res.body.data[0]).toHaveProperty('clientImage');
    });

    it('should fetch recent feedback', async () => {
      console.info(`
📝 USER STORY:
Title: View Recent Feedback

As a consultant
I want to see recent client feedback
So that I can respond to reviews and improve service
`);

      const res = await request(app)
        .get('/api/v1/consultant/recent-feedback?limit=5')
        .set('Authorization', `Bearer ${testUsers.consultantToken}`);

      logApi(
        'GET',
        '/api/v1/consultant/recent-feedback?limit=5',
        { headers: { Authorization: 'Bearer ***' } },
        res.body,
        'GET-CONSULTANT-RECENT-FEEDBACK',
        'Consultant fetches recent feedback',
      );

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0]).toMatchObject({
        id: expect.any(String),
        clientName: expect.any(String),
        rating: expect.any(Number),
        comment: expect.any(String),
      });
      expect(res.body.data[0].rating).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].rating).toBeLessThanOrEqual(5);
      expect(res.body.data[0]).toHaveProperty('clientImage');
    });
  });
});
