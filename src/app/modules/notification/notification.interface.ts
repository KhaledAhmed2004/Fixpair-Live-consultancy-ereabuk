/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from 'mongoose';

export type INotification = {
  user: Types.ObjectId;
  title: string;
  message: string;
  type:
    | 'CONSULTATION_STATUS'
    | 'PAYMENT_SUCCESS'
    | 'CONSULTATION_REMINDER'
    | 'CONSULTATION_REQUEST'
    | 'CONSULTATION_EXPIRED'
    | 'SYSTEM'
    | 'NEW_BOOKING_REQUEST'
    | 'INSTANT_CALL_REQUEST'
    | 'BOOKING_CANCELLED'
    | 'BOOKING_RESCHEDULED'
    | 'NEW_REVIEW_RECEIVED'
    | 'WITHDRAWAL_REQUEST'
    | 'WITHDRAWAL_APPROVED'
    | 'NEW_CONSULTANT_REGISTERED'
    | 'DISPUTE_OPENED';
  relatedBooking?: Types.ObjectId;
  read: boolean;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
};
