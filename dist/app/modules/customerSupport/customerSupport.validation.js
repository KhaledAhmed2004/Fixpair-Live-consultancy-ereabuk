"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerSupportValidation = void 0;
const zod_1 = require("zod");
const createOrUpdateCustomerSupportZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z
            .string({
            required_error: 'Email is required',
        })
            .email({
            message: 'Invalid email address',
        }),
        phoneNumber: zod_1.z.string().optional(),
    }),
});
exports.CustomerSupportValidation = {
    createOrUpdateCustomerSupportZodSchema,
};
