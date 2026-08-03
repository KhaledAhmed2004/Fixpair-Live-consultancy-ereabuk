import { vi } from 'vitest';

export function createBillingFixtures(
  Consultation: any,
  VideoSession: any,
  User: any,
  StripeService: any,
  Transaction: any,
  BillingTransaction: any
) {
  vi.useFakeTimers();
  vi.clearAllMocks();
  if (BillingTransaction && typeof BillingTransaction._clearLedger === 'function') {
    BillingTransaction._clearLedger();
  }

  const currentConsultationId = `consultation_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  const mockUser = {
    _id: 'user_id',
    stripeCustomerId: 'cus_test',
    paymentMethods: [{ isDefault: true, methodId: 'pm_test', provider: 'stripe' }],
    name: 'Test User',
  };

  const mockConsultant = {
    _id: 'consultant_id',
    perMinuteRate: 2,
  };

  const mockConsultation: any = {
    _id: currentConsultationId,
    user: mockUser,
    consultant: mockConsultant,
    status: 'accepted',
    billingStatus: 'pending',
    paymentStatus: 'pending',
    platformFee: 5,
    perMinuteRate: 2,
    consumedAmount: 0,
    save: vi.fn().mockResolvedValue(true),
  };

  const mockVideoSession: any = {
    _id: 'session_id',
    consultation: currentConsultationId,
    status: 'ongoing',
    startedAt: new Date(Date.now()),
  };

  // Default mocks
  mockConsultation.populate = vi.fn().mockResolvedValue(mockConsultation);
  mockConsultation.select = vi.fn().mockResolvedValue({ preAuthIntentId: 'pi_preauth_123' });
  
  const createMongooseMock = (data: any) => {
    const resultObj = {
      ...data,
      save: vi.fn().mockImplementation(function (this: any) {
        Object.assign(data, this);
        return Promise.resolve(true);
      })
    };
    return {
      populate: vi.fn().mockResolvedValue(resultObj),
      select: vi.fn().mockResolvedValue({ ...resultObj, preAuthIntentId: 'pi_preauth_123' }),
      then: function(resolve: any) { resolve(resultObj); }
    };
  };

  (Consultation.findById as any).mockImplementation(() => createMongooseMock(mockConsultation));
  (Consultation.find as any).mockResolvedValue([]);
  (VideoSession.findOne as any).mockImplementation(() => Promise.resolve(mockVideoSession));
  (VideoSession.findOneAndUpdate as any).mockImplementation((query: any, update: any) => {
     if (update && update.status) {
       mockVideoSession.status = update.status;
     }
     if (update && update.endedAt) {
       mockVideoSession.endedAt = update.endedAt;
     }
     return Promise.resolve(mockVideoSession);
  });
  (User.findById as any).mockImplementation((id: any) => {
    const idStr = id?._id?.toString() || id?.toString();
    if (idStr === 'user_id') return mockUser;
    if (idStr === 'consultant_id') return mockConsultant;
    return null;
  });
  (VideoSession.findOne as any).mockResolvedValue(mockVideoSession);
  (StripeService.authorizePayment as any).mockResolvedValue({ id: 'pi_preauth_123' });
  (StripeService.createCharge as any).mockResolvedValue({ id: 'pi_charge_123' });
  (StripeService.voidAuthorization as any).mockResolvedValue(true);
  (Transaction.create as any).mockResolvedValue({ transactionId: 'txn_123' });
  (Transaction.find as any).mockResolvedValue([]);

  return {
    currentConsultationId,
    mockUser,
    mockConsultant,
    mockConsultation,
    mockVideoSession
  };
}
