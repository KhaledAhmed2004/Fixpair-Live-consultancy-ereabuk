import { Schema, model } from 'mongoose';
import { INotification } from './notification.interface';

const notificationSchema = new Schema<INotification>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: [
        'CONSULTATION_STATUS',
        'PAYMENT_SUCCESS',
        'CONSULTATION_REMINDER',
        'SYSTEM',
        'NEW_BOOKING_REQUEST',
        'INSTANT_CALL_REQUEST',
        'BOOKING_CANCELLED',
        'BOOKING_RESCHEDULED',
        'NEW_REVIEW_RECEIVED',
        'WITHDRAWAL_REQUEST',
        'WITHDRAWAL_APPROVED',
        'NEW_CONSULTANT_REGISTERED',
        'DISPUTE_OPENED',
      ],
      required: true,
    },
    relatedBooking: {
      type: Schema.Types.ObjectId,
      ref: 'Consultation',
    },
    read: {
      type: Boolean,
      default: false,
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
    },
  },
);

notificationSchema.index({ user: 1, createdAt: -1 });

export const Notification = model<INotification>(
  'Notification',
  notificationSchema,
);
