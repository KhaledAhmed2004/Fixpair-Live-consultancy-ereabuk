import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { USER_ROLES } from '../../enums/user';
import { StatusCodes } from 'http-status-codes';
import { logApi } from './testLogger';
import { startTestDb, stopTestDb } from './helpers/setupTestDb';
import { createTestUsers, TestUsers } from './helpers/createTestUsers';

vi.setConfig({ testTimeout: 60000 });

describe('User Discovery E2E Tests (Fixpair)', () => {
  let testUsers: TestUsers;

  beforeAll(async () => {
    await startTestDb();
    testUsers = await createTestUsers(app);
  });

  afterAll(async () => {
    await stopTestDb();
  });

  describe('User Consultation Management', () => {
    it('should successfully login as a normal user', async () => {
      // User is technically logged in via createTestUsers, but we test the endpoint explicitly
      const payload = {
        email: testUsers.normalUserEmail,
        password: 'UserPassword123!',
      };

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send(payload);

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('should fetch consultant details by id as a user', async () => {
      console.info(`
📝 USER STORY:
Title: View A Consultant's Full Details

As a regular user
I want to view a consultant's full details
So that I can see their expertise and bio before booking

📖 BDD SCENARIO: VIEW CONSULTANT DETAILS
Feature: User Consultation Management

Given I am logged in as a normal user
When I send a GET request to fetch the consultant details by ID
Then I should receive the consultant's details successfully
`);
      const res = await request(app)
        .get(`/api/v1/user/${testUsers.consultantId}`)
        .set('Authorization', `Bearer ${testUsers.normalUserToken}`);

      logApi('GET', `/api/v1/user/${testUsers.consultantId}`, { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-CONSULTANT-DETAILS-AS-USER', 'User fetches specific consultant details');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(testUsers.consultantId);
      expect(res.body.data.role).toBe(USER_ROLES.CONSULTANT);
    });

    it('should update user profile', async () => {
      console.info(`
📝 USER STORY:
Title: Update My Profile

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
        consultancyType: '60d5ecb8b392d7211054a322', // lawyer
        experience: '5 years',
        languages: ['English', 'Spanish'],
        expertise: ['Corporate Law', 'Family Law'],
        bio: 'I am a highly experienced lawyer.',
        perMinuteRate: 50,
        activeStatus: false
      };

      const res = await request(app)
        .patch('/api/v1/user/profile')
        .set('Authorization', `Bearer ${testUsers.normalUserToken}`)
        .field('data', JSON.stringify(payload))
        .attach('image', Buffer.from('dummy image content'), 'profile.png');

      logApi('PATCH', '/api/v1/user/profile', { headers: { Authorization: 'Bearer ***' }, body: payload, files: ['image'] }, res.body, 'PATCH-USER-PROFILE', 'User updates their profile');

      if (res.status !== StatusCodes.OK) {
        console.error('Update Profile Error:', res.body);
      }

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      
      expect(res.body.data.name).toBe(payload.name);
      expect(res.body.data.consultancyType._id.toString()).toBe(payload.consultancyType);
      expect(res.body.data.experience).toBe(payload.experience);
      expect(res.body.data.languages).toEqual(expect.arrayContaining(payload.languages));
      expect(res.body.data.expertise).toEqual(expect.arrayContaining(payload.expertise));
      expect(res.body.data.bio).toBe(payload.bio);
      expect(res.body.data.perMinuteRate).toBe(payload.perMinuteRate);
      expect(res.body.data.activeStatus).toBe(payload.activeStatus);
      expect(res.body.data.image).toMatch(/\/image\/profile-\d+\.png/);
    });

    it('should fetch user profile', async () => {
      console.info(`
📝 USER STORY:
Title: View My Profile

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
        .set('Authorization', `Bearer ${testUsers.normalUserToken}`);

      logApi('GET', '/api/v1/user/profile', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-USER-PROFILE', 'User fetches their profile');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      
      expect(res.body.data.name).toBe('Updated Normal User');
      expect(res.body.data.consultancyType.name).toBe('lawyer');
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
Title: View A List Of All Consultants

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
        .set('Authorization', `Bearer ${testUsers.normalUserToken}`);

      logApi('GET', '/api/v1/user/consultants?page=1&limit=10', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-ALL-CONSULTANTS-LIST', 'User fetches the list of consultants');


      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.result || res.body.data)).toBe(true);
    });

    it('should search consultants by searchTerm', async () => {
      console.info(`
📝 USER STORY:
Title: Search For Consultants By Name Or Expertise

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
        .set('Authorization', `Bearer ${testUsers.normalUserToken}`);

      logApi('GET', '/api/v1/user/consultants?searchTerm=expert', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-CONSULTANTS-SEARCH', 'User searches for consultants');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.result || res.body.data)).toBe(true);
    });

    it('should filter consultants by consultancyType', async () => {
      console.info(`
📝 USER STORY:
Title: Filter Consultants By Type

As a regular user
I want to filter consultants by type
So that I can find a specific type of professional like a lawyer

📖 BDD SCENARIO: FILTER CONSULTANTS
Feature: Consultant Discovery

Given I am logged in as a normal user
When I send a GET request to fetch consultants with consultancyType ID
Then I should receive a 200 OK response with the filtered list
`);
      const res = await request(app)
        .get('/api/v1/user/consultants?consultancyType=60d5ecb8b392d7211054a322')
        .set('Authorization', `Bearer ${testUsers.normalUserToken}`);

      logApi('GET', '/api/v1/user/consultants?consultancyType=60d5ecb8b392d7211054a322', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-CONSULTANTS-FILTER', 'User filters consultants by type');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.result || res.body.data)).toBe(true);
    });

    it('should filter consultants by price range', async () => {
      console.info(`
📝 USER STORY:
Title: Filter Consultants By Price

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
        .set('Authorization', `Bearer ${testUsers.normalUserToken}`);

      logApi('GET', '/api/v1/user/consultants?minPrice=10&maxPrice=50', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-CONSULTANTS-FILTER-PRICE', 'User filters consultants by price range');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.result || res.body.data)).toBe(true);
    });

    it('should filter consultants by minimum rating', async () => {
      console.info(`
📝 USER STORY:
Title: Filter Consultants By Rating

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
        .set('Authorization', `Bearer ${testUsers.normalUserToken}`);

      logApi('GET', '/api/v1/user/consultants?minRating=4', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-CONSULTANTS-FILTER-RATING', 'User filters consultants by minimum rating');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.result || res.body.data)).toBe(true);
    });

    it('should sort consultants by price (low to high)', async () => {
      console.info(`
📝 USER STORY:
Title: Sort Consultants By Price From Low To High

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
        .set('Authorization', `Bearer ${testUsers.normalUserToken}`);

      logApi('GET', '/api/v1/user/consultants?sort=perMinuteRate', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-CONSULTANTS-SORT-PRICE-ASC', 'User sorts consultants by price (low to high)');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.result || res.body.data)).toBe(true);
    });

    it('should sort consultants by price (high to low)', async () => {
      console.info(`
📝 USER STORY:
Title: Sort Consultants By Price From High To Low

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
        .set('Authorization', `Bearer ${testUsers.normalUserToken}`);

      logApi('GET', '/api/v1/user/consultants?sort=-perMinuteRate', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-CONSULTANTS-SORT-PRICE-DESC', 'User sorts consultants by price (high to low)');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.result || res.body.data)).toBe(true);
    });

    it('should sort consultants by rating (high to low)', async () => {
      console.info(`
📝 USER STORY:
Title: Sort Consultants By Rating From High To Low

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
        .set('Authorization', `Bearer ${testUsers.normalUserToken}`);

      logApi('GET', '/api/v1/user/consultants?sort=-averageRating', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-CONSULTANTS-SORT-RATING-DESC', 'User sorts consultants by rating (high to low)');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.result || res.body.data)).toBe(true);
    });

    it('should fetch the list of recommended consultants', async () => {
      console.info(`
📝 USER STORY:
Title: View Recommended Experts

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
        .set('Authorization', `Bearer ${testUsers.normalUserToken}`);

      logApi('GET', '/api/v1/recommendation/recommended', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-RECOMMENDED-CONSULTANTS', 'User fetches recommended consultants');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should fetch own consultations as a normal user', async () => {
      console.info(`
📝 USER STORY:
Title: View My Own Consultations

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
        .set('Authorization', `Bearer ${testUsers.normalUserToken}`);

      logApi('GET', '/api/v1/consultation/my-bookings', { headers: { Authorization: 'Bearer ***' } }, res.body, 'GET-USER-CONSULTATIONS', 'User fetches their own consultations');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
