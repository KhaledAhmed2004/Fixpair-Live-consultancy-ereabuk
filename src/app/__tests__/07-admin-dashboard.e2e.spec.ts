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

describe('Admin Dashboard E2E Tests (Fixpair)', () => {
  let testUsers: TestUsers;

  beforeAll(async () => {
    await startTestDb();
    testUsers = await createTestUsers(app);

    const normalUser = await mongoose.model('User').findOne({ email: testUsers.normalUserEmail });
    const normalUserId = normalUser._id;

    // Create a completed consultation
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

    // Create a cancelled consultation
    await Consultation.create({
      user: normalUserId,
      consultant: testUsers.consultantId,
      bookingType: 'scheduled',
      perMinuteRate: 5,
      platformFee: 2,
      status: 'cancelled',
      cancelledAt: new Date(),
    });

    // Create a review
    await Review.create({
      user: normalUserId,
      consultant: testUsers.consultantId,
      consultation: completedConsultation._id,
      rating: 5,
      comment: 'Great session!',
    });
  });

  afterAll(async () => {
    await stopTestDb();
  });

  describe('Admin Dashboard APIs', () => {
    it('should successfully fetch the dashboard summary', async () => {
      console.info(`
📝 USER STORY:
Title: View Dashboard Summary

As a super admin
I want to view the dashboard summary
So that I can see the overall metrics like total users, consultants, and revenue

📖 BDD SCENARIO: FETCH DASHBOARD SUMMARY
Feature: Admin Dashboard

Given I am logged in as a super admin
When I send a GET request to the dashboard summary endpoint
Then I should receive the summary data successfully
`);

      const res = await request(app)
        .get('/api/v1/admin/dashboard-summary')
        .set('Authorization', `Bearer ${testUsers.superAdminToken}`);

      logApi('GET', '/api/v1/admin/dashboard-summary', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-DASHBOARD-SUMMARY', 'Admin fetches dashboard summary');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.meta).toEqual({ comparisonPeriod: '30d' });
      expect(res.body.data).toBeDefined();
      expect(res.body.data.totalUsers).toMatchObject({
        value: expect.any(Number),
        changePct: expect.any(Number),
        direction: expect.stringMatching(/^(up|down|neutral)$/),
      });
      expect(res.body.data.averageRating).toHaveProperty('value');
    });

    it('should successfully fetch consultation trend', async () => {
      console.info(`
📝 USER STORY:
Title: View Consultation Trend

As a super admin
I want to view the consultation trend over months
So that I can analyze the platform's growth in consultations

📖 BDD SCENARIO: FETCH CONSULTATION TREND
Feature: Admin Dashboard

Given I am logged in as a super admin
When I send a GET request to the consultation trend endpoint with a months query
Then I should receive the trend data successfully
`);

      const res = await request(app)
        .get('/api/v1/admin/consultation-trend?months=6')
        .set('Authorization', `Bearer ${testUsers.superAdminToken}`);

      logApi('GET', '/api/v1/admin/consultation-trend?months=6', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-CONSULTATION-TREND', 'Admin fetches consultation trend');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.period).toBeDefined();
      expect(res.body.data.period.months).toBe(6);
      expect(Array.isArray(res.body.data.points)).toBe(true);
      expect(res.body.data.points).toHaveLength(6);
    });

    it('should successfully fetch user growth', async () => {
      console.info(`
📝 USER STORY:
Title: View User Growth

As a super admin
I want to view the user growth trend over months
So that I can analyze user acquisition

📖 BDD SCENARIO: FETCH USER GROWTH
Feature: Admin Dashboard

Given I am logged in as a super admin
When I send a GET request to the user growth endpoint with a months query
Then I should receive the growth data successfully
`);

      const res = await request(app)
        .get('/api/v1/admin/user-growth?months=6')
        .set('Authorization', `Bearer ${testUsers.superAdminToken}`);

      logApi('GET', '/api/v1/admin/user-growth?months=6', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-USER-GROWTH', 'Admin fetches user growth trend');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.period).toBeDefined();
      expect(res.body.data.period.months).toBe(6);
      expect(Array.isArray(res.body.data.points)).toBe(true);
      expect(res.body.data.points).toHaveLength(6);
    });

    it('should successfully fetch consultation status distribution', async () => {
      console.info(`
📝 USER STORY:
Title: View Consultation Status Distribution

As a super admin
I want to view the distribution of consultation statuses
So that I can see how many are completed, cancelled, etc.

📖 BDD SCENARIO: FETCH STATUS DISTRIBUTION
Feature: Admin Dashboard

Given I am logged in as a super admin
When I send a GET request to the consultation status distribution endpoint
Then I should receive the distribution data successfully
`);

      const res = await request(app)
        .get('/api/v1/admin/consultation-status-distribution?months=6')
        .set('Authorization', `Bearer ${testUsers.superAdminToken}`);

      logApi('GET', '/api/v1/admin/consultation-status-distribution?months=6', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-STATUS-DISTRIBUTION', 'Admin fetches consultation status distribution');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.period).toBeDefined();
      expect(res.body.data.period.months).toBe(6);
      expect(typeof res.body.data.total).toBe('number');
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items).toHaveLength(8);
      expect(res.body.data.items.every((item: { status: string; count: number }) => typeof item.count === 'number')).toBe(true);
    });

    it('should successfully fetch top consultants', async () => {
      console.info(`
📝 USER STORY:
Title: View Top Consultants

As a super admin
I want to view the top performing consultants
So that I can identify key experts on the platform

📖 BDD SCENARIO: FETCH TOP CONSULTANTS
Feature: Admin Dashboard

Given I am logged in as a super admin
When I send a GET request to the top consultants endpoint
Then I should receive the top consultants list successfully
`);

      const res = await request(app)
        .get('/api/v1/admin/top-consultants?limit=5')
        .set('Authorization', `Bearer ${testUsers.superAdminToken}`);

      logApi('GET', '/api/v1/admin/top-consultants?limit=5', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-TOP-CONSULTANTS', 'Admin fetches top consultants');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) {
        expect(res.body.data[0]).toHaveProperty('earnings');
        expect(typeof res.body.data[0].earnings).toBe('number');
      }
    });

    it('should successfully fetch recent activities', async () => {
      console.info(`
📝 USER STORY:
Title: View Recent Activities

As a super admin
I want to view recent activities on the platform
So that I can keep track of what's happening

📖 BDD SCENARIO: FETCH RECENT ACTIVITIES
Feature: Admin Dashboard

Given I am logged in as a super admin
When I send a GET request to the recent activities endpoint
Then I should receive the recent activities successfully
`);

      const res = await request(app)
        .get('/api/v1/admin/recent-activities?limit=10')
        .set('Authorization', `Bearer ${testUsers.superAdminToken}`);

      logApi('GET', '/api/v1/admin/recent-activities?limit=10', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-RECENT-ACTIVITIES', 'Admin fetches recent activities');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should successfully fetch recent consultations', async () => {
      console.info(`
📝 USER STORY:
Title: View Recent Consultations

As a super admin
I want to view recent consultations
So that I can monitor recent appointments and their payments

📖 BDD SCENARIO: FETCH RECENT CONSULTATIONS
Feature: Admin Dashboard

Given I am logged in as a super admin
When I send a GET request to the recent consultations endpoint
Then I should receive the recent consultations successfully
`);

      const res = await request(app)
        .get('/api/v1/admin/recent-consultations?limit=5')
        .set('Authorization', `Bearer ${testUsers.superAdminToken}`);

      logApi('GET', '/api/v1/admin/recent-consultations?limit=5', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-RECENT-CONSULTATIONS', 'Admin fetches recent consultations');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) {
        const first = res.body.data[0];
        expect(first).toHaveProperty('consultantName');
        expect(first).toHaveProperty('consultantImage');
        expect(first).toHaveProperty('patientName');
        expect(first).toHaveProperty('patientImage');
        expect(first).toHaveProperty('scheduledAt');
        expect(first).toHaveProperty('status');
        expect(first).toHaveProperty('paymentAmount');
      }
    });
  });
});
