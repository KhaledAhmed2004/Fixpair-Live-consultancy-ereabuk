"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminValidation = void 0;
const zod_1 = require("zod");
const monthsQueryZodSchema = zod_1.z.object({
    query: zod_1.z.object({
        months: zod_1.z.enum(['6', '12']).optional().default('12'),
    }),
});
const topConsultantsQueryZodSchema = zod_1.z.object({
    query: zod_1.z.object({
        limit: zod_1.z
            .string()
            .regex(/^\d+$/, 'limit must be a positive integer')
            .optional()
            .default('5')
            .refine(val => {
            const n = Number(val);
            return n >= 1 && n <= 20;
        }, { message: 'limit must be between 1 and 20' }),
    }),
});
const recentActivitiesQueryZodSchema = zod_1.z.object({
    query: zod_1.z.object({
        limit: zod_1.z
            .string()
            .regex(/^\d+$/, 'limit must be a positive integer')
            .optional()
            .default('10')
            .refine(val => {
            const n = Number(val);
            return n >= 1 && n <= 50;
        }, { message: 'limit must be between 1 and 50' }),
    }),
});
const recentConsultationsQueryZodSchema = zod_1.z.object({
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
exports.AdminValidation = {
    monthsQueryZodSchema,
    topConsultantsQueryZodSchema,
    recentActivitiesQueryZodSchema,
    recentConsultationsQueryZodSchema,
};
