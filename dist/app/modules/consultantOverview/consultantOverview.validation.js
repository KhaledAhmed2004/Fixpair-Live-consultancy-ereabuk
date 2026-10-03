"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsultantOverviewValidation = void 0;
const zod_1 = require("zod");
const recentLimitQueryZodSchema = zod_1.z.object({
    query: zod_1.z.object({
        limit: zod_1.z
            .string()
            .regex(/^\d+$/, 'limit must be a positive integer')
            .optional()
            .default('5')
            .refine(val => {
            const n = Number(val);
            return n >= 1 && n <= 50;
        }, { message: 'limit must be between 1 and 50' }),
    }),
});
const daysQueryZodSchema = zod_1.z.object({
    query: zod_1.z.object({
        days: zod_1.z.enum(['7', '30']).optional().default('30'),
    }),
});
exports.ConsultantOverviewValidation = {
    recentLimitQueryZodSchema,
    daysQueryZodSchema,
};
