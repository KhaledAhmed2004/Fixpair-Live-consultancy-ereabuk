import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app';
import { StatusCodes } from 'http-status-codes';
import { logApi } from './testLogger';
import { startTestDb, stopTestDb } from './helpers/setupTestDb';
import { createTestUsers, TestUsers } from './helpers/createTestUsers';
import { Consultation } from '../modules/consultation/consultation.model';
import { VideoSession } from '../modules/videoSession/videoSession.model';
import config from '../../config';

vi.setConfig({ testTimeout: 60000 });

describe('Report Module E2E Tests (Fixpair)', () => {
  let testUsers: TestUsers;
  let consultationId: string;
  let reportId: string;

  beforeAll(async () => {
    await startTestDb();
    testUsers = await createTestUsers(app);

    // Fetch normal user to get ID
    const normalUser = await mongoose.model('User').findOne({ email: testUsers.normalUserEmail });
    const normalUserId = normalUser._id;

    // Create a mock completed consultation
    const consultation = await Consultation.create({
      user: normalUserId,
      consultant: testUsers.consultantId,
      bookingType: 'instant',
      perMinuteRate: 5,
      platformFee: 2,
      status: 'completed',
      billingStatus: 'completed',
      paymentStatus: 'paid',
    });
    consultationId = consultation._id.toString();

    // Create a mock video session for it
    await VideoSession.create({
      consultation: consultation._id,
      user: normalUserId,
      consultant: testUsers.consultantId,
      channelName: `test_channel_${Date.now()}`,
      token: 'mock_token',
      startedAt: new Date(Date.now() - 30 * 60000), // 30 mins ago
      endedAt: new Date(),
    });
  });

  afterAll(async () => {
    await stopTestDb();
  });

  describe('Report Generation Flow', () => {
    it('should fetch the consultant\'s completed bookings (initial state without report)', async () => {
      console.info(`
📝 USER STORY:
Title: View Completed Consultations

As a consultant
I want to view my past completed bookings
So that I can see which consultations need a report to be generated

📖 BDD SCENARIO: GET MY BOOKINGS WITH REPORT STATUS
Feature: Consultation History

Given I am logged in as a consultant
When I fetch my completed bookings
Then the response should include my past consultations, and initially show no report has been generated
`);
      const res = await request(app)
        .get('/api/v1/consultation/my-bookings?status=completed')
        .set('Authorization', `Bearer ${testUsers.consultantToken}`);

      logApi('GET', '/api/v1/consultation/my-bookings?status=completed', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-MY-BOOKINGS-INITIAL', 'Consultant fetches bookings before report creation');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      
      const booking = res.body.data.find((b: any) => b._id.toString() === consultationId);
      expect(booking).toBeDefined();
      expect(booking.report).toBeNull(); // No report generated yet
    });

    it('should allow a consultant to generate a report for a completed consultation', async () => {
      console.info(`
📝 USER STORY:
Title: Generate Consultation Report

As a consultant
I want to submit a report for a completed consultation
So that my client receives a summary PDF with notes and links

📖 BDD SCENARIO: CREATE CONSULTATION REPORT
Feature: Report Management

Given a consultation has ended and is marked as completed
When the consultant sends a POST request to /report with notes
Then the backend should generate a PDF report and save it successfully
`);
      const payload = {
        consultationId,
        summary: 'Comprehensive frontend audit and state management refactoring session.',
        keyPoints: [
          'Identified redundant re-renders in Chat component',
          'Audited JWT token refresh mechanism',
        ],
        stepsTaken: [
          'Installed React Profiler to pinpoint heavy components',
          'Restructured Auth middleware policies',
        ],
        recommendedProducts: [
          {
            name: 'Datadog APM',
            price: '$15/month',
            buyLink: 'https://datadoghq.com',
          },
          {
            name: 'Redis Enterprise Cloud',
            price: '$50/month',
            buyLink: 'https://redis.com',
          },
        ],
        notes: 'This was a very productive session about frontend architecture.',
        links: ['https://reactjs.org', 'https://nodejs.org'],
        images: ['https://example.com/diagram.png'],
      };

      const res = await request(app)
        .post('/api/v1/report')
        .set('Authorization', `Bearer ${testUsers.consultantToken}`)
        .send(payload);

      logApi('POST', '/api/v1/report', { headers: { Authorization: 'Bearer ***' }, body: payload }, res.body, 'POST-CREATE-REPORT', 'Consultant creates a report');

      expect(res.status).toBe(StatusCodes.CREATED);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pdfUrl).toBeDefined();
      expect(res.body.data.summary).toBe(payload.summary);
      expect(res.body.data.keyPoints).toHaveLength(2);
      expect(res.body.data.stepsTaken).toHaveLength(2);
      expect(res.body.data.recommendedProducts).toHaveLength(2);
      expect(res.body.data.recommendedProducts[0].name).toBe('Datadog APM');

      reportId = res.body.data._id;
    });

    it('should fetch the consultant\'s bookings and populate the report field', async () => {
      console.info(`
📝 USER STORY:
Title: View Consultation History and Report Status

As a consultant
I want to view my past bookings after generating a report
So that I can verify the report is attached to the correct consultation

📖 BDD SCENARIO: GET MY BOOKINGS AFTER REPORT CREATION
Feature: Consultation History

Given a report has been successfully generated
When I fetch my completed bookings
Then the response should include my past consultations along with their generated report ID and PDF URL
`);
      const res = await request(app)
        .get('/api/v1/consultation/my-bookings?status=completed')
        .set('Authorization', `Bearer ${testUsers.consultantToken}`);

      logApi('GET', '/api/v1/consultation/my-bookings?status=completed', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-MY-BOOKINGS-REPORT', 'Consultant fetches bookings with populated report');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      
      const booking = res.body.data.find((b: any) => b._id.toString() === consultationId);
      expect(booking).toBeDefined();
      expect(booking.report).toBeDefined();
      expect(booking.report._id.toString()).toBe(reportId);
      expect(booking.report.pdfUrl).toBeDefined();
    });

    it('should fetch reports list', async () => {
      console.info(`
📝 USER STORY:
Title: List All My Reports

As a consultant
I want to view all reports I have generated
So that I can easily access past summaries

📖 BDD SCENARIO: GET ALL REPORTS
Feature: Report Management

Given I am logged in as a consultant
When I request a list of my reports
Then I should receive an array of all my generated reports
`);
      const res = await request(app)
        .get('/api/v1/report')
        .set('Authorization', `Bearer ${testUsers.consultantToken}`);

      logApi('GET', '/api/v1/report', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-ALL-REPORTS', 'Consultant fetches all their reports');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].notes).toBeDefined();
    });

    it('should fetch a single report by ID as a consultant', async () => {
      const res = await request(app)
        .get(`/api/v1/report/${reportId}`)
        .set('Authorization', `Bearer ${testUsers.consultantToken}`);

      logApi('GET', `/api/v1/report/${reportId}`, { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-SINGLE-REPORT-CONSULTANT', 'Consultant fetches a single report by ID');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id.toString()).toBe(reportId);
    });

    it('should fetch a single report by ID as the normal user', async () => {
      console.info(`
📝 USER STORY:
Title: View My Consultation Report

As a user
I want to view a specific report generated for my consultation
So that I can see the summary, notes, and download the PDF

📖 BDD SCENARIO: GET SINGLE REPORT (USER)
Feature: Report Management

Given a report has been successfully generated for my consultation
When I request the report by its ID
Then I should receive the report details successfully
`);
      const res = await request(app)
        .get(`/api/v1/report/${reportId}`)
        .set('Authorization', `Bearer ${testUsers.normalUserToken}`);

      logApi('GET', `/api/v1/report/${reportId}`, { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-SINGLE-REPORT-USER', 'Normal user fetches their specific report by ID');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id.toString()).toBe(reportId);
      expect(res.body.data.pdfUrl).toBeDefined();
    });

    it('should NOT allow creating a report if already exists', async () => {
      const payload = {
        consultationId,
        notes: 'Duplicate attempt',
      };

      const res = await request(app)
        .post('/api/v1/report')
        .set('Authorization', `Bearer ${testUsers.consultantToken}`)
        .send(payload);

      logApi('POST', '/api/v1/report', { headers: { Authorization: 'Bearer ***' }, body: payload }, res.body, 'POST-CREATE-REPORT-DUPLICATE', 'Consultant tries to create a duplicate report');

      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
      expect(res.body.message).toMatch(/Report already exists/i);
    });

    it('should NOT allow a normal user to create a report', async () => {
      const payload = {
        consultationId,
        notes: 'User attempt',
      };

      const res = await request(app)
        .post('/api/v1/report')
        .set('Authorization', `Bearer ${testUsers.normalUserToken}`)
        .send(payload);

      logApi('POST', '/api/v1/report', { headers: { Authorization: 'Bearer ***' }, body: payload }, res.body, 'POST-CREATE-REPORT-UNAUTHORIZED', 'Normal user tries to create a report');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
    });
  });

  describe('AI Consultation Summary Flow', () => {
    it('should fetch or generate the AI summary for a consultation via GET', async () => {
      console.info(`
📝 USER STORY:
Title: View AI Generated Consultation Summary

As a user or consultant
I want to view the AI-generated structured summary after a consultation ends
So that I can quickly review key discussion points, action items, and recommendations

📖 BDD SCENARIO: GET AI CONSULTATION SUMMARY
Feature: AI Consultation Summary

Given a completed consultation
When I send a GET request to /api/v1/report/ai-summary/:consultationId
Then the backend should return a structured AI summary with overview, keyPoints, actionItems, and recommendations
`);
      const res = await request(app)
        .get(`/api/v1/report/ai-summary/${consultationId}`)
        .set('Authorization', `Bearer ${testUsers.normalUserToken}`);

      logApi('GET', `/api/v1/report/ai-summary/${consultationId}`, { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-AI-SUMMARY', 'User fetches AI consultation summary');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.overview).toBeDefined();
      expect(Array.isArray(res.body.data.keyPoints)).toBe(true);
      expect(Array.isArray(res.body.data.actionItems)).toBe(true);
      expect(Array.isArray(res.body.data.recommendations)).toBe(true);
    });

    it('should allow consultant to trigger AI summary via POST', async () => {
      console.info(`
📝 USER STORY:
Title: Trigger/Regenerate AI Consultation Summary

As a consultant
I want to trigger AI summary generation for a consultation
So that I have the latest summary ready before finalizing the report

📖 BDD SCENARIO: POST AI CONSULTATION SUMMARY
Feature: AI Consultation Summary

Given a completed consultation
When the consultant sends a POST request to /api/v1/report/ai-summary/:consultationId
Then the backend should generate and return the AI summary
`);
      const res = await request(app)
        .post(`/api/v1/report/ai-summary/${consultationId}`)
        .set('Authorization', `Bearer ${testUsers.consultantToken}`)
        .send({});

      logApi('POST', `/api/v1/report/ai-summary/${consultationId}`, { headers: { Authorization: 'Bearer ***' } }, res.body, 'POST-AI-SUMMARY', 'Consultant triggers AI summary');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.overview).toBeDefined();
    });

    it('should allow consultant to update report and regenerate PDF', async () => {
      console.info(`
📝 USER STORY:
Title: Update Consultation Report
As a consultant
I want to edit and update my consultation report
So that any corrections or additional recommendations are reflected in the report and PDF

📖 BDD SCENARIO: PATCH CONSULTATION REPORT
Feature: Consultation Report Edit
Given an existing finalized report
When the consultant sends a PATCH request to /api/v1/report/:id with updated summary and recommendations
Then the backend should update the report fields, regenerate the PDF, and return the updated report
`);
      const updatePayload = {
        summary: 'Updated summary: frontend profiling completed with extra state tuning.',
        notes: 'Updated consultant notes regarding memory leaks and component memoization.',
        keyPoints: [
          'Fixed re-renders with React.memo',
          'Audited JWT expiration',
          'Added Redis caching layer',
        ],
        recommendedProducts: [
          {
            name: 'Datadog Pro APM',
            price: '$35/month',
            buyLink: 'https://datadoghq.com',
          },
        ],
      };

      const res = await request(app)
        .patch(`/api/v1/report/${reportId}`)
        .set('Authorization', `Bearer ${testUsers.consultantToken}`)
        .send(updatePayload);

      logApi('PATCH', `/api/v1/report/${reportId}`, { headers: { Authorization: 'Bearer ***' }, body: updatePayload }, res.body, 'PATCH-UPDATE-REPORT', 'Consultant updates report');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary).toBe(updatePayload.summary);
      expect(res.body.data.notes).toBe(updatePayload.notes);
      expect(res.body.data.keyPoints).toHaveLength(3);
      expect(res.body.data.recommendedProducts).toHaveLength(1);
      expect(res.body.data.recommendedProducts[0].name).toBe('Datadog Pro APM');
      expect(res.body.data.pdfUrl).toBeDefined();
    });

    it('should reject report update if unauthorized user attempts it', async () => {
      const res = await request(app)
        .patch(`/api/v1/report/${reportId}`)
        .set('Authorization', `Bearer ${testUsers.normalUserToken}`)
        .send({ summary: 'Malicious update attempt' });

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('should return 404 if updating a non-existent report', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .patch(`/api/v1/report/${fakeId}`)
        .set('Authorization', `Bearer ${testUsers.consultantToken}`)
        .send({ summary: 'Update non existent report' });

      expect(res.status).toBe(StatusCodes.NOT_FOUND);
    });
  });
});
