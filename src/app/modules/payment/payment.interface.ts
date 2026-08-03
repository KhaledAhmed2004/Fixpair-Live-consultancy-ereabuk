/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from 'mongoose';

export type ITransaction = {
  consultation: Types.ObjectId;
  user: Types.ObjectId;
  consultant: Types.ObjectId;
  provider: 'stripe' | 'paypal';
  transactionId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded' | 'voided';
  type: 'authorization' | 'capture' | 'charge';
  retryCount: number;
  metadata?: Record<string, any>;
};

export type IInvoice = {
  session: Types.ObjectId;
  user: Types.ObjectId;
  consultant: Types.ObjectId;
  invoiceNumber: string;
  duration: number;
  perMinuteRate: number;
  platformFee: number;
  subtotal: number;
  totalAmount: number;
  paymentMethod: string;
  status: 'paid' | 'unpaid' | 'failed';
  pdfUrl?: string;
};

export type IBillingTransaction = {
  consultationId: Types.ObjectId;
  billingMinute: number;
  type: 'preauth' | 'charge' | 'adjustment' | 'refund';
  amount: number; // Stored in integer minor units (e.g. cents)
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'unknown';
  stripePaymentIntentId?: string;
  idempotencyKey: string;
  processingStartedAt?: Date;
};
