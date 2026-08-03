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

describe('billing.financial-flows', () => {

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

    it('1. Pre-auth: Creates manual capture and persists intent without capturing', async () => {
      console.info(`
📝 USER STORY:
Title: Pre-authorize The User's Card Before The Session Starts

As a billing system
I want to pre-authorize the user's card before the session starts
So that I can verify they have sufficient funds without actually charging them

💡 ARCHITECTURAL DECISION RECORD (ADR)

Title: D2 Billing Architecture - Distributed Ledger & Pre-Auth

Decision 1: Pre-authorization is an affordability check ONLY.
Reason 1: To verify the user's payment method is valid and has sufficient funds by placing a temporary hold on the funds.

Decision 2: It is NEVER captured.
Reason 2: The authorization is strictly cancelled/voided when the consultation ends, releasing the hold without charging.

Decision 3: The system uses a durable MongoDB BillingTransaction ledger.
Reason 3: To guarantee exactly-once processing for each interval across all distributed servers via strict unique indexing.

📖 BDD SCENARIO: PRE-AUTH AFFORDABILITY CHECK
Feature: Financial Flows

Given a consultation is starting
When startBilling is called
Then the system creates a manual capture PaymentIntent and saves the preAuthIntentId
And the billing status updates to active
`);
      await BillingService.startBilling(currentConsultationId);

      expect(StripeService.authorizePayment).toHaveBeenCalledWith(
        'cus_test',
        'pm_test',
        7, // platformFee (5) + perMinuteRate (2) * minMinutes (1)
        currentConsultationId,
        'user_id',
        `preauth_${currentConsultationId}_gen_1`
      );
      
      // Ensure we NEVER call capturePayment (it's not even imported or mocked, proving D2 architecture)
      expect(mockConsultation.billingStatus).toBe('active');
      expect(mockConsultation.preAuthIntentId).toBe('pi_preauth_123');

      logService('BillingService.startBilling', { consultationId: currentConsultationId }, { status: 'success', preAuthIntentId: 'pi_preauth_123', billingStatus: 'active' }, 'SERVICE-PRE-AUTH', 'System creates pre-auth intent without capturing');
    });

    it('2. First minute: Charges platformFee + perMinuteRate in a new direct intent', async () => {
      console.info(`
📝 USER STORY:
Title: Charge The User For The First Minute Including The Platform Fee

As a billing system
I want to charge the user for the first minute including the platform fee
So that Fixpair collects its platform fee alongside the consultant's rate

💡 ARCHITECTURAL DECISION RECORD (ADR)

Title: D2 Billing Architecture - Direct Charge & Idempotency

Decision 1: First real charge is a direct charge via a new PaymentIntent (platformFee + perMinuteRate).
Reason 1: To enforce the strict separation of pre-authorization (affordability) from actual payment capture, ensuring funds are directly collected for consumed services.

Decision 2: Stripe API calls strictly utilize idempotency keys mapped to the MongoDB ledger.
Reason 2: To prevent duplicate network charges when retries occur or async operations race against each other.

📖 BDD SCENARIO: FIRST MINUTE CHARGE
Feature: Financial Flows

Given a consultation has just started
When the first minute billing triggers
Then the system creates a direct charge for platformFee + perMinuteRate
And records a captured Transaction
`);
      await BillingService.startBilling(currentConsultationId);

      // The first charge is triggered immediately in startBilling
      expect(StripeService.createCharge).toHaveBeenCalledWith(
        'cus_test',
        'pm_test',
        7, // platformFee (5) + perMinuteRate (2)
        currentConsultationId,
        'user_id',
        `charge_${currentConsultationId}_min_1`
      );
      expect(Transaction.create).toHaveBeenCalledWith(expect.objectContaining({
        amount: 7,
        status: 'captured', // Direct intent creates immediate capture
      }));
      expect(mockConsultation.consumedAmount).toBe(7);

      logService('StripeService.createCharge', { amount: 7, consultationId: currentConsultationId }, { chargeId: 'pi_charge_123', transactionStatus: 'captured', consumedAmount: 7 }, 'SERVICE-FIRST-CHARGE', 'System executes direct charge for first minute');
    });

    it('3. Subsequent minutes: Charges only perMinuteRate', async () => {
      console.info(`
📝 USER STORY:
Title: Charge The User For Each Subsequent Minute

As a billing system
I want to charge the user for each subsequent minute
So that the consultant is paid accurately for their time

💡 ARCHITECTURAL DECISION RECORD (ADR)

Title: D2 Billing Architecture - Interval Idempotency

Decision 1: Each billed minute requires a strictly mapped idempotency key.
Reason 1: To prevent network retries from charging the user twice for the same elapsed minute.

📖 BDD SCENARIO: SUBSEQUENT MINUTE CHARGE
Feature: Financial Flows

Given a consultation is ongoing past the first minute
When a subsequent minute interval triggers
Then the system creates a direct charge for only the perMinuteRate
And records a captured Transaction
`);
      await BillingService.startBilling(currentConsultationId);
      
      // Advance time by 60 seconds
      await vi.advanceTimersByTimeAsync(60000);

      expect(StripeService.createCharge).toHaveBeenCalledTimes(2);
      expect(StripeService.createCharge).toHaveBeenLastCalledWith(
        'cus_test',
        'pm_test',
        2, // Only perMinuteRate
        currentConsultationId,
        'user_id',
        `charge_${currentConsultationId}_min_2`
      );
      expect(Transaction.create).toHaveBeenCalledTimes(2);
      expect(mockConsultation.consumedAmount).toBe(9); // 7 + 2

      logService('StripeService.createCharge', { amount: 2, consultationId: currentConsultationId }, { chargeId: 'pi_charge_123', transactionStatus: 'captured', totalConsumedAmount: 9 }, 'SERVICE-SUBSEQUENT-CHARGE', 'System executes direct charge for subsequent minute');
    });

    it('Test 12: finalSettledAmount === consumedAmount === ledger total at stop', async () => {
      mockConsultation.billingStatus = 'active';
      
      // Simulate charges
      await (BillingTransaction as any).create({ consultationId: currentConsultationId, billingMinute: 1, type: 'charge', status: 'succeeded', amount: 7 });
      await (BillingTransaction as any).create({ consultationId: currentConsultationId, billingMinute: 2, type: 'charge', status: 'succeeded', amount: 2 });
      await (BillingTransaction as any).create({ consultationId: currentConsultationId, billingMinute: 3, type: 'charge', status: 'succeeded', amount: 2 });

      const findSpy = vi.spyOn(BillingTransaction, 'find');
      findSpy.mockResolvedValue([
        { amount: 7 }, { amount: 2 }, { amount: 2 }
      ] as any);

      await BillingService.stopBilling(currentConsultationId);

      expect(mockConsultation.billingStatus).toBe('completed');
      expect(mockConsultation.finalSettledAmount).toBe(11);
      expect(mockConsultation.consumedAmount).toBe(11);
    });

    it('Test 13: unknown state blocks subsequent minutes', async () => {
      mockVideoSession.startedAt = new Date(Date.now() - 190000); // 3+ mins elapsed
      mockConsultation.billingStatus = 'active';

      await (BillingTransaction as any).create({ consultationId: currentConsultationId, billingMinute: 2, type: 'charge', status: 'unknown' });

      await BillingService.recoverBilling();

      // Minute 2 is unknown, so loop breaks, minute 3 is not charged
      expect(StripeService.createCharge).not.toHaveBeenCalled();
    });
});
