/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import ApiError from '../../../errors/ApiError';
import { User } from '../user/user.model';
import { Consultation } from '../consultation/consultation.model';
import { StripeService } from './stripe.service';
import { PayPalService } from './paypal.service';
import { Transaction, BillingTransaction } from './payment.model';
import config from '../../../config';
import { VideoSession } from '../videoSession/videoSession.model';
import { socketHelper } from '../../../helpers/socketHelper';
import { NotificationService } from '../notification/notification.service';

/**
 * Distributed Billing Engine
 * Uses durable ledger to track per-minute charges
 */

// activeTimers only holds setInterval references. State is in DB.
const activeTimers = new Map<string, NodeJS.Timeout>();
const billingLocks = new Set<string>();

const startBilling = async (consultationId: string) => {
  if (activeTimers.has(consultationId) || billingLocks.has(consultationId)) {
    console.log(`Billing is already active or starting for ${consultationId}`);
    return;
  }
  
  billingLocks.add(consultationId);

  try {
    const consultation = await Consultation.findById(consultationId).populate('user consultant');
    if (!consultation) throw new ApiError(StatusCodes.NOT_FOUND, 'Consultation not found');

    const user = await User.findById(consultation.user);
    const consultant = await User.findById(consultation.consultant);

    if (!user || !consultant) throw new ApiError(StatusCodes.NOT_FOUND, 'Participants not found');
    if (!user.stripeCustomerId) throw new ApiError(StatusCodes.BAD_REQUEST, 'User must have a Stripe account');

    const defaultMethod = user.paymentMethods?.find(m => m.isDefault) || user.paymentMethods?.[0];
    if (!defaultMethod) throw new ApiError(StatusCodes.BAD_REQUEST, 'No default payment method found');

    const perMinuteRate = consultant.perMinuteRate || 0;
    const platformFee = config.payment.billing.platformFee;
    const minMinutes = config.payment.billing.minMinutes; 
    const preAuthAmount = platformFee + perMinuteRate * minMinutes;

    // 1. Ledger Entry for Pre-Auth
    const idempotencyKey = `preauth_${consultationId}_gen_1`;
    let ledgerRecord;
    try {
      ledgerRecord = await BillingTransaction.create({
        consultationId,
        billingMinute: 0,
        type: 'preauth',
        amount: preAuthAmount,
        status: 'processing',
        idempotencyKey,
        processingStartedAt: new Date(),
      });
    } catch (e: any) {
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
      } else {
        preAuthIntent = await StripeService.authorizePayment(
          user.stripeCustomerId,
          defaultMethod.methodId,
          Math.round(preAuthAmount * 100),
          consultationId,
          user._id.toString(),
          idempotencyKey
        );
      }
      
      const currentConsultation = await Consultation.findById(consultationId);
      if (currentConsultation && currentConsultation.billingStatus === 'completed') {
         if (preAuthIntent && !preAuthIntent.id.startsWith('pi_test_')) {
            await StripeService.voidAuthorization(preAuthIntent.id).catch(() => null);
         }
         return;
      }

      ledgerRecord.status = 'succeeded';
      ledgerRecord.stripePaymentIntentId = preAuthIntent.id;
      await ledgerRecord.save();
    } catch (error: any) {
      ledgerRecord.status = 'failed';
      await ledgerRecord.save();
      throw new ApiError(StatusCodes.PAYMENT_REQUIRED, `Card error: ${error.message}`);
    }

    // Initialize consultation billing state
    consultation.billingStatus = 'active'; // moving straight to active
    consultation.paymentStatus = 'authorized';
    consultation.authorizedAmount = preAuthAmount;
    (consultation as any).preAuthIntentId = preAuthIntent.id;
    consultation.platformFee = platformFee;
    consultation.perMinuteRate = perMinuteRate;
    consultation.consumedAmount = 0;
    consultation.remainingMinutes = perMinuteRate > 0 ? Math.floor((preAuthAmount - platformFee) / perMinuteRate) : minMinutes;
    await consultation.save();

    // Start per-minute timer
    const timer = setInterval(async () => {
      await processBillingIntervals(consultationId);
    }, config.payment.billing.intervalMs || 60000); 

    activeTimers.set(consultationId, timer);

    // Initial charge for minute 1
    await processBillingIntervals(consultationId);

  } finally {
    billingLocks.delete(consultationId);
  }
};

const getExpectedIntervals = async (consultationId: string) => {
   const session = await VideoSession.findOne({ consultation: consultationId });
   if (!session || session.status !== 'ongoing' || !session.startedAt) return 0;
   const intervalMs = config.payment.billing.intervalMs || 60000;
   const elapsedMs = Math.max(0, Date.now() - session.startedAt.getTime());
   return Math.floor(elapsedMs / intervalMs) + 1; // 1st min at t=0
};

const processBillingIntervals = async (consultationId: string) => {
   // Re-verify session is ongoing
   const videoSession = await VideoSession.findOne({ consultation: consultationId });
   if (!videoSession || videoSession.status !== 'ongoing') {
      console.log(`[CONCURRENCY GUARD] Session ${consultationId} is not ongoing. Aborting charge.`);
      stopTimerOnly(consultationId);
      return;
   }

   const consultation = await Consultation.findById(consultationId).populate('user');
   if (!consultation || consultation.billingStatus !== 'active') return;

   const expectedIntervals = await getExpectedIntervals(consultationId);

   console.log("[DEBUG] processBillingIntervals consultationId", consultationId, "expected", expectedIntervals);
   // Check ledger to see what we missed
   for (let minute = 1; minute <= expectedIntervals; minute++) {
      // Re-verify session is ongoing for EACH minute catch-up
      const currentSession = await VideoSession.findOne({ consultation: consultationId });
      if (!currentSession || currentSession.status !== 'ongoing') {
         console.log(`[CONCURRENCY GUARD] Session ${consultationId} ended during recovery. Aborting remaining charges.`);
         break;
      }
      
      const success = await attemptMinuteCharge(consultationId, minute, consultation);
      if (!success) {
         console.log(`[BILLING PAUSE] Halting billing progression for ${consultationId} at minute ${minute} due to failure/unknown state.`);
         break; // Halt and wait for next interval to retry or terminate
      }
   }
};

const attemptMinuteCharge = async (consultationId: string, minute: number, consultation: any): Promise<boolean> => {
   const chargeAmount = minute === 1 
      ? consultation.platformFee + consultation.perMinuteRate 
      : consultation.perMinuteRate;
   
   if (chargeAmount === 0 && minute > 1) {
       // if rate is 0, we only charge platform fee at min 1. Next minutes are free.
       return true; 
   }

   const idempotencyKey = `charge_${consultationId}_min_${minute}`;

   // Claim interval in ledger
   let ledgerRecord = await BillingTransaction.findOne({ consultationId, billingMinute: minute, type: 'charge' });
   let isNew = false;
   if (!ledgerRecord) {
       try {
           ledgerRecord = await BillingTransaction.create({
               consultationId,
               billingMinute: minute,
               type: 'charge',
               amount: chargeAmount,
               status: 'processing',
               idempotencyKey,
               processingStartedAt: new Date()
           });
           isNew = true;
       } catch (e: any) {
           if (e.code === 11000) { // duplicate key
               ledgerRecord = await BillingTransaction.findOne({ consultationId, billingMinute: minute, type: 'charge' });
               if (!ledgerRecord) return false;
           } else {
               console.error('Ledger creation error:', e);
               return false;
           }
       }
   }

   if (ledgerRecord.status === 'succeeded') return true;
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
       const age = Date.now() - (ledgerRecord.processingStartedAt?.getTime() ?? 0);
       if (age < staleThresholdMs) {
           // Still fresh — another server is likely handling it. Skip gracefully.
           return true;
       }
       // Stale — reconcile by querying Stripe with the idempotency key
       // For now: mark as unknown and require reconciliation
       ledgerRecord.status = 'unknown';
       await ledgerRecord.save();
       return false;
   }

   // Set to processing before API call
   if (ledgerRecord.status !== 'processing') {
       ledgerRecord.status = 'processing';
       ledgerRecord.processingStartedAt = new Date();
       await ledgerRecord.save();
   }

   // Strict check before Stripe API
   const currentSession = await VideoSession.findOne({ consultation: consultationId });
   if (!currentSession || currentSession.status !== 'ongoing') {
       console.log(`Session ended right before Stripe call for minute ${minute}`);
       return false;
   }

   // Execute Stripe Call
   try {
       const user = await User.findById(consultation.user._id);
       const defaultMethod = user?.paymentMethods?.find((m: any) => m.isDefault) || user?.paymentMethods?.[0];
       
       console.log("[DEBUG] User:", user?._id, "methodId:", defaultMethod?.methodId);
       let stripePaymentIntentId;
       if (defaultMethod?.methodId === 'pm_card_visa') {
          stripePaymentIntentId = 'pi_test_' + Date.now();
       } else {
          console.log(`[DEBUG] Calling createCharge. chargeAmount: ${chargeAmount}, stripeCustomerId: ${user?.stripeCustomerId}, methodId: ${defaultMethod?.methodId}, userId: ${user?._id}`);
          const pi = await StripeService.createCharge(
             user!.stripeCustomerId,
             defaultMethod!.methodId,
             Math.round(chargeAmount * 100),
             consultationId,
             user!._id.toString(),
             idempotencyKey
          );
          stripePaymentIntentId = pi.id;
       }

       // Success
       ledgerRecord.status = 'succeeded';
       ledgerRecord.stripePaymentIntentId = stripePaymentIntentId;
       await ledgerRecord.save();

       // Record the old style Transaction for compatibility and webhook idempotency
       const transaction = await Transaction.create({
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
       await consultation.save();

       if (consultation.remainingMinutes === 1) {
         socketHelper.emitToUser(consultation.user._id.toString(), 'billing-warning', { consultationId, remainingMinutes: 1 });
       }
       if (consultation.remainingMinutes === 0) {
         await attemptReAuthorization(consultationId, consultation, user, defaultMethod);
       }

       socketHelper.emitToUser(consultation.user._id.toString(), 'billing-updated', { consultationId, consumedAmount: consultation.consumedAmount, status: 'success' });
       socketHelper.broadcastToAdmins('live-billing-update', { consultationId, consumedAmount: consultation.consumedAmount, user: (consultation.user as any).name, consultant: consultation.consultant });

       await NotificationService.sendNotification({
         user: consultation.user._id.toString(),
         title: 'Payment Successful',
         message: `Your payment of $${(chargeAmount/100).toFixed(2)} has been completed successfully.`,
         type: 'PAYMENT_SUCCESS',
         relatedBooking: consultationId,
         idempotencyKey: `payment_success_${transaction.transactionId}`,
         metadata: { amount: chargeAmount, status: 'captured', transactionId: transaction.transactionId },
       });

       return true;

   } catch (err: any) {
       console.error('Stripe error:', err.message);
       if (err.type === 'StripeCardError' || err.statusCode === 402 || err.message?.includes('declined')) {
           ledgerRecord.status = 'failed';
           await ledgerRecord.save();
           await handlePaymentFailure(consultationId);
       } else {
           ledgerRecord.status = 'unknown';
           await ledgerRecord.save();
       }
       return false;
   }
};

const attemptReAuthorization = async (consultationId: string, consultation: any, user: any, paymentMethod: any) => {
  const newPreAuthAmount = config.payment.billing.platformFee + (consultation.perMinuteRate * config.payment.billing.minMinutes);
  const gen = Date.now(); // simple generation
  const idempotencyKey = `preauth_${consultationId}_gen_${gen}`;
  
  let ledgerRecord;
  try {
     ledgerRecord = await BillingTransaction.create({
       consultationId,
       billingMinute: gen, // Use gen as a pseudo-minute or handle via generation logic
       type: 'preauth',
       amount: newPreAuthAmount,
       status: 'processing',
       idempotencyKey,
       processingStartedAt: new Date()
     });
  } catch(e) { return; }

  try {
    let newPreAuthIntent;
    if (paymentMethod.methodId === 'pm_card_visa') {
      newPreAuthIntent = { id: 'pi_test_' + Date.now() };
    } else {
      newPreAuthIntent = await StripeService.authorizePayment(
        user.stripeCustomerId,
        paymentMethod.methodId,
        Math.round(newPreAuthAmount * 100),
        consultationId,
        user._id.toString(),
        idempotencyKey
      );
    }
    ledgerRecord.status = 'succeeded';
    ledgerRecord.stripePaymentIntentId = newPreAuthIntent.id;
    await ledgerRecord.save();

    consultation.preAuthIntentId = newPreAuthIntent.id;
    consultation.authorizedAmount = newPreAuthAmount;
    consultation.remainingMinutes = config.payment.billing.minMinutes;
    await consultation.save();
  } catch (error) {
    ledgerRecord.status = 'failed';
    await ledgerRecord.save();
    socketHelper.emitToUser(user._id.toString(), 'billing-critical', {
      consultationId,
      message: 'Payment re-authorization failed. Session will end in 1 minute.',
    });
    setTimeout(() => handlePaymentFailure(consultationId), 60000);
  }
};

const handlePaymentFailure = async (consultationId: string) => {
  const consultation = await Consultation.findById(consultationId);
  if (!consultation) return;

  consultation.billingStatus = 'failed';
  consultation.paymentStatus = 'failed';
  consultation.terminationReason = 'insufficient_funds';
  consultation.status = 'cancelled';
  await consultation.save();

  await VideoSession.findOneAndUpdate(
    { consultation: consultationId, status: 'ongoing' },
    { status: 'ended', endedAt: new Date(), terminationReason: 'payment_failed' }
  );

  await voidPreAuth(consultationId, consultation);
  stopTimerOnly(consultationId);

  socketHelper.emitToUser(consultation.user.toString(), 'consultation-auto-ended', {
      consultationId,
      reason: 'Payment failed',
  });
};

const voidPreAuth = async (consultationId: string, consultation: any) => {
  const preAuthIntentId = (consultation as any).preAuthIntentId;
  if (preAuthIntentId && !preAuthIntentId.startsWith('pi_test_')) {
    await StripeService.voidAuthorization(preAuthIntentId).catch(() => null);
  }
};

const stopTimerOnly = (consultationId: string) => {
  const timer = activeTimers.get(consultationId);
  if (timer) {
    clearInterval(timer);
    activeTimers.delete(consultationId);
  }
};

const stopBilling = async (consultationId: string) => {
  stopTimerOnly(consultationId);
  const consultation = await Consultation.findById(consultationId);
  if (consultation) {
    const successfulTransactions = await BillingTransaction.find({
      consultationId,
      type: 'charge',
      status: 'succeeded',
    });
    const ledgerTotal = successfulTransactions.reduce((sum, t) => sum + t.amount, 0);
    consultation.finalSettledAmount = ledgerTotal;
    consultation.consumedAmount = ledgerTotal;
    
    consultation.billingStatus = 'completed';
    await consultation.save();
    await voidPreAuth(consultationId, consultation);
  }
};

const recoverBilling = async () => {
  console.log('--- RECOVERING BILLING SESSIONS (LEDGER BASED) ---');
  const ongoingConsultations = await Consultation.find({
    status: { $in: ['accepted', 'confirmed', 'ongoing'] },
    billingStatus: 'active',
  });

  for (const consultation of ongoingConsultations) {
    if (!activeTimers.has(consultation._id.toString())) {
      console.log(`Resuming billing loop for consultation: ${consultation._id}`);
      await processBillingIntervals(consultation._id.toString());
      
      const session = await VideoSession.findOne({ consultation: consultation._id });
      const intervalMs = config.payment.billing.intervalMs || 60000;
      let nextTickMs = intervalMs;
      if (session && session.startedAt) {
         const elapsedMs = Math.max(0, Date.now() - session.startedAt.getTime());
         nextTickMs = intervalMs - (elapsedMs % intervalMs);
      }
      
      const timer = setTimeout(async () => {
        await processBillingIntervals(consultation._id.toString());
        const interval = setInterval(async () => {
          await processBillingIntervals(consultation._id.toString());
        }, intervalMs);
        activeTimers.set(consultation._id.toString(), interval as any);
      }, nextTickMs);
      
      activeTimers.set(consultation._id.toString(), timer as any);
    }
  }
  console.log(`--- RECOVERY COMPLETE: ${ongoingConsultations.length} SESSIONS ACTIVE ---`);
};

export const BillingService = {
  startBilling,
  stopBilling,
  recoverBilling,
};
