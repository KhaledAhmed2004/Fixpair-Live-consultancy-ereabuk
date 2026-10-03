"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentValidation = void 0;
const zod_1 = require("zod");
const getInvoiceZodSchema = zod_1.z.object({
    params: zod_1.z.object({
        consultationId: zod_1.z.string({
            required_error: 'Consultation ID is required',
        }),
    }),
});
const deletePaymentMethodZodSchema = zod_1.z.object({
    params: zod_1.z.object({
        paymentMethodId: zod_1.z.string({
            required_error: 'Payment Method ID is required',
        }),
    }),
});
const detachPaymentMethodZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        paymentMethodId: zod_1.z.string({
            required_error: 'Payment Method ID is required',
        }),
    }),
});
exports.PaymentValidation = {
    getInvoiceZodSchema,
    deletePaymentMethodZodSchema,
    detachPaymentMethodZodSchema,
};
