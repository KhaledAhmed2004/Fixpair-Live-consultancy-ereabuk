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

describe('billing.recovery-mechanics', () => {

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

    it('Test 2: Recovery With Server Downtime', async () => {
      console.info(`
📝 USER STORY:
Title: Recover Missed Charges If The Server Crashes And Restarts

As a billing system
I want to recover missed charges if the server crashes and restarts
So that the system remains financially accurate

📖 BDD SCENARIO: RECOVERY WITH DOWNTIME
Feature: Recovery Mechanics

Given the server was down for several minutes during an active session
When the server restarts and recoverBilling is called
Then it calculates the exact missing charges and catches up via Stripe

🏛️ ARCHITECTURAL DECISION RECORD (ADR)
Decision: Use time elapsed against \`startedAt\` instead of arbitrary counters to determine missing intervals.
Reason: Time-based recovery is deterministic and immune to clock drift or partial server crashes. It guarantees we eventually process exact N intervals.
`
);
      const pastStart = new Date(Date.now() - 300000); // Started 5 mins ago (t=0, t=1, t=2, t=3, t=4, t=5 = 6 expected charges)
      mockVideoSession.startedAt = pastStart;
      
      (Consultation.find as any).mockResolvedValue([mockConsultation]);
      
      mockConsultation.billingStatus = 'active';
      // Expected = 6. Actual = 2.
      await (BillingTransaction as any).create({ consultationId: currentConsultationId, billingMinute: 1, type: 'charge', status: 'succeeded' });
      await (BillingTransaction as any).create({ consultationId: currentConsultationId, billingMinute: 2, type: 'charge', status: 'succeeded' });
      
      // Expected = 6. Actual = 2. Missing = 4.
      // So recoverBilling should trigger 4 catches.
      
      await BillingService.recoverBilling();
      
      expect(StripeService.createCharge).toHaveBeenCalledTimes(4);
      expect(StripeService.createCharge).toHaveBeenCalledWith('cus_test', 'pm_test', 2, currentConsultationId, 'user_id', expect.any(String));

      logService('BillingService.recoverBilling', { missingIntervals: 4, amount: 2 }, { catchupChargesExecuted: 4 }, 'SERVICE-RECOVERY', 'System successfully recovers missed intervals');
    });
    
    it('Test 3: Recovery With No Missing Billing', async () => {
      console.info(`
📝 USER STORY:
Title: Avoid Double-charging During Recovery If No Time Was Missed

As a billing system
I want to avoid double-charging during recovery if no time was missed
So that users are billed accurately

📖 BDD SCENARIO: NO MISSING BILLING RECOVERY
Feature: Recovery Mechanics

Given the server restarts but no billable minutes were missed
When recoverBilling is called
Then no catch-up charges are created

🏛️ ARCHITECTURAL DECISION RECORD (ADR)
Decision: Query \`BillingTransaction\` ledger to verify if intervals actually exist.
Reason: To enforce idempotency, we MUST check the database for past transactions before assuming an interval was missed.
`
);
      const pastStart = new Date(Date.now() - 60000); // Started 1 min ago (2 expected charges: t=0 and t=1)
      mockVideoSession.startedAt = pastStart;
      
      (Consultation.find as any).mockResolvedValue([mockConsultation]);
      
      mockConsultation.billingStatus = 'active';
      await (BillingTransaction as any).create({ consultationId: currentConsultationId, billingMinute: 1, type: 'charge', status: 'succeeded' });
      await (BillingTransaction as any).create({ consultationId: currentConsultationId, billingMinute: 2, type: 'charge', status: 'succeeded' });
      
      await BillingService.recoverBilling();
      
      // Expected = 2, Actual = 2. No catch-up charge.
      expect(StripeService.createCharge).toHaveBeenCalledTimes(0);
    });

    it('Test 4: Recovery Followed by Normal Timer', async () => {
      console.info(`
📝 USER STORY:
Title: Seamlessly Resume The Regular Interval Timer After Recovery

As a billing system
I want to seamlessly resume the regular interval timer after recovery
So that ongoing sessions continue to bill correctly

📖 BDD SCENARIO: RECOVERY TIMER HANDOVER
Feature: Recovery Mechanics

Given the server catches up on missed charges
When the recovery is complete
Then it calculates the exact remaining milliseconds to the next interval and schedules it

🏛️ ARCHITECTURAL DECISION RECORD (ADR)
Decision: Use absolute modulo time \`(elapsedMs % 60000)\` for next tick calculation instead of a naive 60000ms delay.
Reason: Prevents interval drifting. A restart halfway through a minute will properly schedule the next tick in 30 seconds to maintain rigid alignment.
`
);
      // 2.5 minutes elapsed. Expected charges = 3 (t=0, t=1, t=2).
      const pastStart = new Date(Date.now() - 150000);
      mockVideoSession.startedAt = pastStart;
      
      (Consultation.find as any).mockResolvedValue([mockConsultation]);
      
      mockConsultation.billingStatus = 'active';
      await (BillingTransaction as any).create({ consultationId: currentConsultationId, billingMinute: 1, type: 'charge', status: 'succeeded' });
      await (BillingTransaction as any).create({ consultationId: currentConsultationId, billingMinute: 2, type: 'charge', status: 'succeeded' });
      
      await BillingService.recoverBilling();
      
      // Catch-up charge for t=2
      expect(StripeService.createCharge).toHaveBeenCalledTimes(1);
      
      // The time elapsed is 150000. 150000 % 60000 = 30000.
      // Next charge should be in 30000ms.
      await vi.advanceTimersByTimeAsync(29000);
      expect(StripeService.createCharge).toHaveBeenCalledTimes(1); // Not yet
      
      await vi.advanceTimersByTimeAsync(1000);
      expect(StripeService.createCharge).toHaveBeenCalledTimes(2); // Next charge triggered
      
      // Next charge should be in 60000ms
      await vi.advanceTimersByTimeAsync(60000);
      expect(StripeService.createCharge).toHaveBeenCalledTimes(3); 
    });

    it('Test 5: Session Ended During Recovery', async () => {
      console.info(`
📝 USER STORY:
Title: Stop The Recovery Loop If The User Ends The Session During Catch-up

As a billing system
I want to stop the recovery loop if the user ends the session during catch-up
So that we don't continue charging for a finalized session

📖 BDD SCENARIO: SESSION ENDS DURING RECOVERY
Feature: Recovery Mechanics

Given the system is processing a batch of catch-up charges
When stopBilling is called concurrently
Then the recovery loop immediately halts

🏛️ ARCHITECTURAL DECISION RECORD (ADR)
Decision: Validate session status before EACH catch-up charge in a loop.
Reason: A user might end the session while the backend is slowly chewing through pending catch-up charges. We must halt instantly.
`
);
      const pastStart = new Date(Date.now() - 300000);
      mockVideoSession.startedAt = pastStart;
      
      (Consultation.find as any).mockResolvedValue([mockConsultation]);
      
      mockConsultation.billingStatus = 'active';
      await (BillingTransaction as any).create({ consultationId: currentConsultationId, billingMinute: 1, type: 'charge', status: 'succeeded' });
      await (BillingTransaction as any).create({ consultationId: currentConsultationId, billingMinute: 2, type: 'charge', status: 'succeeded' });
      
      // Mock `attemptMinuteCharge` internal wait to be stoppable
      let chargeResolver!: (val: any) => void;
      const chargePromise = new Promise((resolve) => { chargeResolver = resolve; });
      
      let stripeCalledResolver!: () => void;
      const stripeCalledPromise = new Promise<void>((resolve) => { stripeCalledResolver = resolve; });
      
      (StripeService.createCharge as any).mockImplementationOnce(() => {
        stripeCalledResolver();
        return chargePromise;
      });
      
      const recoverPromise = BillingService.recoverBilling();
      
      // Wait deterministically for the exact moment the charge pauses
      await stripeCalledPromise;
      
      // Stop billing while the first catch-up is pending
      await BillingService.stopBilling(currentConsultationId);
      mockVideoSession.status = 'completed';
      
      chargeResolver!({ id: 'done' });
      await recoverPromise;
      
      // Since it was stopped mid-recovery, it shouldn't proceed to do the other 3 catch-up charges
      expect(StripeService.createCharge).toHaveBeenCalledTimes(1);

      logService('BillingService.recoverBilling', { interrupted: true }, { completedCharges: 1, abortedCharges: 3 }, 'SERVICE-RECOVERY-INTERRUPT', 'System correctly halts recovery if session ends');
    });
});
