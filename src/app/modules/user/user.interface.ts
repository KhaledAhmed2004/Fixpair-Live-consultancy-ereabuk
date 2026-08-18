/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-unused-vars */
import { Model, Types } from 'mongoose';
import { USER_ROLES } from '../../../enums/user';

export type IUser = {
  name: string;
  role: USER_ROLES;
  contact?: string;
  email: string;
  password?: string;
  location?: string;
  image?: string;
  status: 'active' | 'blocked' | 'deleted';
  verified: boolean;
  firebaseUid?: string;
  consultancyType?: Types.ObjectId;
  experience?: string;
  languages?: string[];
  expertise?: string[];
  bio?: string;
  perMinuteRate?: number;
  activeStatus?: boolean;
  stripeCustomerId?: string;
  paypalPayerId?: string;
  paymentMethods?: {
    provider: 'stripe' | 'paypal';
    methodId: string;
    last4?: string;
    brand?: string;
    isDefault: boolean;
  }[];
  authentication?: {
    isResetPassword: boolean;
    oneTimeCode: number | null;
    expireAt: Date;
    otpRequestCount: number;
    lastOtpRequestTime: Date | null;
  };
  fcmTokens: string[];
  deviceType?: 'android' | 'ios';
  averageRating?: number;
  totalReviews?: number;
  totalConsultations?: number;
};

export type UserModal = {
  isExistUserById(id: string): any;
  isExistUserByEmail(email: string): any;
  isMatchPassword(password: string, hashPassword: string): boolean;
} & Model<IUser>;
