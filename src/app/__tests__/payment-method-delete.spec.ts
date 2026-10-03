import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentController } from '../modules/payment/payment.controller';
import { StripeService } from '../modules/payment/stripe.service';
import { User } from '../modules/user/user.model';
import { Consultation } from '../modules/consultation/consultation.model';
import ApiError from '../../errors/ApiError';
import { StatusCodes } from 'http-status-codes';

vi.mock('../modules/payment/stripe.service', () => ({
  StripeService: {
    detachPaymentMethod: vi.fn(),
    stripe: {
      customers: {
        update: vi.fn(),
      },
    },
  },
}));

vi.mock('../modules/user/user.model', () => ({
  User: {
    findById: vi.fn(),
  },
}));

vi.mock('../modules/consultation/consultation.model', () => ({
  Consultation: {
    findOne: vi.fn(),
  },
}));

describe('PaymentController.deletePaymentMethod', () => {
  let mockReq: any;
  let mockRes: any;
  let mockUser: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockUser = {
      _id: 'user_123',
      id: 'user_123',
      stripeCustomerId: 'cus_123',
      paymentMethods: [
        {
          provider: 'stripe',
          methodId: 'pm_card_default',
          last4: '4242',
          brand: 'visa',
          isDefault: true,
        },
        {
          provider: 'stripe',
          methodId: 'pm_card_secondary',
          last4: '5555',
          brand: 'mastercard',
          isDefault: false,
        },
      ],
      save: vi.fn().mockResolvedValue(true),
    };

    mockReq = {
      user: { id: 'user_123' },
      params: { paymentMethodId: 'pm_card_secondary' },
      body: {},
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    (User.findById as any).mockResolvedValue(mockUser);
    (Consultation.findOne as any).mockResolvedValue(null);
    (StripeService.detachPaymentMethod as any).mockResolvedValue({ id: 'pm_card_secondary' });
    (StripeService.stripe.customers.update as any).mockResolvedValue({});
  });

  it('should successfully delete a non-default payment method', async () => {
    mockReq.params.paymentMethodId = 'pm_card_secondary';

    await PaymentController.deletePaymentMethod(mockReq, mockRes, () => {});

    expect(StripeService.detachPaymentMethod).toHaveBeenCalledWith('pm_card_secondary');
    expect(mockUser.paymentMethods.length).toBe(1);
    expect(mockUser.paymentMethods[0].methodId).toBe('pm_card_default');
    expect(mockUser.paymentMethods[0].isDefault).toBe(true);
    expect(mockUser.save).toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.OK);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'Payment method removed successfully',
      }),
    );
  });

  it('should promote the next remaining payment method to default when default is deleted', async () => {
    mockReq.params.paymentMethodId = 'pm_card_default';

    await PaymentController.deletePaymentMethod(mockReq, mockRes, () => {});

    expect(StripeService.detachPaymentMethod).toHaveBeenCalledWith('pm_card_default');
    expect(mockUser.paymentMethods.length).toBe(1);
    expect(mockUser.paymentMethods[0].methodId).toBe('pm_card_secondary');
    expect(mockUser.paymentMethods[0].isDefault).toBe(true);
    expect(StripeService.stripe.customers.update).toHaveBeenCalledWith('cus_123', {
      invoice_settings: {
        default_payment_method: 'pm_card_secondary',
      },
    });
    expect(mockUser.save).toHaveBeenCalled();
  });

  it('should work with paymentMethodId provided in request body (fallback)', async () => {
    mockReq.params = {};
    mockReq.body = { paymentMethodId: 'pm_card_secondary' };

    await PaymentController.deletePaymentMethod(mockReq, mockRes, () => {});

    expect(StripeService.detachPaymentMethod).toHaveBeenCalledWith('pm_card_secondary');
    expect(mockUser.paymentMethods.length).toBe(1);
  });

  it('should pass NOT_FOUND error to next if payment method is not associated with the user', async () => {
    mockReq.params.paymentMethodId = 'pm_non_existent';
    const next = vi.fn();

    await PaymentController.deletePaymentMethod(mockReq, mockRes, next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(StatusCodes.NOT_FOUND);
    expect(error.message).toBe('Payment method not found');
  });

  it('should pass BAD_REQUEST error to next if a consultation is actively in progress', async () => {
    (Consultation.findOne as any).mockResolvedValue({
      _id: 'consultation_123',
      billingStatus: 'active',
      status: 'in-progress',
    });

    mockReq.params.paymentMethodId = 'pm_card_secondary';
    const next = vi.fn();

    await PaymentController.deletePaymentMethod(mockReq, mockRes, next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
    expect(error.message).toBe('Cannot remove payment method while a consultation is actively in progress');

    expect(StripeService.detachPaymentMethod).not.toHaveBeenCalled();
    expect(mockUser.save).not.toHaveBeenCalled();
  });

  it('should still remove from database even if Stripe detach throws an error', async () => {
    (StripeService.detachPaymentMethod as any).mockRejectedValue(
      new Error('No such payment_method: pm_card_secondary'),
    );

    mockReq.params.paymentMethodId = 'pm_card_secondary';

    await PaymentController.deletePaymentMethod(mockReq, mockRes, () => {});

    expect(mockUser.paymentMethods.length).toBe(1);
    expect(mockUser.save).toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.OK);
  });
});
