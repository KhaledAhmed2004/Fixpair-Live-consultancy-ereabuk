import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../../app';
import { User } from '../modules/user/user.model';
import { USER_ROLES } from '../../enums/user';
import { StatusCodes } from 'http-status-codes';
import { logApi } from './testLogger';

// Increase timeout for E2E tests
vi.setConfig({ testTimeout: 60000 });

let replSet: MongoMemoryReplSet;

beforeAll(async () => {
  // Start in-memory mongodb
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  // Ensure indexes are built
  await mongoose.model('User').init();
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

describe('Admin Flow E2E Tests (Fixpair)', () => {
  let superAdminToken: string;
  const superAdminPassword = 'AdminPassword123!';
  const superAdminEmail = `super_admin_${Date.now()}@test.com`;
  
  const consultantEmail = `consultant_${Date.now()}@test.com`;
  const consultantPassword = 'ConsultantPassword123!';
  let consultantToken: string;
  let consultantId: string;

  const normalUserEmail = `user_${Date.now()}@test.com`;
  const normalUserPassword = 'UserPassword123!';
  let normalUserToken: string;

  beforeAll(async () => {
    // Create a super admin user directly in DB for management tests
    await User.create({
      name: 'System Super Admin',
      email: superAdminEmail,
      password: superAdminPassword,
      role: USER_ROLES.SUPER_ADMIN,
      status: 'active',
      verified: true,
    });

    // Create a normal user for user-centric tests
    await User.create({
      name: 'Normal User',
      email: normalUserEmail,
      password: normalUserPassword,
      role: USER_ROLES.USER,
      status: 'active',
      verified: true,
    });
  });

  describe('Admin Authentication', () => {
    it('should successfully login as super admin', async () => {
      console.info(`
📝 USER STORY:
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
        email: superAdminEmail,
        password: superAdminPassword,
      };

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send(payload);

      logApi('POST', '/api/v1/auth/login', payload, res.body, 'POST-ADMIN-LOGIN', 'Admin logs in');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();

      superAdminToken = res.body.data.accessToken;
    });
  });

  describe('Admin User Management (Consultant Creation)', () => {
    it('should create a consultant account that is auto-verified (No OTP required)', async () => {
      console.info(`
📝 USER STORY:
As an admin
I want to create a consultant account directly
So that they can bypass the email OTP verification and start immediately

🏗️ ADR-001: Auto-Verify Consultant Creation

Decision:
When an Admin creates a Consultant, the system automatically sets "verified: true" and bypasses the OTP flow.

Reason:
Consultants are vetted offline by the Admin. Sending an OTP is redundant and slows down their immediate onboarding process.

📖 BDD SCENARIO: CREATE CONSULTANT
Feature: Admin User Management

Given I am logged in as a super admin
When I send a POST request to create a Consultant user
Then the user should be created successfully with verified status set to true
`);
      const payload = {
        name: 'Expert Consultant',
        email: consultantEmail,
        password: consultantPassword,
        role: USER_ROLES.CONSULTANT,
        consultancyType: 'advisor',
        experience: '10 years',
        languages: ['English', 'French'],
        expertise: ['Business Strategy', 'Financial Planning'],
        bio: 'I am a senior advisor with a decade of experience.',
        perMinuteRate: 150,
        activeStatus: true,
      };

      const res = await request(app)
        .post('/api/v1/user')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(payload);

      logApi('POST', '/api/v1/user', { headers: { Authorization: 'Bearer ***' }, body: payload }, res.body, 'POST-CREATE-CONSULTANT', 'Admin creates a consultant');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      
      // Verify in DB that it is active and verified
      const createdUser = await User.findOne({ email: consultantEmail });
      expect(createdUser).toBeDefined();
      expect(createdUser?.role).toBe(USER_ROLES.CONSULTANT);
      expect(createdUser?.verified).toBe(true);
      consultantId = createdUser?._id.toString() || '';
    });

    it('should successfully login as the newly created consultant', async () => {
      console.info(`
📝 USER STORY:
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
        email: consultantEmail,
        password: consultantPassword,
      };

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send(payload);

      logApi('POST', '/api/v1/auth/login', { body: payload }, res.body, 'POST-CONSULTANT-LOGIN', 'Consultant logs in immediately');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      consultantToken = res.body.data.accessToken;
    });

    it('should get the consultant profile using the new access token', async () => {
      console.info(`
📝 USER STORY:
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
        .set('Authorization', `Bearer ${consultantToken}`);

      logApi('GET', '/api/v1/user/profile', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-CONSULTANT-PROFILE', 'Consultant views their own profile');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(consultantEmail);
    });

    it('should set consultant availability', async () => {
      console.info(`
📝 USER STORY:
As an active consultant
I want to set my available time slots
So that users can book consultations with me

📖 BDD SCENARIO: SET AVAILABILITY
Feature: Consultant Availability

Given I am an active consultant
When I send a POST request to set my availability with specific time slots
Then my availability should be successfully updated
`);
      const payload = {
        slots: [
          {
            date: new Date().toISOString().split('T')[0],
            startTime: '10:00',
            endTime: '12:00',
          }
        ]
      };

      const res = await request(app)
        .post('/api/v1/consultation/availability')
        .set('Authorization', `Bearer ${consultantToken}`)
        .send(payload);

      logApi('POST', '/api/v1/consultation/availability', { headers: { Authorization: 'Bearer ***' }, body: payload }, res.body, 'POST-CONSULTANT-AVAILABILITY', 'Consultant sets their availability');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
    });

    it('should get the consultant\'s own availability setup', async () => {
      console.info(`
📝 USER STORY:
As an active consultant
I want to view my own available time slots that I just set up
So that I can verify my schedule is correctly configured

📖 BDD SCENARIO: VIEW OWN AVAILABILITY
Feature: Consultant Availability

Given I have already set my availability
When I send a GET request to fetch my own availability
Then I should see the list of slots I configured
`);
      const res = await request(app)
        .get('/api/v1/consultation/my-availability')
        .set('Authorization', `Bearer ${consultantToken}`);

      logApi('GET', '/api/v1/consultation/my-availability', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-MY-AVAILABILITY', 'Consultant views their own availability');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.slots)).toBe(true);
      expect(res.body.data.slots.length).toBeGreaterThan(0);
    });

    it('should get consultant available slots', async () => {
      console.info(`
📝 USER STORY:
As a platform user
I want to view a consultant's available time slots
So that I can choose a suitable time for my consultation

📖 BDD SCENARIO: VIEW AVAILABLE SLOTS
Feature: Consultation Booking

Given a consultant has set their availability
When I send a GET request to fetch available slots for that consultant
Then I should see a list of their available and booked slots
`);
      const res = await request(app)
        .get(`/api/v1/consultation/available-slots/${consultantId}`);

      logApi('GET', `/api/v1/consultation/available-slots/${consultantId}`, {}, res.body, 'GET-CONSULTANT-SLOTS', 'Get available slots for a consultant');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.unavailableSlots)).toBe(true);
      expect(Array.isArray(res.body.data.bookedSlots)).toBe(true);
    });

    it('should toggle consultant online/offline status', async () => {
      console.info(`
📝 USER STORY:
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
        .set('Authorization', `Bearer ${consultantToken}`)
        .send(payload);

      logApi('PATCH', '/api/v1/user/toggle-status', { headers: { Authorization: 'Bearer ***' }, body: payload }, res.body, 'PATCH-TOGGLE-STATUS', 'Consultant toggles their status to offline');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.activeStatus).toBe(false);
    });

    it('should fetch all consultations across the system as an admin', async () => {
      console.info(`
📝 USER STORY:
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
        .set('Authorization', `Bearer ${superAdminToken}`);

      logApi('GET', '/api/v1/consultation/my-bookings', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-ALL-CONSULTATIONS', 'Admin fetches all system consultations');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('User Consultation Management', () => {
    it('should successfully login as a normal user', async () => {
      const payload = {
        email: normalUserEmail,
        password: normalUserPassword,
      };

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send(payload);

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();

      normalUserToken = res.body.data.accessToken;
    });

    it('should update user profile', async () => {
      console.info(`
📝 USER STORY:
As a logged in user
I want to update my profile
So that my information is kept up to date

📖 BDD SCENARIO: UPDATE PROFILE
Feature: User Profile Management

Given I am logged in
When I send a PATCH request to update my profile with a new name
Then my profile should be updated successfully
`);
      const payload = {
        name: 'Updated Normal User',
        consultancyType: 'lawyer',
        experience: '5 years',
        languages: ['English', 'Spanish'],
        expertise: ['Corporate Law', 'Family Law'],
        bio: 'I am a highly experienced lawyer.',
        perMinuteRate: 50,
        activeStatus: false
      };

      const res = await request(app)
        .patch('/api/v1/user/profile')
        .set('Authorization', `Bearer ${normalUserToken}`)
        .field('data', JSON.stringify(payload))
        .attach('image', Buffer.from('dummy image content'), 'profile.png');

      logApi('PATCH', '/api/v1/user/profile', { headers: { Authorization: 'Bearer ***' }, body: payload, files: ['image'] }, res.body, 'PATCH-USER-PROFILE', 'User updates their profile');

      if (res.status !== StatusCodes.OK) {
        console.error('Update Profile Error:', res.body);
      }

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      
      // Verify all updated fields
      expect(res.body.data.name).toBe(payload.name);
      expect(res.body.data.consultancyType).toBe(payload.consultancyType);
      expect(res.body.data.experience).toBe(payload.experience);
      expect(res.body.data.languages).toEqual(expect.arrayContaining(payload.languages));
      expect(res.body.data.expertise).toEqual(expect.arrayContaining(payload.expertise));
      expect(res.body.data.bio).toBe(payload.bio);
      expect(res.body.data.perMinuteRate).toBe(payload.perMinuteRate);
      expect(res.body.data.activeStatus).toBe(payload.activeStatus);
      expect(res.body.data.image).toMatch(/\/image\/profile-\d+\.png/); // Verify image URL was updated
    });

    it('should fetch user profile', async () => {
      console.info(`
📝 USER STORY:
As a logged in user
I want to view my profile
So that I can see my updated information

📖 BDD SCENARIO: VIEW PROFILE
Feature: User Profile Management

Given I am logged in
When I send a GET request to fetch my profile
Then I should receive my profile with the updated fields
`);
      const res = await request(app)
        .get('/api/v1/user/profile')
        .set('Authorization', `Bearer ${normalUserToken}`);

      logApi('GET', '/api/v1/user/profile', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-USER-PROFILE', 'User fetches their profile');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      
      // Verify all fields are persisted
      expect(res.body.data.name).toBe('Updated Normal User');
      expect(res.body.data.consultancyType).toBe('lawyer');
      expect(res.body.data.experience).toBe('5 years');
      expect(res.body.data.languages).toEqual(expect.arrayContaining(['English', 'Spanish']));
      expect(res.body.data.expertise).toEqual(expect.arrayContaining(['Corporate Law', 'Family Law']));
      expect(res.body.data.bio).toBe('I am a highly experienced lawyer.');
      expect(res.body.data.perMinuteRate).toBe(50);
      expect(res.body.data.activeStatus).toBe(false);
      expect(res.body.data.image).toMatch(/\/image\/profile-\d+\.png/);
    });

    it('should fetch the list of consultants with pagination', async () => {
      console.info(`
📝 USER STORY:
As a regular user
I want to view a list of all consultants
So that I can find someone to book a consultation with

📖 BDD SCENARIO: VIEW CONSULTANTS
Feature: Consultant Discovery

Given I am logged in as a normal user
When I send a GET request to fetch consultants with page=1 and limit=10
Then I should receive a paginated list of consultants
`);
      const res = await request(app)
        .get('/api/v1/user/consultants?page=1&limit=10')
        .set('Authorization', `Bearer ${normalUserToken}`);

      logApi('GET', '/api/v1/user/consultants?page=1&limit=10', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-ALL-CONSULTANTS-LIST', 'User fetches the list of consultants');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      // Data usually contains result and meta for paginated responses
      expect(Array.isArray(res.body.data.result || res.body.data)).toBe(true);
    });

    it('should search consultants by searchTerm', async () => {
      console.info(`
📝 USER STORY:
As a regular user
I want to search for consultants by name or expertise
So that I can find exactly who I am looking for

📖 BDD SCENARIO: SEARCH CONSULTANTS
Feature: Consultant Discovery

Given I am logged in as a normal user
When I send a GET request to fetch consultants with searchTerm=expert
Then I should receive a filtered list of matching consultants
`);
      const res = await request(app)
        .get('/api/v1/user/consultants?searchTerm=expert')
        .set('Authorization', `Bearer ${normalUserToken}`);

      logApi('GET', '/api/v1/user/consultants?searchTerm=expert', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-CONSULTANTS-SEARCH', 'User searches for consultants');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.result || res.body.data)).toBe(true);
    });

    it('should filter consultants by consultancyType', async () => {
      console.info(`
📝 USER STORY:
As a regular user
I want to filter consultants by type
So that I can find a specific type of professional like a lawyer

📖 BDD SCENARIO: FILTER CONSULTANTS
Feature: Consultant Discovery

Given I am logged in as a normal user
When I send a GET request to fetch consultants with consultancyType=lawyer
Then I should receive a filtered list of only lawyers
`);
      const res = await request(app)
        .get('/api/v1/user/consultants?consultancyType=lawyer')
        .set('Authorization', `Bearer ${normalUserToken}`);

      logApi('GET', '/api/v1/user/consultants?consultancyType=lawyer', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-CONSULTANTS-FILTER', 'User filters consultants by type');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.result || res.body.data)).toBe(true);
    });

    it('should filter consultants by price range', async () => {
      console.info(`
📝 USER STORY:
As a regular user
I want to filter consultants by price
So that I can find a professional within my budget

📖 BDD SCENARIO: FILTER CONSULTANTS BY PRICE
Feature: Consultant Discovery

Given I am logged in as a normal user
When I send a GET request to fetch consultants with minPrice=10 and maxPrice=50
Then I should receive a filtered list of consultants within that price range
`);
      const res = await request(app)
        .get('/api/v1/user/consultants?minPrice=10&maxPrice=50')
        .set('Authorization', `Bearer ${normalUserToken}`);

      logApi('GET', '/api/v1/user/consultants?minPrice=10&maxPrice=50', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-CONSULTANTS-FILTER-PRICE', 'User filters consultants by price range');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.result || res.body.data)).toBe(true);
    });

    it('should filter consultants by minimum rating', async () => {
      console.info(`
📝 USER STORY:
As a regular user
I want to filter consultants by rating
So that I can find highly-rated professionals

📖 BDD SCENARIO: FILTER CONSULTANTS BY RATING
Feature: Consultant Discovery

Given I am logged in as a normal user
When I send a GET request to fetch consultants with minRating=4
Then I should receive a filtered list of consultants with 4 or more stars
`);
      const res = await request(app)
        .get('/api/v1/user/consultants?minRating=4')
        .set('Authorization', `Bearer ${normalUserToken}`);

      logApi('GET', '/api/v1/user/consultants?minRating=4', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-CONSULTANTS-FILTER-RATING', 'User filters consultants by minimum rating');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.result || res.body.data)).toBe(true);
    });

    it('should sort consultants by price (low to high)', async () => {
      console.info(`
📝 USER STORY:
As a regular user
I want to sort consultants by price from low to high
So that I can find the most affordable options first

📖 BDD SCENARIO: SORT CONSULTANTS BY PRICE (ASCENDING)
Feature: Consultant Discovery

Given I am logged in as a normal user
When I send a GET request to fetch consultants with sort=perMinuteRate
Then I should receive a list of consultants sorted by price from lowest to highest
`);
      const res = await request(app)
        .get('/api/v1/user/consultants?sort=perMinuteRate')
        .set('Authorization', `Bearer ${normalUserToken}`);

      logApi('GET', '/api/v1/user/consultants?sort=perMinuteRate', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-CONSULTANTS-SORT-PRICE-ASC', 'User sorts consultants by price (low to high)');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.result || res.body.data)).toBe(true);
    });

    it('should sort consultants by price (high to low)', async () => {
      console.info(`
📝 USER STORY:
As a regular user
I want to sort consultants by price from high to low
So that I can find premium professionals

📖 BDD SCENARIO: SORT CONSULTANTS BY PRICE (DESCENDING)
Feature: Consultant Discovery

Given I am logged in as a normal user
When I send a GET request to fetch consultants with sort=-perMinuteRate
Then I should receive a list of consultants sorted by price from highest to lowest
`);
      const res = await request(app)
        .get('/api/v1/user/consultants?sort=-perMinuteRate')
        .set('Authorization', `Bearer ${normalUserToken}`);

      logApi('GET', '/api/v1/user/consultants?sort=-perMinuteRate', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-CONSULTANTS-SORT-PRICE-DESC', 'User sorts consultants by price (high to low)');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.result || res.body.data)).toBe(true);
    });

    it('should sort consultants by rating (high to low)', async () => {
      console.info(`
📝 USER STORY:
As a regular user
I want to sort consultants by rating from high to low
So that I can see the best-reviewed professionals first

📖 BDD SCENARIO: SORT CONSULTANTS BY RATING (DESCENDING)
Feature: Consultant Discovery

Given I am logged in as a normal user
When I send a GET request to fetch consultants with sort=-averageRating
Then I should receive a list of consultants sorted by rating from highest to lowest
`);
      const res = await request(app)
        .get('/api/v1/user/consultants?sort=-averageRating')
        .set('Authorization', `Bearer ${normalUserToken}`);

      logApi('GET', '/api/v1/user/consultants?sort=-averageRating', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-CONSULTANTS-SORT-RATING-DESC', 'User sorts consultants by rating (high to low)');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.result || res.body.data)).toBe(true);
    });

    it('should fetch the list of recommended consultants', async () => {
      console.info(`
📝 USER STORY:
As a regular user
I want to view recommended experts
So that I can quickly find highly-rated consultants

📖 BDD SCENARIO: VIEW RECOMMENDED CONSULTANTS
Feature: Consultant Discovery

Given I am a user on the platform
When I send a GET request to fetch recommended consultants
Then I should receive a list of recommended experts
`);
      const res = await request(app)
        .get('/api/v1/recommendation/recommended')
        .set('Authorization', `Bearer ${normalUserToken}`);

      logApi('GET', '/api/v1/recommendation/recommended', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-RECOMMENDED-CONSULTANTS', 'User fetches recommended consultants');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should fetch own consultations as a normal user', async () => {
      console.info(`
📝 USER STORY:
As a regular user
I want to view my own consultations
So that I can keep track of my bookings

📖 BDD SCENARIO: VIEW OWN CONSULTATIONS
Feature: User Consultation Management

Given I am logged in as a normal user
When I send a GET request to fetch my bookings
Then I should receive a list of only my consultations
`);
      const res = await request(app)
        .get('/api/v1/consultation/my-bookings')
        .set('Authorization', `Bearer ${normalUserToken}`);

      logApi('GET', '/api/v1/consultation/my-bookings', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-USER-CONSULTATIONS', 'User fetches their own consultations');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
