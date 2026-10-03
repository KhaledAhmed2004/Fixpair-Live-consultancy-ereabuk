import { z } from 'zod';

const getInvoiceZodSchema = z.object({
  params: z.object({
    consultationId: z.string({
      required_error: 'Consultation ID is required',
    }),
  }),
});

const deletePaymentMethodZodSchema = z.object({
  params: z.object({
    paymentMethodId: z.string({
      required_error: 'Payment Method ID is required',
    }),
  }),
});

const detachPaymentMethodZodSchema = z.object({
  body: z.object({
    paymentMethodId: z.string({
      required_error: 'Payment Method ID is required',
    }),
  }),
});

export const PaymentValidation = {
  getInvoiceZodSchema,
  deletePaymentMethodZodSchema,
  detachPaymentMethodZodSchema,
};
