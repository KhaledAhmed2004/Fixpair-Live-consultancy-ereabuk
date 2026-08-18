import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { StatusCodes } from 'http-status-codes';
import { logApi } from './testLogger';
import { startTestDb, stopTestDb } from './helpers/setupTestDb';
import { createTestUsers, TestUsers } from './helpers/createTestUsers';
import { Transaction } from '../modules/payment/payment.model';

vi.setConfig({ testTimeout: 60000 });

describe('Earnings & Payout APIs E2E Tests', () => {
  let testUsers: TestUsers;

  beforeAll(async () => {
    await startTestDb();
    testUsers = await createTestUsers(app);

    // Create a mock consultation first so it has a valid reference
    const mockConsultationId = testUsers.normalUserId; // Just reusing an ObjectId for the mock

    // Mock a transaction so that endpoints have some data to work with
    await Transaction.create({
      consultation: mockConsultationId,
      user: testUsers.normalUserId,
      consultant: testUsers.consultantId,
      amount: 1500,
      currency: 'usd',
      status: 'captured',
      type: 'charge',
      provider: 'stripe',
      transactionId: 'pi_test_123',
    });
  });

  afterAll(async () => {
    await stopTestDb();
  });

  describe('Admin Revenue APIs', () => {
    it('GET /api/v1/admin/revenue-summary - should calculate total platform revenue', async () => {
      console.info(`
📝 USER STORY:
Title: View Total Platform Revenue

As a super admin
I want to see the total revenue the platform has generated
So that I can evaluate the financial health of the business

📖 BDD SCENARIO: FETCH REVENUE SUMMARY
Feature: Platform Revenue Tracking

Given I am logged in as an Admin
When I send a GET request to /api/v1/admin/revenue-summary
Then it should aggregate all 'captured' transactions
And return the total lifetime and current month revenue
      `);

      const res = await request(app)
        .get('/api/v1/admin/revenue-summary')
        .set('Authorization', `Bearer ${testUsers.superAdminToken}`);

      logApi(
        'GET',
        '/api/v1/admin/revenue-summary',
        null,
        res.body,
        'GET-REVENUE-SUMMARY',
        'Admin retrieves revenue summary',
      );

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalLifetimeRevenue');
      expect(res.body.data).toHaveProperty('currentMonthRevenue');
    });

    it('GET /api/v1/admin/top-consultants - should aggregate earnings by consultant', async () => {
      console.info(`
📝 USER STORY:
Title: Identify Top Earning Consultants

As a super admin
I want to see a list of top earning consultants
So that I can reward them or analyze platform usage

📖 BDD SCENARIO: FETCH TOP CONSULTANTS
Feature: Top Consultants Earnings

Given I am logged in as an Admin
When I send a GET request to /api/v1/admin/top-consultants
Then it calculates each consultant's earnings by aggregating their captured transactions
And maps the total earnings to the respective consultant profile
      `);

      const res = await request(app)
        .get('/api/v1/admin/top-consultants')
        .set('Authorization', `Bearer ${testUsers.superAdminToken}`);

      logApi(
        'GET',
        '/api/v1/admin/top-consultants',
        null,
        res.body,
        'GET-TOP-CONSULTANTS',
        'Admin retrieves top consultants',
      );

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/v1/admin/transactions - should return paginated transaction history', async () => {
      console.info(`
📝 USER STORY:
Title: View All Transactions

As a super admin
I want to view a detailed history of all transactions
So that I can monitor individual session earnings and audits

📖 BDD SCENARIO: FETCH ALL TRANSACTIONS
Feature: Global Transaction History

Given I am logged in as an Admin
When I send a GET request to /api/v1/admin/transactions
Then it returns a paginated list of all transactions
And populates the related consultation, user, and consultant details
      `);

      const res = await request(app)
        .get('/api/v1/admin/transactions')
        .set('Authorization', `Bearer ${testUsers.superAdminToken}`);

      logApi(
        'GET',
        '/api/v1/admin/transactions',
        null,
        res.body,
        'GET-ALL-TRANSACTIONS',
        'Admin retrieves all transactions',
      );

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('Consultant Overview Earnings APIs', () => {
    it('GET /api/v1/consultant/dashboard-summary - should include total earnings', async () => {
      console.info(`
📝 USER STORY:
Title: Consultant Views Total Earnings

As a consultant
I want to see my total earnings on my dashboard summary
So that I know how much I have earned from my consultations

📖 BDD SCENARIO: CONSULTANT DASHBOARD EARNINGS
Feature: Consultant Earnings Summary

Given I am logged in as a Consultant
When I send a GET request to /api/v1/consultant/dashboard-summary
Then the backend aggregates my own captured transactions
And includes the 'totalEarnings' metric with percentage growth in the response
      `);

      const res = await request(app)
        .get('/api/v1/consultant/dashboard-summary')
        .set('Authorization', `Bearer ${testUsers.consultantToken}`);

      logApi(
        'GET',
        '/api/v1/consultant/dashboard-summary',
        null,
        res.body,
        'GET-CONSULTANT-DASHBOARD',
        'Consultant retrieves dashboard summary',
      );

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalEarnings');
      expect(res.body.data.totalEarnings).toHaveProperty('value');
    });

    it('GET /api/v1/consultant/my-transactions - should provide transaction history', async () => {
      console.info(`
📝 USER STORY:
Title: Consultant Views Detailed Transactions

As a consultant
I want to see my detailed transaction history
So that I can track earnings per session and verify my income

📖 BDD SCENARIO: CONSULTANT TRANSACTION HISTORY
Feature: Consultant Transaction History

Given I am logged in as a Consultant
When I send a GET request to /api/v1/consultant/my-transactions
Then the backend returns a paginated list of my own transactions
And populates the patient details and consultation data
      `);

      const res = await request(app)
        .get('/api/v1/consultant/my-transactions')
        .set('Authorization', `Bearer ${testUsers.consultantToken}`);

      logApi(
        'GET',
        '/api/v1/consultant/my-transactions',
        null,
        res.body,
        'GET-MY-TRANSACTIONS',
        'Consultant retrieves transaction history',
      );

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
