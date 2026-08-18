import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { User } from '../modules/user/user.model';
import { USER_ROLES } from '../../enums/user';
import { StatusCodes } from 'http-status-codes';
import { logApi } from './testLogger';
import { startTestDb, stopTestDb } from './helpers/setupTestDb';
import { createTestUsers, TestUsers } from './helpers/createTestUsers';

vi.setConfig({ testTimeout: 60000 });

describe('Admin Management E2E Tests (Fixpair)', () => {
  let testUsers: TestUsers;
  let newConsultantId: string;
  let newConsultantToken: string;
  const newConsultantEmail = `new_consultant_${Date.now()}@test.com`;
  const newConsultantPassword = 'ConsultantPassword123!';

  beforeAll(async () => {
    await startTestDb();
    testUsers = await createTestUsers(app);
  });

  afterAll(async () => {
    await stopTestDb();
  });

  describe('Admin Authentication', () => {
    it('should successfully login as super admin', async () => {
      console.info(`
📝 USER STORY:
Title: Login With My Credentials

As a super admin
I want to login with my credentials
So that I can receive an access token and manage the system

📖 BDD SCENARIO: ADMIN LOGIN
Feature: Admin Auth

Given I am a super admin with valid credentials
When I send a POST request to the login endpoint
Then I should receive an access token and a success response
`);

      const payload = {
        email: testUsers.superAdminEmail,
        password: 'AdminPassword123!',
      };

      const res = await request(app).post('/api/v1/auth/login').send(payload);

      logApi(
        'POST',
        '/api/v1/auth/login',
        payload,
        res.body,
        'POST-ADMIN-LOGIN',
        'Admin logs in',
      );

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
    });
  });

  describe('Admin User Management (Consultant Creation)', () => {

    it('should create a consultant account that is auto-verified (No OTP required)', async () => {
      console.info(`
📝 USER STORY:
Title: Create A Consultant Account Directly

As an admin
I want to create a consultant account directly
So that they can bypass the email OTP verification and start immediately

💡 ARCHITECTURAL DECISION RECORD (ADR)

Title: Auto-Verify Consultant Creation

Decision 1: When an admin explicitly creates a consultant through the admin panel, the consultant is automatically marked as 'verified: true'.
Reason 1: To bypass the need for an admin to approve a consultant that the admin themselves just created, streamlining the onboarding flow for internal hires.

📖 BDD SCENARIO: CREATE CONSULTANT
Feature: Admin User Management

Given I am logged in as a super admin
When I send a POST request to create a Consultant user
Then the user should be created successfully with verified status set to true
`);
      const payload = {
        name: 'New Expert Consultant',
        email: newConsultantEmail,
        password: newConsultantPassword,
        role: USER_ROLES.CONSULTANT,
        consultancyType: '60d5ecb8b392d7211054a321', // advisor
        experience: '10 years',
        languages: ['English', 'French'],
        expertise: ['Business Strategy', 'Financial Planning'],
        bio: 'I am a senior advisor with a decade of experience.',
        perMinuteRate: 150,
        activeStatus: true,
      };

      const res = await request(app)
        .post('/api/v1/user')
        .set('Authorization', `Bearer ${testUsers.superAdminToken}`)
        .send(payload);

      logApi(
        'POST',
        '/api/v1/user',
        { headers: { Authorization: 'Bearer ***' }, body: payload },
        res.body,
        'POST-CREATE-CONSULTANT',
        'Admin creates a consultant',
      );

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);

      const createdUser = await User.findOne({ email: newConsultantEmail });
      expect(createdUser).toBeDefined();
      expect(createdUser?.role).toBe(USER_ROLES.CONSULTANT);
      expect(createdUser?.verified).toBe(true);
      newConsultantId = createdUser?._id.toString() || '';
    });

    it('should successfully login as the newly created consultant', async () => {
      console.info(`
📝 USER STORY:
Title: Log In Immediately With My Provided Credentials

As a newly created consultant
I want to log in immediately with my provided credentials
So that I can start using the platform without checking my email for an OTP

📖 BDD SCENARIO: CONSULTANT LOGIN
Feature: Consultant Auth

Given my account was just created by an admin
When I send a POST request to the login endpoint with my credentials
Then I should receive an access token because my account is already auto-verified
`);
      const payload = {
        email: newConsultantEmail,
        password: newConsultantPassword,
      };

      const res = await request(app).post('/api/v1/auth/login').send(payload);

      logApi(
        'POST',
        '/api/v1/auth/login',
        { body: payload },
        res.body,
        'POST-CONSULTANT-LOGIN',
        'Consultant logs in immediately',
      );

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      newConsultantToken = res.body.data.accessToken;
    });

    it('should get the consultant profile using the new access token', async () => {
      console.info(`
📝 USER STORY:
Title: View My Profile Details

As a logged-in consultant
I want to view my profile details
So that I can verify my account information is correct

📖 BDD SCENARIO: CONSULTANT PROFILE
Feature: Consultant Profile Management

Given I am logged in as a consultant
When I send a GET request to the profile endpoint
Then I should receive my profile details successfully
`);
      const res = await request(app)
        .get('/api/v1/user/profile')
        .set('Authorization', `Bearer ${newConsultantToken}`);

      logApi(
        'GET',
        '/api/v1/user/profile',
        { headers: { Authorization: 'Bearer ***' } },
        res.body,
        'GET-CONSULTANT-PROFILE',
        'Consultant views their own profile',
      );

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(newConsultantEmail);
    });

    it('should set consultant unavailability', async () => {
      console.info(`
📝 USER STORY:
Title: Set My Unavailable Time Slots

As an active consultant
I want to set my unavailable time slots
So that users cannot book consultations with me during these times

📖 BDD SCENARIO: SET UNAVAILABILITY
Feature: Consultant Unavailability

Given I am an active consultant
When I send a POST request to set my unavailability with specific time slots
Then my unavailability should be successfully updated
`);
      const payload = {
        slots: [
          {
            date: new Date().toISOString().split('T')[0],
            startTime: '10:00',
            endTime: '12:00',
          },
        ],
      };

      const res = await request(app)
        .post('/api/v1/consultation/unavailability')
        .set('Authorization', `Bearer ${newConsultantToken}`)
        .send(payload);

      logApi(
        'POST',
        '/api/v1/consultation/unavailability',
        { headers: { Authorization: 'Bearer ***' }, body: payload },
        res.body,
        'POST-CONSULTANT-UNAVAILABILITY',
        'Consultant sets their unavailability',
      );

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
    });

    it("should get the consultant's own availability setup", async () => {
      console.info(`
📝 USER STORY:
Title: View My Own Unavailable Time Slots That I Just Set Up

As an active consultant
I want to view my own unavailable time slots that I just set up
So that I can verify my schedule is correctly configured

📖 BDD SCENARIO: VIEW OWN UNAVAILABILITY
Feature: Consultant Unavailability

Given I have already set my unavailability
When I send a GET request to fetch my own unavailability
Then I should see the list of slots I configured
`);
      const res = await request(app)
        .get('/api/v1/consultation/unavailability')
        .set('Authorization', `Bearer ${newConsultantToken}`);

      logApi(
        'GET',
        '/api/v1/consultation/unavailability',
        { headers: { Authorization: 'Bearer ***' } },
        res.body,
        'GET-MY-UNAVAILABILITY',
        'Consultant views their own unavailability',
      );

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.slots)).toBe(true);
      expect(res.body.data.slots.length).toBeGreaterThan(0);
    });

    it('should get consultant available slots', async () => {
      console.info(`
📝 USER STORY:
Title: View A Consultant's Available Time Slots

As a platform user
I want to view a consultant's available time slots
So that I can choose a suitable time for my consultation

📖 BDD SCENARIO: VIEW AVAILABLE SLOTS
Feature: Consultation Booking

Given a consultant has set their availability
When I send a GET request to fetch available slots for that consultant
Then I should see a list of their available and booked slots
`);
      const res = await request(app).get(
        `/api/v1/consultation/available-slots/${newConsultantId}`,
      );

      logApi(
        'GET',
        `/api/v1/consultation/available-slots/${newConsultantId}`,
        {},
        res.body,
        'GET-CONSULTANT-SLOTS',
        'Get available slots for a consultant',
      );

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.unavailableSlots)).toBe(true);
      expect(Array.isArray(res.body.data.bookedSlots)).toBe(true);
    });

    it('should toggle consultant online/offline status', async () => {
      console.info(`
📝 USER STORY:
Title: Toggle My Online/offline Status

As an active consultant
I want to toggle my online/offline status
So that users know if I am available right now

📖 BDD SCENARIO: TOGGLE STATUS
Feature: Consultant Status Management

Given I am an active consultant
When I send a PATCH request to toggle my status to offline
Then my status should be updated successfully
`);
      const payload = { activeStatus: false };

      const res = await request(app)
        .patch('/api/v1/user/toggle-status')
        .set('Authorization', `Bearer ${newConsultantToken}`)
        .send(payload);

      logApi(
        'PATCH',
        '/api/v1/user/toggle-status',
        { headers: { Authorization: 'Bearer ***' }, body: payload },
        res.body,
        'PATCH-TOGGLE-STATUS',
        'Consultant toggles their status to offline',
      );

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.activeStatus).toBe(false);
    });

    it('should fetch all consultations across the system as an admin', async () => {
      console.info(`
📝 USER STORY:
Title: View All Consultations

As a super admin
I want to view all consultations
So that I can monitor the system's booking activity

📖 BDD SCENARIO: VIEW ALL CONSULTATIONS
Feature: Admin Consultation Management

Given I am logged in as a super admin
When I send a GET request to fetch bookings
Then I should receive a list of all consultations in the system
`);
      const res = await request(app)
        .get('/api/v1/consultation/my-bookings')
        .set('Authorization', `Bearer ${testUsers.superAdminToken}`);

      logApi(
        'GET',
        '/api/v1/consultation/my-bookings',
        { headers: { Authorization: 'Bearer ***' } },
        res.body,
        'GET-ALL-CONSULTATIONS',
        'Admin fetches all system consultations',
      );

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should fetch user details by id as admin', async () => {
      console.info(`
📝 USER STORY:
Title: View A Specific User's Details

As a super admin
I want to view a specific user's details
So that I can see their full profile information

📖 BDD SCENARIO: VIEW USER DETAILS
Feature: Admin User Management

Given I am logged in as a super admin
When I send a GET request to fetch user details by ID
Then I should receive the user's details successfully
`);
      const res = await request(app)
        .get(`/api/v1/user/${newConsultantId}`)
        .set('Authorization', `Bearer ${testUsers.superAdminToken}`);

      logApi(
        'GET',
        `/api/v1/user/${newConsultantId}`,
        { headers: { Authorization: 'Bearer ***' } },
        res.body,
        'GET-USER-DETAILS',
        'Admin fetches specific user details',
      );

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(newConsultantId);
      expect(res.body.data.email).toBe(newConsultantEmail);
    });
  });
});
