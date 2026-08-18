import { User } from '../../modules/user/user.model';
import { USER_ROLES } from '../../../enums/user';
import request from 'supertest';
import { Express } from 'express';

export interface TestUsers {
  superAdminToken: string;
  superAdminEmail: string;
  consultantToken: string;
  consultantId: string;
  consultantEmail: string;
  normalUserToken: string;
  normalUserEmail: string;
  normalUserId: string;
}

export async function createTestUsers(app: Express): Promise<TestUsers> {
  const superAdminPassword = 'AdminPassword123!';
  const superAdminEmail = `super_admin_${Date.now()}@test.com`;
  
  const consultantEmail = `consultant_${Date.now()}@test.com`;
  const consultantPassword = 'ConsultantPassword123!';

  const normalUserEmail = `user_${Date.now()}@test.com`;
  const normalUserPassword = 'UserPassword123!';

  // Create super admin
  await User.create({
    name: 'System Super Admin',
    email: superAdminEmail,
    password: superAdminPassword,
    role: USER_ROLES.SUPER_ADMIN,
    status: 'active',
    verified: true,
  });

  // Create consultant
  const consultant = await User.create({
    name: 'Expert Consultant',
    email: consultantEmail,
    password: consultantPassword,
    role: USER_ROLES.CONSULTANT,
    consultancyType: '60d5ecb8b392d7211054a321', // advisor
    experience: '10 years',
    languages: ['English', 'French'],
    expertise: ['Business Strategy', 'Financial Planning'],
    bio: 'I am a senior advisor with a decade of experience.',
    perMinuteRate: 150,
    activeStatus: true,
    status: 'active',
    verified: true,
  });
  const consultantId = consultant._id.toString();

  // Create a normal user
  const normalUser = await User.create({
    name: 'Normal User',
    email: normalUserEmail,
    password: normalUserPassword,
    role: USER_ROLES.USER,
    status: 'active',
    verified: true,
  });
  const normalUserId = normalUser._id.toString();

  // Login super admin
  const adminLoginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: superAdminEmail, password: superAdminPassword });
  const superAdminToken = adminLoginRes.body?.data?.accessToken || '';

  // Login consultant
  const consultantLoginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: consultantEmail, password: consultantPassword });
  const consultantToken = consultantLoginRes.body?.data?.accessToken || '';

  // Login normal user
  const userLoginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: normalUserEmail, password: normalUserPassword });
  const normalUserToken = userLoginRes.body?.data?.accessToken || '';

  return {
    superAdminToken,
    superAdminEmail,
    consultantToken,
    consultantId,
    consultantEmail,
    normalUserToken,
    normalUserEmail,
    normalUserId,
  };
}
