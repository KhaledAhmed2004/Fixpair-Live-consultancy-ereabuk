"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeService = void 0;
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
const stripe_1 = __importDefault(require("stripe"));
const config_1 = __importDefault(require("../../../config"));
const stripe = new stripe_1.default(config_1.default.payment.stripe.secretKey, {
    apiVersion: '2024-04-10',
});
/**
 * Stripe Service
 * Handles customer management, payment methods, and transactions
 */
const createCustomer = (email, name) => __awaiter(void 0, void 0, void 0, function* () {
    return yield stripe.customers.create({ email, name });
});
const attachPaymentMethod = (customerId, paymentMethodId) => __awaiter(void 0, void 0, void 0, function* () {
    yield stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    return yield stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
    });
});
const detachPaymentMethod = (paymentMethodId) => __awaiter(void 0, void 0, void 0, function* () {
    return yield stripe.paymentMethods.detach(paymentMethodId);
});
const listCustomerPaymentMethods = (customerId) => __awaiter(void 0, void 0, void 0, function* () {
    return yield stripe.paymentMethods.list({ customer: customerId, type: 'card' });
});
const createCharge = (customerId, paymentMethodId, amount, // Must be integer minor units (e.g. cents)
consultationId, userId, idempotencyKey) => __awaiter(void 0, void 0, void 0, function* () {
    return yield stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        customer: customerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        metadata: { consultationId, userId },
    }, { idempotencyKey });
});
/**
 * Authorizes a payment for future capture (Pre-auth)
 * Used for the 5-minute affordability check at session start
 */
const authorizePayment = (customerId, paymentMethodId, amount, // Must be integer minor units (e.g. cents)
consultationId, userId, idempotencyKey) => __awaiter(void 0, void 0, void 0, function* () {
    return yield stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        customer: customerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        capture_method: 'manual', // This makes it an authorization
        metadata: { consultationId, userId },
    }, { idempotencyKey });
});
/**
 * Captures a previously authorized payment
 */
const capturePayment = (paymentIntentId, amount // Must be integer minor units (e.g. cents)
) => __awaiter(void 0, void 0, void 0, function* () {
    return yield stripe.paymentIntents.capture(paymentIntentId, {
        amount_to_capture: amount,
    });
});
/**
 * Voids a previously authorized payment (cancels the hold)
 */
const voidAuthorization = (paymentIntentId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const intent = yield stripe.paymentIntents.retrieve(paymentIntentId);
        // Only cancel if it's in a cancelable state
        if (intent.status === 'requires_capture' ||
            intent.status === 'requires_confirmation' ||
            intent.status === 'requires_action' ||
            intent.status === 'requires_payment_method') {
            return yield stripe.paymentIntents.cancel(paymentIntentId);
        }
        return intent;
    }
    catch (error) {
        // If it's already canceled or doesn't exist, we don't want to crash the session end
        console.error(`Stripe Void Error for ${paymentIntentId}:`, error.message);
        return null;
    }
});
exports.StripeService = {
    stripe,
    createCustomer,
    attachPaymentMethod,
    detachPaymentMethod,
    createCharge,
    authorizePayment,
    capturePayment,
    voidAuthorization
};
