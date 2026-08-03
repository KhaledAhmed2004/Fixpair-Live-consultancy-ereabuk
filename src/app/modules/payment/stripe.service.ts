/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
import Stripe from 'stripe';
import config from '../../../config';

const stripe = new Stripe(config.payment.stripe.secretKey, {
  apiVersion: '2024-04-10' as any,
});

/**
 * Stripe Service
 * Handles customer management, payment methods, and transactions
 */

const createCustomer = async (email: string, name: string) => {
  return await stripe.customers.create({ email, name });
};

const attachPaymentMethod = async (customerId: string, paymentMethodId: string) => {
  await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
  return await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });
};

const listCustomerPaymentMethods = async (customerId: string) => {
  return await stripe.paymentMethods.list({ customer: customerId, type: 'card' });
};

const createCharge = async (
  customerId: string,
  paymentMethodId: string,
  amount: number, // Must be integer minor units (e.g. cents)
  consultationId: string,
  userId: string,
  idempotencyKey?: string,
) => {
  return await stripe.paymentIntents.create({
    amount: amount, 
    currency: 'usd',
    customer: customerId,
    payment_method: paymentMethodId,
    off_session: true,
    confirm: true,
    metadata: { consultationId, userId },
  }, { idempotencyKey });
};

/**
 * Authorizes a payment for future capture (Pre-auth)
 * Used for the 5-minute affordability check at session start
 */
const authorizePayment = async (
  customerId: string,
  paymentMethodId: string,
  amount: number, // Must be integer minor units (e.g. cents)
  consultationId: string,
  userId: string,
  idempotencyKey?: string,
) => {
  return await stripe.paymentIntents.create({
    amount: amount,
    currency: 'usd',
    customer: customerId,
    payment_method: paymentMethodId,
    off_session: true,
    confirm: true,
    capture_method: 'manual', // This makes it an authorization
    metadata: { consultationId, userId },
  }, { idempotencyKey });
};

/**
 * Captures a previously authorized payment
 */
const capturePayment = async (
  paymentIntentId: string,
  amount: number // Must be integer minor units (e.g. cents)
) => {
  return await stripe.paymentIntents.capture(paymentIntentId, {
    amount_to_capture: amount,
  });
};

/**
 * Voids a previously authorized payment (cancels the hold)
 */
const voidAuthorization = async (paymentIntentId: string) => {
  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Only cancel if it's in a cancelable state
    if (
      intent.status === 'requires_capture' ||
      intent.status === 'requires_confirmation' ||
      intent.status === 'requires_action' ||
      intent.status === 'requires_payment_method'
    ) {
      return await stripe.paymentIntents.cancel(paymentIntentId);
    }

    return intent;
  } catch (error: any) {
    // If it's already canceled or doesn't exist, we don't want to crash the session end
    console.error(
      `Stripe Void Error for ${paymentIntentId}:`,
      error.message
    );
    return null;
  }
};

export const StripeService = {
  stripe,
  createCustomer,
  attachPaymentMethod,
  createCharge,
  authorizePayment,
  capturePayment,
  voidAuthorization
};
