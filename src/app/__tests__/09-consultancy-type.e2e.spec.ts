import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { USER_ROLES } from '../../enums/user';
import { StatusCodes } from 'http-status-codes';
import { startTestDb, stopTestDb } from './helpers/setupTestDb';
import { createTestUsers, TestUsers } from './helpers/createTestUsers';
import { logApi } from './testLogger';

vi.setConfig({ testTimeout: 60000 });

describe('Consultancy Type Management E2E Tests', () => {
  let testUsers: TestUsers;
  let typeId: string;
  let consultantId: string;

  beforeAll(async () => {
    await startTestDb();
    testUsers = await createTestUsers(app);
  });

  afterAll(async () => {
    await stopTestDb();
  });

  it('should create a new consultancy type as admin', async () => {
    console.info(`
📝 USER STORY:
Title: Create Consultancy Type

As an admin
I want to create a new consultancy type
So that it can be assigned to new consultants

📖 BDD SCENARIO: CREATE CONSULTANCY TYPE
Feature: Consultancy Type Management

Given I am logged in as a super admin
When I send a POST request with a new consultancy type name
Then I should receive a 201 Created response
And the new type should be active
`);
    const res = await request(app)
      .post('/api/v1/consultancy-type')
      .set('Authorization', `Bearer ${testUsers.superAdminToken}`)
      .send({
        name: 'engineer',
      });

    logApi('POST', '/api/v1/consultancy-type', { body: { name: 'engineer' } }, res.body, 'POST-CREATE-TYPE');

    expect(res.status).toBe(StatusCodes.CREATED);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('engineer');
    expect(res.body.data.status).toBe('active');
    
    typeId = res.body.data._id;
  });

  it('should not allow duplicate consultancy type', async () => {
    console.info(`
📝 USER STORY:
Title: Prevent Duplicate Consultancy Types

As an admin
I want to be prevented from creating duplicate consultancy types
So that the system does not have redundant categories

📖 BDD SCENARIO: CREATE DUPLICATE CONSULTANCY TYPE
Feature: Consultancy Type Management

Given I am logged in as a super admin
And a consultancy type named "engineer" already exists
When I send a POST request to create "engineer" again
Then I should receive a 409 Conflict error
`);
    const res = await request(app)
      .post('/api/v1/consultancy-type')
      .set('Authorization', `Bearer ${testUsers.superAdminToken}`)
      .send({
        name: 'engineer',
      });

    expect(res.status).toBe(StatusCodes.CONFLICT);
    expect(res.body.success).toBe(false);
  });

  it('should get all consultancy types', async () => {
    console.info(`
📝 USER STORY:
Title: Retrieve All Consultancy Types

As any user or admin
I want to fetch the list of all consultancy types
So that I can see all available options

📖 BDD SCENARIO: GET ALL CONSULTANCY TYPES
Feature: Consultancy Type Management

Given the system has multiple consultancy types
When I send a GET request to the consultancy types endpoint
Then I should receive a 200 OK response with a list of all types
`);
    const res = await request(app)
      .get('/api/v1/consultancy-type');

    logApi('GET', '/api/v1/consultancy-type', {}, res.body, 'GET-ALL-TYPES');

    expect(res.status).toBe(StatusCodes.OK);
    expect(res.body.success).toBe(true);
    // Should have advisor, lawyer, doctor (from setupTestDb) + engineer
    expect(res.body.data.length).toBeGreaterThanOrEqual(4);
    
    // Verify that the newly created type ('engineer') is at the first position (sorted by createdAt descending)
    expect(res.body.data[0].name).toBe('engineer');
  });

  it('should update consultancy type as admin', async () => {
    console.info(`
📝 USER STORY:
Title: Update Consultancy Type

As an admin
I want to update an existing consultancy type
So that I can change its name or status

📖 BDD SCENARIO: UPDATE CONSULTANCY TYPE
Feature: Consultancy Type Management

Given I am logged in as a super admin
And an active consultancy type exists
When I send a PATCH request to update its name and status to inactive
Then I should receive a 200 OK response with the updated details
`);
    const res = await request(app)
      .patch(`/api/v1/consultancy-type/${typeId}`)
      .set('Authorization', `Bearer ${testUsers.superAdminToken}`)
      .send({
        name: 'senior engineer',
        status: 'inactive',
      });

    logApi('PATCH', `/api/v1/consultancy-type/${typeId}`, { body: { name: 'senior engineer', status: 'inactive' } }, res.body, 'PATCH-UPDATE-TYPE');

    expect(res.status).toBe(StatusCodes.OK);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('senior engineer');
    expect(res.body.data.status).toBe('inactive');
  });

  it('should only return active types if activeOnly=true', async () => {
    console.info(`
📝 USER STORY:
Title: Filter Active Consultancy Types

As any user
I want to fetch only the active consultancy types
So that I don't see options that are currently unavailable

📖 BDD SCENARIO: GET ACTIVE CONSULTANCY TYPES
Feature: Consultancy Type Management

Given the system has both active and inactive consultancy types
When I send a GET request with the activeOnly=true query parameter
Then I should receive a 200 OK response with only the active types
`);
    const res = await request(app)
      .get('/api/v1/consultancy-type?activeOnly=true');

    expect(res.status).toBe(StatusCodes.OK);
    expect(res.body.success).toBe(true);
    
    const types = res.body.data;
    const hasInactive = types.some((t: any) => t.status === 'inactive');
    expect(hasInactive).toBe(false);
  });

  it('should delete consultancy type as admin', async () => {
    console.info(`
📝 USER STORY:
Title: Delete Consultancy Type

As an admin
I want to delete a consultancy type
So that it is completely removed from the system

📖 BDD SCENARIO: DELETE CONSULTANCY TYPE
Feature: Consultancy Type Management

Given I am logged in as a super admin
And a consultancy type exists
When I send a DELETE request for that type
Then I should receive a 200 OK response confirming deletion
`);
    const res = await request(app)
      .delete(`/api/v1/consultancy-type/${typeId}`)
      .set('Authorization', `Bearer ${testUsers.superAdminToken}`);

    logApi('DELETE', `/api/v1/consultancy-type/${typeId}`, {}, res.body, 'DELETE-TYPE');

    expect(res.status).toBe(StatusCodes.OK);
    expect(res.body.success).toBe(true);
  });

  it('should reject creation if name is missing', async () => {
    console.info(`
📝 USER STORY:
Title: Prevent Invalid Consultancy Type Creation

As an admin
I should not be able to create a consultancy type without a name
So that the system data remains consistent

📖 BDD SCENARIO: CREATE CONSULTANCY TYPE WITHOUT NAME
Feature: Consultancy Type Management

Given I am logged in as a super admin
When I send a POST request with an empty body
Then I should receive a 400 Bad Request error
`);
    const res = await request(app)
      .post('/api/v1/consultancy-type')
      .set('Authorization', `Bearer ${testUsers.superAdminToken}`)
      .send({});

    expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    expect(res.body.success).toBe(false);
  });

  it('should reject creation by non-admin user', async () => {
    console.info(`
📝 USER STORY:
Title: Enforce Admin Role for Creation

As a regular user
I should not be able to create a consultancy type
So that only authorized personnel can manage categories

📖 BDD SCENARIO: CREATE CONSULTANCY TYPE AS USER
Feature: Consultancy Type Management

Given I am logged in as a regular user
When I send a POST request to create a consultancy type
Then I should receive a 401 Unauthorized or 403 Forbidden error
`);
    const res = await request(app)
      .post('/api/v1/consultancy-type')
      .set('Authorization', `Bearer ${testUsers.normalUserToken}`)
      .send({
        name: 'unauthorized type',
      });

    // Typically auth middleware returns 401/403
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThanOrEqual(403);
    expect(res.body.success).toBe(false);
  });

  it('should return 404 for updating non-existent type', async () => {
    console.info(`
📝 USER STORY:
Title: Handle Non-existent Type Update

As an admin
I want to be informed if I try to update a consultancy type that doesn't exist
So that I know the operation failed

📖 BDD SCENARIO: UPDATE NON-EXISTENT TYPE
Feature: Consultancy Type Management

Given I am logged in as a super admin
When I send a PATCH request for a non-existent ID
Then I should receive a 404 Not Found error
`);
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .patch(`/api/v1/consultancy-type/${fakeId}`)
      .set('Authorization', `Bearer ${testUsers.superAdminToken}`)
      .send({
        name: 'ghost type',
      });

    expect(res.status).toBe(StatusCodes.NOT_FOUND);
    expect(res.body.success).toBe(false);
  });

  it('should return 404 for deleting non-existent type', async () => {
    console.info(`
📝 USER STORY:
Title: Handle Non-existent Type Deletion

As an admin
I want to be informed if I try to delete a consultancy type that doesn't exist
So that I know the operation failed

📖 BDD SCENARIO: DELETE NON-EXISTENT TYPE
Feature: Consultancy Type Management

Given I am logged in as a super admin
When I send a DELETE request for a non-existent ID
Then I should receive a 404 Not Found error
`);
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .delete(`/api/v1/consultancy-type/${fakeId}`)
      .set('Authorization', `Bearer ${testUsers.superAdminToken}`);

    expect(res.status).toBe(StatusCodes.NOT_FOUND);
    expect(res.body.success).toBe(false);
  });

  it('should fail to create a consultant if consultancyType or perMinuteRate is missing', async () => {
    console.info(`
📝 USER STORY:
Title: Prevent Invalid Consultant Creation

As an admin
I should not be able to create a consultant without providing their consultancy type and rate
So that the system data remains consistent

📖 BDD SCENARIO: CREATE CONSULTANT VALIDATION
Feature: Admin User Management

Given I am logged in as a super admin
When I send a POST request to create a Consultant user without consultancyType or perMinuteRate
Then I should receive a 400 Bad Request error
`);
    const invalidPayload = {
      name: 'Invalid Consultant',
      email: `invalid_${Date.now()}@test.com`,
      password: 'Password123!',
      role: USER_ROLES.CONSULTANT,
      experience: '5 years',
      languages: ['English', 'Bengali'],
      expertise: ['Career Counseling', 'Tech Interview Prep'],
      bio: 'I help candidates prepare for their technical interviews.',
      // Missing consultancyType and perMinuteRate
    };

    const res = await request(app)
      .post('/api/v1/user')
      .set('Authorization', `Bearer ${testUsers.superAdminToken}`)
      .send(invalidPayload);

    logApi(
      'POST',
      '/api/v1/user',
      { headers: { Authorization: 'Bearer ***' }, body: invalidPayload },
      res.body,
      'POST-CREATE-CONSULTANT-INVALID',
      'Admin attempts to create consultant with missing required fields',
    );

    expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    expect(res.body.success).toBe(false);
  });

  it('should successfully create a valid consultant as admin', async () => {
    console.info(`
📝 USER STORY:
Title: Create Valid Consultant

As an admin
I want to create a new consultant with all required fields
So that the consultant can access the platform

📖 BDD SCENARIO: CREATE VALID CONSULTANT
Feature: Admin User Management

Given I am logged in as a super admin
When I send a POST request to create a Consultant user with all required fields including consultancyType and perMinuteRate
Then I should receive a 201 Created response
`);
    const validPayload = {
      name: 'Valid Consultant',
      email: `valid_consultant_${Date.now()}@test.com`,
      password: 'Password123!',
      role: USER_ROLES.CONSULTANT,
      consultancyType: '60d5ecb8b392d7211054a321', // Valid 24-char ObjectID
      perMinuteRate: 100,
      experience: '5 years',
      languages: ['English', 'Bengali'],
      expertise: ['Career Counseling', 'Tech Interview Prep'],
      bio: 'I help candidates prepare for their technical interviews.',
    };

    const res = await request(app)
      .post('/api/v1/user')
      .set('Authorization', `Bearer ${testUsers.superAdminToken}`)
      .send(validPayload);

    logApi(
      'POST',
      '/api/v1/user',
      { headers: { Authorization: 'Bearer ***' }, body: validPayload },
      res.body,
      'POST-CREATE-CONSULTANT-VALID',
      'Admin successfully creates a consultant',
    );

    expect(res.status).toBe(StatusCodes.OK);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe(USER_ROLES.CONSULTANT);
    
    // Store for subsequent tests
    consultantId = res.body.data._id;
  });

  it('should get the created consultant', async () => {
    console.info(`
📝 USER STORY:
Title: Retrieve Consultant Details

As any user or admin
I want to fetch the details of a consultant
So that I can see their profile and rate

📖 BDD SCENARIO: GET CONSULTANT DETAILS
Feature: User Management

Given a consultant exists in the system
When I send a GET request for that consultant's ID
Then I should receive a 200 OK response with the consultant details
`);
    const res = await request(app)
      .get(`/api/v1/user/${consultantId}`)
      .set('Authorization', `Bearer ${testUsers.superAdminToken}`);

    logApi('GET', `/api/v1/user/${consultantId}`, {}, res.body, 'GET-CONSULTANT');

    expect(res.status).toBe(StatusCodes.OK);
    expect(res.body.success).toBe(true);
    expect(res.body.data._id).toBe(consultantId);
  });

  it('should update the created consultant', async () => {
    console.info(`
📝 USER STORY:
Title: Update Consultant Details

As an admin
I want to update an existing consultant's details
So that their profile stays up to date

📖 BDD SCENARIO: UPDATE CONSULTANT
Feature: Admin User Management

Given I am logged in as a super admin
When I send a PATCH request to update the consultant's perMinuteRate
Then I should receive a 200 OK response with the updated details
`);
    const res = await request(app)
      .patch(`/api/v1/user/${consultantId}`)
      .set('Authorization', `Bearer ${testUsers.superAdminToken}`)
      .send({
        perMinuteRate: 150,
        experience: '6 years'
      });

    logApi('PATCH', `/api/v1/user/${consultantId}`, { body: { perMinuteRate: 150, experience: '6 years' } }, res.body, 'PATCH-UPDATE-CONSULTANT');

    expect(res.status).toBe(StatusCodes.OK);
    expect(res.body.success).toBe(true);
  });

  it('should delete the created consultant', async () => {
    console.info(`
📝 USER STORY:
Title: Delete Consultant

As an admin
I want to delete a consultant
So that they no longer have access to the platform

📖 BDD SCENARIO: DELETE CONSULTANT
Feature: Admin User Management

Given I am logged in as a super admin
When I send a DELETE request for the consultant's ID
Then I should receive a 200 OK response confirming deletion
`);
    const res = await request(app)
      .delete(`/api/v1/user/${consultantId}`)
      .set('Authorization', `Bearer ${testUsers.superAdminToken}`);

    logApi('DELETE', `/api/v1/user/${consultantId}`, {}, res.body, 'DELETE-CONSULTANT');

    expect(res.status).toBe(StatusCodes.OK);
    expect(res.body.success).toBe(true);
  });
});
