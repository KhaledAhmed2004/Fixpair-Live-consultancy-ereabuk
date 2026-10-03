"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsultancyTypeValidation = void 0;
const zod_1 = require("zod");
const createConsultancyTypeZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string({ required_error: 'Name is required' }),
        status: zod_1.z.enum(['active', 'inactive']).optional(),
    }),
});
const updateConsultancyTypeZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().optional(),
        status: zod_1.z.enum(['active', 'inactive']).optional(),
    }),
});
exports.ConsultancyTypeValidation = {
    createConsultancyTypeZodSchema,
    updateConsultancyTypeZodSchema,
};
