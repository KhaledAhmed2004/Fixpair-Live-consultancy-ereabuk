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

describe('billing.ledger-integrity', () => {

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

    it('Test 8: Gap recovery: charges only the missing minute', async () => {
      mockVideoSession.startedAt = new Date(Date.now() - 230000); // 3.8 mins elapsed (expected = 4 intervals)
      mockConsultation.billingStatus = 'active';
      (Consultation.find as any).mockResolvedValue([mockConsultation]);

      // Create minutes 1, 2, and 4. Minute 3 is missing.
      await (BillingTransaction as any).create({ consultationId: currentConsultationId, billingMinute: 1, type: 'charge', status: 'succeeded', idempotencyKey: 'charge_consultation_id_min_1' });
      await (BillingTransaction as any).create({ consultationId: currentConsultationId, billingMinute: 2, type: 'charge', status: 'succeeded', idempotencyKey: 'charge_consultation_id_min_2' });
      await (BillingTransaction as any).create({ consultationId: currentConsultationId, billingMinute: 4, type: 'charge', status: 'succeeded', idempotencyKey: 'charge_consultation_id_min_4' });

      (StripeService.createCharge as any).mockResolvedValue({ id: 'pi_test_charge_3' });

      // Run recovery
      await BillingService.recoverBilling();

      // Only minute 3 should be charged
      expect(StripeService.createCharge).toHaveBeenCalledTimes(1);
      expect(StripeService.createCharge).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        currentConsultationId,
        expect.anything(),
        `charge_${currentConsultationId}_min_3`
      );
    });

    it('Test 9: MongoDB duplicate key (11000) is handled', async () => {
      mockConsultation.billingStatus = 'active';
      mockVideoSession.startedAt = new Date(Date.now() - 70000); // 2nd min
      (Consultation.find as any).mockResolvedValue([mockConsultation]);


      // Seed minute 1 only!
      await (BillingTransaction as any).create({ consultationId: currentConsultationId, billingMinute: 1, type: 'charge', status: 'succeeded', idempotencyKey: 'charge_consultation_id_min_1' });

      // When it tries to create minute 2, it fails with 11000
      const origCreate = (BillingTransaction.create as any).getMockImplementation();
      let hasThrown = false;
      (BillingTransaction.create as any).mockImplementation((doc: any) => {
        if (!hasThrown && doc.consultationId === currentConsultationId) {
            hasThrown = true;
            return Promise.reject({ code: 11000 });
        }
        return origCreate(doc);
      });
      
      let findCount = 0;
      const origFindOne = (BillingTransaction.findOne as any).getMockImplementation();
      (BillingTransaction.findOne as any).mockImplementation((query: any) => {
         if (query.billingMinute === 2) {
             findCount++;
             if (findCount === 1) return Promise.resolve(null);
             return Promise.resolve({ status: 'succeeded' });
         }
         return origFindOne(query);
      });

      await BillingService.recoverBilling();

      // It should catch the 11000, do findOne, see it succeeded, and NOT call Stripe
      expect(StripeService.createCharge).not.toHaveBeenCalled();

      // Restore
      (BillingTransaction.findOne as any).mockImplementation(origFindOne);
      (BillingTransaction.create as any).mockImplementation(origCreate);
    });

    it('Test 10: Stale processing (> 2 min) is treated as unknown, blocks next minute', async () => {
      mockVideoSession.startedAt = new Date(Date.now() - 130000); // 2.1 mins elapsed (expected = 3 intervals)
      mockConsultation.billingStatus = 'active';
      (Consultation.find as any).mockResolvedValue([mockConsultation]);

      // Add minute 1 as succeeded
      await (BillingTransaction as any).create({ 
        consultationId: currentConsultationId, 
        billingMinute: 1, 
        type: 'charge', 
        status: 'succeeded', 
        idempotencyKey: 'charge_consultation_id_min_1' 
      });

      // Stale processing record for minute 2
      await (BillingTransaction as any).create({ 
        consultationId: currentConsultationId, 
        billingMinute: 2, 
        type: 'charge', 
        status: 'processing', 
        idempotencyKey: 'charge_consultation_id_min_2',
        processingStartedAt: new Date(Date.now() - 3 * 60 * 1000) // 3 mins old
      });

      await BillingService.recoverBilling();

      const ledger = await (BillingTransaction as any).findOne({ consultationId: currentConsultationId, billingMinute: 2, type: 'charge' });
      console.log('Test 10 ledger record:', ledger);
      expect(ledger.status).toBe('unknown');
      expect(StripeService.createCharge).not.toHaveBeenCalled(); // Neither 2 nor 3 calls Stripe
    });

    it('Test 11: Fresh processing (< 2 min) is skipped safely', async () => {
      mockVideoSession.startedAt = new Date(Date.now() - 130000); // 2+ mins elapsed
      mockConsultation.billingStatus = 'active';

      // Fresh processing record for minute 2
      await (BillingTransaction as any).create({ 
        consultationId: currentConsultationId, 
        billingMinute: 2, 
        type: 'charge', 
        status: 'processing', 
        idempotencyKey: 'charge_consultation_id_min_2',
        processingStartedAt: new Date(Date.now() - 10 * 1000) // 10 secs old
      });

      await BillingService.recoverBilling();

      // It should just return true (skip) for minute 2. It does not mark it unknown.
      const ledger = await (BillingTransaction as any).findOne({ consultationId: currentConsultationId, billingMinute: 2, type: 'charge' });
      expect(ledger.status).toBe('processing');
      expect(StripeService.createCharge).not.toHaveBeenCalled();
    });
});
