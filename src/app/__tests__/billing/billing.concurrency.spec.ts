import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BillingService } from '../../modules/payment/billing.service';
import { StripeService } from '../../modules/payment/stripe.service';
import { Consultation } from '../../modules/consultation/consultation.model';
import { User } from '../../modules/user/user.model';
import { VideoSession } from '../../modules/videoSession/videoSession.model';
import { BillingTransaction, Transaction } from '../../modules/payment/payment.model';
import { createBillingFixtures } from './_shared/billing.fixtures';
import { logService } from './_shared/billing.helpers';

vi.mock('../../modules/payment/stripe.service', () => ({ StripeService: { authorizePayment: vi.fn(), createCharge: vi.fn(), voidAuthorization: vi.fn() } }));
vi.mock('../../modules/consultation/consultation.model', () => ({ Consultation: { findById: vi.fn(), findByIdAndUpdate: vi.fn(), find: vi.fn() } }));
vi.mock('../../modules/user/user.model', () => ({ User: { findById: vi.fn() } }));
vi.mock('../../modules/videoSession/videoSession.model', () => ({ VideoSession: { findOne: vi.fn(), findOneAndUpdate: vi.fn() } }));
vi.mock('../../modules/payment/payment.model', () => {
  const ledgerMap = new Map();
  return {
    Transaction: { create: vi.fn().mockImplementation(() => Promise.resolve({ status: 'processing', save: vi.fn() })), find: vi.fn().mockResolvedValue([]) },
    BillingTransaction: {
      create: vi.fn().mockImplementation((doc) => {
        const d = { ...doc, status: doc.status || 'processing', save: vi.fn() };
        ledgerMap.set(`${doc.consultationId}_${doc.billingMinute}_${doc.type}`, d);
        return Promise.resolve(d);
      }),
      findOne: vi.fn().mockImplementation((query) => Promise.resolve(ledgerMap.get(`${query.consultationId}_${query.billingMinute}_${query.type}`) || null)),
      find: vi.fn().mockImplementation((query) => {
        return Promise.resolve(Array.from(ledgerMap.values()).filter((doc) => {
          if (query.consultationId && doc.consultationId.toString() !== query.consultationId.toString()) return false;
          if (query.type && doc.type !== query.type) return false;
          if (query.status && doc.status !== query.status) return false;
          return true;
        }));
      }),
      _clearLedger: () => ledgerMap.clear(),
    },
  };
});
vi.mock('../../../helpers/socketHelper', () => ({ socketHelper: { emitToUser: vi.fn(), broadcastToAdmins: vi.fn() } }));
vi.mock('../../modules/notification/notification.service', () => ({ NotificationService: { sendNotification: vi.fn() } }));

describe('billing.concurrency', () => {

  let mockConsultation: any;
  let mockUser: any;
  let mockConsultant: any;
  let mockVideoSession: any;
  let currentConsultationId: string;

  beforeEach(() => {
    const fixtures = createBillingFixtures(Consultation, VideoSession, User, StripeService, Transaction, BillingTransaction);
    currentConsultationId = fixtures.currentConsultationId;
    mockUser = fixtures.mockUser;
    mockConsultant = fixtures.mockConsultant;
    mockConsultation = fixtures.mockConsultation;
    mockVideoSession = fixtures.mockVideoSession;
  });

  afterEach(async () => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    await BillingService.stopBilling(currentConsultationId);
  });

    it('Test 1: True Minute Boundary Async Race', async () => {
      console.info(`
📝 USER STORY:
Title: Prevent Stripe Charges If The Session Ends Exactly When A Charge Is Being Calculated

As a billing system
I want to prevent Stripe charges if the session ends exactly when a charge is being calculated
So that users are never charged for a minute if they ended the call

📖 BDD SCENARIO: MINUTE BOUNDARY ASYNC RACE
Feature: Concurrency & Race Conditions

Given the billing system is actively calculating a charge
When the user ends the session (stopBilling) during a database await
Then the charge process must abort synchronously before calling Stripe
`);
      // Start billing normally
      await BillingService.startBilling(currentConsultationId);
      
      let findResolver!: (val: any) => void;
      const findPromise = new Promise((resolve) => { findResolver = resolve; });
      
      // Block the final strict guard in minute 2
      let sessionFindCalls = 0;
      (VideoSession.findOne as any).mockImplementation(() => {
         sessionFindCalls++;
         console.log('VideoSession.findOne called: ' + sessionFindCalls);
         if (sessionFindCalls === 4) {
             console.log('Blocking on call 4!');
             return findPromise.then((val) => {
                 console.log('Call 4 resolved with status:', (val as any).status);
                 return val;
             });
         }
         return Promise.resolve(mockVideoSession);
      });
      
      // Trigger minute 2 processing
      vi.advanceTimersByTime(60000);
      
      // Now it's blocked inside attemptMinuteCharge, RIGHT before Stripe call!
      // The user concurrently ends the session!
      // (In reality, the controller ends the session first, then calls stopBilling)
      mockVideoSession.status = 'ended';
      await BillingService.stopBilling(currentConsultationId);
      
      // Now resolve the paused Promise!
      // It should read the newly updated session status!
      findResolver(mockVideoSession);
      
      await Promise.resolve();
      await Promise.resolve(); // flush microtasks
      
      // The strict final guard should have prevented StripeService.createCharge for minute 2
      expect(StripeService.createCharge).toHaveBeenCalledTimes(1); 
      expect(Transaction.create).toHaveBeenCalledTimes(1); 
      expect(mockConsultation.consumedAmount).toBe(7);

      logService('BillingService.stopBilling', { consultationId: currentConsultationId, activeRaceCondition: true }, { abortedStripeCall: true, totalCharges: 1, consumedAmount: 7 }, 'SERVICE-RACE-CONDITION', 'System safely aborts charge during concurrent stop');
    });
    
    it('Test 6: Re-auth race: Voids newly created pre-auth if session ends concurrently', async () => {
      console.info(`
📝 USER STORY:
Title: Void Any In-flight Pre-authorizations If The Session Ends

As a billing system
I want to void any in-flight pre-authorizations if the session ends
So that orphaned holds are not left on the user's card

📖 BDD SCENARIO: RE-AUTH RACE CONDITION
Feature: Concurrency & Race Conditions

Given a re-authorization is in flight
When the session ends concurrently
Then the newly created pre-auth must be immediately voided upon resolution
`);
      mockConsultation.remainingMinutes = 1;
      let authorizeResolver!: (val: any) => void;
      const authorizePromise = new Promise((resolve) => { authorizeResolver = resolve; });
      (StripeService.authorizePayment as any).mockReturnValue(authorizePromise);
      
      (Consultation.findById as any)
        .mockImplementationOnce(() => ({
          ...mockConsultation,
          then: function(resolve: any) { resolve(mockConsultation); },
          populate: vi.fn().mockResolvedValue(mockConsultation),
        })) // for initial startBilling (populate)
        .mockImplementationOnce(() => ({
          ...mockConsultation,
          then: function(resolve: any) { resolve(mockConsultation); },
          populate: vi.fn().mockResolvedValue(mockConsultation),
        })) // for stopBilling (findById)
        .mockImplementationOnce(() => ({
          ...mockConsultation,
          then: function(resolve: any) { resolve(mockConsultation); },
          populate: vi.fn().mockResolvedValue(mockConsultation),
        })); // for startBilling (currentConsultation)

      const startPromise = BillingService.startBilling(currentConsultationId);
      await vi.advanceTimersByTimeAsync(1);
      
      await BillingService.stopBilling(currentConsultationId);
      authorizeResolver!({ id: 'pi_preauth_orphaned' });
      
      await startPromise;
      await vi.advanceTimersByTimeAsync(1);

      expect(StripeService.voidAuthorization).toHaveBeenCalledWith('pi_preauth_orphaned');

      logService('StripeService.voidAuthorization', { intentId: 'pi_preauth_orphaned' }, { status: 'voided' }, 'SERVICE-ORPHANED-PREAUTH', 'System voids newly created pre-auth after concurrent end');
    });

    it('Test 16: Concurrent Server A + B both attempt minute 2', async () => {
      mockConsultation.billingStatus = 'active';
      mockVideoSession.startedAt = new Date(Date.now() - 70000); // 2nd min
      (Consultation.find as any).mockResolvedValue([mockConsultation]);


      // Seed minute 1
      await (BillingTransaction as any).create({ consultationId: currentConsultationId, billingMinute: 1, type: 'charge', status: 'succeeded', idempotencyKey: 'charge_consultation_id_min_1' });

      const origCreate = (BillingTransaction.create as any).getMockImplementation();
      const origFindOne = (BillingTransaction.findOne as any).getMockImplementation();
      
      // First attempt succeeds in Mongo, second fails with 11000
      (BillingTransaction.create as any).mockImplementationOnce((doc: any) => {
        const d = { ...doc, status: 'processing', save: vi.fn() };
        (BillingTransaction as any)._setForFindOne(d);
        return Promise.resolve(d);
      });
      (BillingTransaction.create as any).mockImplementationOnce(() => Promise.reject({ code: 11000 }));

      // Mock the internal findOne to return the created doc
      let savedDoc: any = null;
      (BillingTransaction as any)._setForFindOne = (doc: any) => { savedDoc = doc; };
      (BillingTransaction.findOne as any).mockImplementation((query: any) => {
        if (savedDoc && savedDoc.billingMinute === query.billingMinute) {
           return Promise.resolve(savedDoc);
        }
        return origFindOne(query);
      });

      // Server A and B recover concurrently
      await Promise.all([
        BillingService.recoverBilling(),
        BillingService.recoverBilling()
      ]);

      // Assert that despite two parallel runs, Stripe was called EXACTLY once
      expect(StripeService.createCharge).toHaveBeenCalledTimes(1);

      // Restore
      (BillingTransaction.findOne as any).mockImplementation(origFindOne);
      (BillingTransaction.create as any).mockImplementation(origCreate);
    });

    it('Test 17: Pre-auth lifecycle (created -> session ends -> voided)', async () => {
      mockConsultation.preAuthIntentId = 'pi_preauth_123';
      await BillingService.stopBilling(currentConsultationId);
      
      expect(StripeService.voidAuthorization).toHaveBeenCalledWith('pi_preauth_123');
      expect(mockConsultation.billingStatus).toBe('completed');
    });
});
