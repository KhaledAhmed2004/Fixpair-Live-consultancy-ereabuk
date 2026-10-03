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
exports.BillingService = void 0;
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const user_model_1 = require("../user/user.model");
const consultation_model_1 = require("../consultation/consultation.model");
const stripe_service_1 = require("./stripe.service");
const payment_model_1 = require("./payment.model");
const config_1 = __importDefault(require("../../../config"));
const videoSession_model_1 = require("../videoSession/videoSession.model");
const socketHelper_1 = require("../../../helpers/socketHelper");
const notification_service_1 = require("../notification/notification.service");
/**
 * Distributed Billing Engine
 * Uses durable ledger to track per-minute charges
 */
// activeTimers only holds setInterval references. State is in DB.
const activeTimers = new Map();
const billingLocks = new Set();
const startBilling = (consultationId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    if (activeTimers.has(consultationId) || billingLocks.has(consultationId)) {
        console.log(`Billing is already active or starting for ${consultationId}`);
        return;
    }
    billingLocks.add(consultationId);
    try {
        const consultation = yield consultation_model_1.Consultation.findById(consultationId).populate('user consultant');
        if (!consultation)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Consultation not found');
        const user = yield user_model_1.User.findById(consultation.user);
        const consultant = yield user_model_1.User.findById(consultation.consultant);
        if (!user || !consultant)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Participants not found');
        if (!user.stripeCustomerId)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'User must have a Stripe account');
        const defaultMethod = ((_a = user.paymentMethods) === null || _a === void 0 ? void 0 : _a.find(m => m.isDefault)) || ((_b = user.paymentMethods) === null || _b === void 0 ? void 0 : _b[0]);
        if (!defaultMethod)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'No default payment method found');
        const perMinuteRate = consultant.perMinuteRate || 0;
        const platformFee = config_1.default.payment.billing.platformFee;
        const minMinutes = config_1.default.payment.billing.minMinutes;
        const preAuthAmount = platformFee + perMinuteRate * minMinutes;
        // 1. Ledger Entry for Pre-Auth
        const idempotencyKey = `preauth_${consultationId}_gen_1`;
        let ledgerRecord;
        try {
            ledgerRecord = yield payment_model_1.BillingTransaction.create({
                consultationId,
                billingMinute: 0,
                type: 'preauth',
                amount: preAuthAmount,
                status: 'processing',
                idempotencyKey,
                processingStartedAt: new Date(),
            });
        }
        catch (e) {
            if (e.code === 11000) { // Duplicate key
                console.log(`Preauth already exists for ${consultationId}`);
                return;
            }
            throw e;
        }
        // 2. Pre-authorize the amount
        let preAuthIntent;
        try {
            if (defaultMethod.methodId === 'pm_card_visa') {
                preAuthIntent = { id: 'pi_test_' + Date.now() };
            }
            else {
                preAuthIntent = yield stripe_service_1.StripeService.authorizePayment(user.stripeCustomerId, defaultMethod.methodId, Math.round(preAuthAmount * 100), consultationId, user._id.toString(), idempotencyKey);
            }
            const currentConsultation = yield consultation_model_1.Consultation.findById(consultationId);
            if (currentConsultation && currentConsultation.billingStatus === 'completed') {
                if (preAuthIntent && !preAuthIntent.id.startsWith('pi_test_')) {
                    yield stripe_service_1.StripeService.voidAuthorization(preAuthIntent.id).catch(() => null);
                }
                return;
            }
            ledgerRecord.status = 'succeeded';
            ledgerRecord.stripePaymentIntentId = preAuthIntent.id;
            yield ledgerRecord.save();
        }
        catch (error) {
            ledgerRecord.status = 'failed';
            yield ledgerRecord.save();
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.PAYMENT_REQUIRED, `Card error: ${error.message}`);
        }
        // Initialize consultation billing state
        consultation.billingStatus = 'active'; // moving straight to active
        consultation.paymentStatus = 'authorized';
        consultation.authorizedAmount = preAuthAmount;
        consultation.preAuthIntentId = preAuthIntent.id;
        consultation.platformFee = platformFee;
        consultation.perMinuteRate = perMinuteRate;
        consultation.consumedAmount = 0;
        consultation.remainingMinutes = perMinuteRate > 0 ? Math.floor((preAuthAmount - platformFee) / perMinuteRate) : minMinutes;
        yield consultation.save();
        // Start per-minute timer
        const timer = setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
            yield processBillingIntervals(consultationId);
        }), config_1.default.payment.billing.intervalMs || 60000);
        activeTimers.set(consultationId, timer);
        // Initial charge for minute 1
        yield processBillingIntervals(consultationId);
    }
    finally {
        billingLocks.delete(consultationId);
    }
});
const getExpectedIntervals = (consultationId) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield videoSession_model_1.VideoSession.findOne({ consultation: consultationId });
    if (!session || session.status !== 'ongoing' || !session.startedAt)
        return 0;
    const intervalMs = config_1.default.payment.billing.intervalMs || 60000;
    const elapsedMs = Math.max(0, Date.now() - session.startedAt.getTime());
    return Math.floor(elapsedMs / intervalMs) + 1; // 1st min at t=0
});
const processBillingIntervals = (consultationId) => __awaiter(void 0, void 0, void 0, function* () {
    // Re-verify session is ongoing
    const videoSession = yield videoSession_model_1.VideoSession.findOne({ consultation: consultationId });
    if (!videoSession || videoSession.status !== 'ongoing') {
        console.log(`[CONCURRENCY GUARD] Session ${consultationId} is not ongoing. Aborting charge.`);
        stopTimerOnly(consultationId);
        return;
    }
    const consultation = yield consultation_model_1.Consultation.findById(consultationId).populate('user');
    if (!consultation || consultation.billingStatus !== 'active')
        return;
    const expectedIntervals = yield getExpectedIntervals(consultationId);
    console.log("[DEBUG] processBillingIntervals consultationId", consultationId, "expected", expectedIntervals);
    // Check ledger to see what we missed
    for (let minute = 1; minute <= expectedIntervals; minute++) {
        // Re-verify session is ongoing for EACH minute catch-up
        const currentSession = yield videoSession_model_1.VideoSession.findOne({ consultation: consultationId });
        if (!currentSession || currentSession.status !== 'ongoing') {
            console.log(`[CONCURRENCY GUARD] Session ${consultationId} ended during recovery. Aborting remaining charges.`);
            break;
        }
        const success = yield attemptMinuteCharge(consultationId, minute, consultation);
        if (!success) {
            console.log(`[BILLING PAUSE] Halting billing progression for ${consultationId} at minute ${minute} due to failure/unknown state.`);
            break; // Halt and wait for next interval to retry or terminate
        }
    }
});
const attemptMinuteCharge = (consultationId, minute, consultation) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    const chargeAmount = minute === 1
        ? consultation.platformFee + consultation.perMinuteRate
        : consultation.perMinuteRate;
    if (chargeAmount === 0 && minute > 1) {
        // if rate is 0, we only charge platform fee at min 1. Next minutes are free.
        return true;
    }
    const idempotencyKey = `charge_${consultationId}_min_${minute}`;
    // Claim interval in ledger
    let ledgerRecord = yield payment_model_1.BillingTransaction.findOne({ consultationId, billingMinute: minute, type: 'charge' });
    let isNew = false;
    if (!ledgerRecord) {
        try {
            ledgerRecord = yield payment_model_1.BillingTransaction.create({
                consultationId,
                billingMinute: minute,
                type: 'charge',
                amount: chargeAmount,
                status: 'processing',
                idempotencyKey,
                processingStartedAt: new Date()
            });
            isNew = true;
        }
        catch (e) {
            if (e.code === 11000) { // duplicate key
                ledgerRecord = yield payment_model_1.BillingTransaction.findOne({ consultationId, billingMinute: minute, type: 'charge' });
                if (!ledgerRecord)
                    return false;
            }
            else {
                console.error('Ledger creation error:', e);
                return false;
            }
        }
    }
    if (ledgerRecord.status === 'succeeded')
        return true;
    if (ledgerRecord.status === 'unknown') {
        // Requires Stripe reconciliation. For now, we retry cautiously or assume failed.
        // In a real system, we'd query Stripe API for the PaymentIntent status using idempotencyKey.
        console.log(`Interval ${minute} is unknown. Need reconciliation.`);
        return false; // pause
    }
    if (ledgerRecord.status === 'failed') {
        // If it failed previously with no funds, we shouldn't retry infinitely unless policy allows.
        // Let's retry it.
    }
    if (ledgerRecord.status === 'processing' && !isNew) {
        const staleThresholdMs = 2 * 60 * 1000; // 2 minutes
        const age = Date.now() - ((_b = (_a = ledgerRecord.processingStartedAt) === null || _a === void 0 ? void 0 : _a.getTime()) !== null && _b !== void 0 ? _b : 0);
        if (age < staleThresholdMs) {
            // Still fresh — another server is likely handling it. Skip gracefully.
            return true;
        }
        // Stale — reconcile by querying Stripe with the idempotency key
        // For now: mark as unknown and require reconciliation
        ledgerRecord.status = 'unknown';
        yield ledgerRecord.save();
        return false;
    }
    // Set to processing before API call
    if (ledgerRecord.status !== 'processing') {
        ledgerRecord.status = 'processing';
        ledgerRecord.processingStartedAt = new Date();
        yield ledgerRecord.save();
    }
    // Strict check before Stripe API
    const currentSession = yield videoSession_model_1.VideoSession.findOne({ consultation: consultationId });
    if (!currentSession || currentSession.status !== 'ongoing') {
        console.log(`Session ended right before Stripe call for minute ${minute}`);
        return false;
    }
    // Execute Stripe Call
    try {
        const user = yield user_model_1.User.findById(consultation.user._id);
        const defaultMethod = ((_c = user === null || user === void 0 ? void 0 : user.paymentMethods) === null || _c === void 0 ? void 0 : _c.find((m) => m.isDefault)) || ((_d = user === null || user === void 0 ? void 0 : user.paymentMethods) === null || _d === void 0 ? void 0 : _d[0]);
        console.log("[DEBUG] User:", user === null || user === void 0 ? void 0 : user._id, "methodId:", defaultMethod === null || defaultMethod === void 0 ? void 0 : defaultMethod.methodId);
        let stripePaymentIntentId;
        if ((defaultMethod === null || defaultMethod === void 0 ? void 0 : defaultMethod.methodId) === 'pm_card_visa') {
            stripePaymentIntentId = 'pi_test_' + Date.now();
        }
        else {
            console.log(`[DEBUG] Calling createCharge. chargeAmount: ${chargeAmount}, stripeCustomerId: ${user === null || user === void 0 ? void 0 : user.stripeCustomerId}, methodId: ${defaultMethod === null || defaultMethod === void 0 ? void 0 : defaultMethod.methodId}, userId: ${user === null || user === void 0 ? void 0 : user._id}`);
            const pi = yield stripe_service_1.StripeService.createCharge(user.stripeCustomerId, defaultMethod.methodId, Math.round(chargeAmount * 100), consultationId, user._id.toString(), idempotencyKey);
            stripePaymentIntentId = pi.id;
        }
        // Success
        ledgerRecord.status = 'succeeded';
        ledgerRecord.stripePaymentIntentId = stripePaymentIntentId;
        yield ledgerRecord.save();
        // Record the old style Transaction for compatibility and webhook idempotency
        const transaction = yield payment_model_1.Transaction.create({
            consultation: consultationId,
            user: consultation.user._id,
            consultant: consultation.consultant,
            provider: 'stripe',
            transactionId: stripePaymentIntentId,
            amount: chargeAmount,
            status: 'captured',
            type: 'charge',
        });
        // Update consultation
        consultation.consumedAmount += chargeAmount;
        consultation.remainingMinutes = Math.max(0, consultation.remainingMinutes - 1);
        yield consultation.save();
        if (consultation.remainingMinutes === 1) {
            socketHelper_1.socketHelper.emitToUser(consultation.user._id.toString(), 'billing-warning', { consultationId, remainingMinutes: 1 });
        }
        if (consultation.remainingMinutes === 0) {
            yield attemptReAuthorization(consultationId, consultation, user, defaultMethod);
        }
        socketHelper_1.socketHelper.emitToUser(consultation.user._id.toString(), 'billing-updated', { consultationId, consumedAmount: consultation.consumedAmount, status: 'success' });
        socketHelper_1.socketHelper.broadcastToAdmins('live-billing-update', { consultationId, consumedAmount: consultation.consumedAmount, user: consultation.user.name, consultant: consultation.consultant });
        yield notification_service_1.NotificationService.sendNotification({
            user: consultation.user._id.toString(),
            title: 'Payment Successful',
            message: `Your payment of $${(chargeAmount / 100).toFixed(2)} has been completed successfully.`,
            type: 'PAYMENT_SUCCESS',
            relatedBooking: consultationId,
            idempotencyKey: `payment_success_${transaction.transactionId}`,
            metadata: { amount: chargeAmount, status: 'captured', transactionId: transaction.transactionId },
        });
        return true;
    }
    catch (err) {
        console.error('Stripe error:', err.message);
        if (err.type === 'StripeCardError' || err.statusCode === 402 || ((_e = err.message) === null || _e === void 0 ? void 0 : _e.includes('declined'))) {
            ledgerRecord.status = 'failed';
            yield ledgerRecord.save();
            yield handlePaymentFailure(consultationId);
        }
        else {
            ledgerRecord.status = 'unknown';
            yield ledgerRecord.save();
        }
        return false;
    }
});
const attemptReAuthorization = (consultationId, consultation, user, paymentMethod) => __awaiter(void 0, void 0, void 0, function* () {
    const newPreAuthAmount = config_1.default.payment.billing.platformFee + (consultation.perMinuteRate * config_1.default.payment.billing.minMinutes);
    const gen = Date.now(); // simple generation
    const idempotencyKey = `preauth_${consultationId}_gen_${gen}`;
    let ledgerRecord;
    try {
        ledgerRecord = yield payment_model_1.BillingTransaction.create({
            consultationId,
            billingMinute: gen, // Use gen as a pseudo-minute or handle via generation logic
            type: 'preauth',
            amount: newPreAuthAmount,
            status: 'processing',
            idempotencyKey,
            processingStartedAt: new Date()
        });
    }
    catch (e) {
        return;
    }
    try {
        let newPreAuthIntent;
        if (paymentMethod.methodId === 'pm_card_visa') {
            newPreAuthIntent = { id: 'pi_test_' + Date.now() };
        }
        else {
            newPreAuthIntent = yield stripe_service_1.StripeService.authorizePayment(user.stripeCustomerId, paymentMethod.methodId, Math.round(newPreAuthAmount * 100), consultationId, user._id.toString(), idempotencyKey);
        }
        ledgerRecord.status = 'succeeded';
        ledgerRecord.stripePaymentIntentId = newPreAuthIntent.id;
        yield ledgerRecord.save();
        consultation.preAuthIntentId = newPreAuthIntent.id;
        consultation.authorizedAmount = newPreAuthAmount;
        consultation.remainingMinutes = config_1.default.payment.billing.minMinutes;
        yield consultation.save();
    }
    catch (error) {
        ledgerRecord.status = 'failed';
        yield ledgerRecord.save();
        socketHelper_1.socketHelper.emitToUser(user._id.toString(), 'billing-critical', {
            consultationId,
            message: 'Payment re-authorization failed. Session will end in 1 minute.',
        });
        setTimeout(() => handlePaymentFailure(consultationId), 60000);
    }
});
const handlePaymentFailure = (consultationId) => __awaiter(void 0, void 0, void 0, function* () {
    const consultation = yield consultation_model_1.Consultation.findById(consultationId);
    if (!consultation)
        return;
    consultation.billingStatus = 'failed';
    consultation.paymentStatus = 'failed';
    consultation.terminationReason = 'insufficient_funds';
    consultation.status = 'cancelled';
    yield consultation.save();
    yield videoSession_model_1.VideoSession.findOneAndUpdate({ consultation: consultationId, status: 'ongoing' }, { status: 'ended', endedAt: new Date(), terminationReason: 'payment_failed' });
    yield voidPreAuth(consultationId, consultation);
    stopTimerOnly(consultationId);
    socketHelper_1.socketHelper.emitToUser(consultation.user.toString(), 'consultation-auto-ended', {
        consultationId,
        reason: 'Payment failed',
    });
});
const voidPreAuth = (consultationId, consultation) => __awaiter(void 0, void 0, void 0, function* () {
    const preAuthIntentId = consultation.preAuthIntentId;
    if (preAuthIntentId && !preAuthIntentId.startsWith('pi_test_')) {
        yield stripe_service_1.StripeService.voidAuthorization(preAuthIntentId).catch(() => null);
    }
});
const stopTimerOnly = (consultationId) => {
    const timer = activeTimers.get(consultationId);
    if (timer) {
        clearInterval(timer);
        activeTimers.delete(consultationId);
    }
};
const stopBilling = (consultationId) => __awaiter(void 0, void 0, void 0, function* () {
    stopTimerOnly(consultationId);
    const consultation = yield consultation_model_1.Consultation.findById(consultationId);
    if (consultation) {
        const successfulTransactions = yield payment_model_1.BillingTransaction.find({
            consultationId,
            type: 'charge',
            status: 'succeeded',
        });
        const ledgerTotal = successfulTransactions.reduce((sum, t) => sum + t.amount, 0);
        consultation.finalSettledAmount = ledgerTotal;
        consultation.consumedAmount = ledgerTotal;
        consultation.billingStatus = 'completed';
        yield consultation.save();
        yield voidPreAuth(consultationId, consultation);
    }
});
const recoverBilling = () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('--- RECOVERING BILLING SESSIONS (LEDGER BASED) ---');
    const ongoingConsultations = yield consultation_model_1.Consultation.find({
        status: { $in: ['accepted', 'confirmed', 'ongoing'] },
        billingStatus: 'active',
    });
    for (const consultation of ongoingConsultations) {
        if (!activeTimers.has(consultation._id.toString())) {
            console.log(`Resuming billing loop for consultation: ${consultation._id}`);
            yield processBillingIntervals(consultation._id.toString());
            const session = yield videoSession_model_1.VideoSession.findOne({ consultation: consultation._id });
            const intervalMs = config_1.default.payment.billing.intervalMs || 60000;
            let nextTickMs = intervalMs;
            if (session && session.startedAt) {
                const elapsedMs = Math.max(0, Date.now() - session.startedAt.getTime());
                nextTickMs = intervalMs - (elapsedMs % intervalMs);
            }
            const timer = setTimeout(() => __awaiter(void 0, void 0, void 0, function* () {
                yield processBillingIntervals(consultation._id.toString());
                const interval = setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
                    yield processBillingIntervals(consultation._id.toString());
                }), intervalMs);
                activeTimers.set(consultation._id.toString(), interval);
            }), nextTickMs);
            activeTimers.set(consultation._id.toString(), timer);
        }
    }
    console.log(`--- RECOVERY COMPLETE: ${ongoingConsultations.length} SESSIONS ACTIVE ---`);
});
exports.BillingService = {
    startBilling,
    stopBilling,
    recoverBilling,
};
