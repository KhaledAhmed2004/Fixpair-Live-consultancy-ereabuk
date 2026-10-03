"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportValidation = void 0;
const zod_1 = require("zod");
const createReportZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        consultationId: zod_1.z.string({
            required_error: 'Consultation ID is required',
        }),
        summary: zod_1.z.string().optional(),
        keyPoints: zod_1.z.array(zod_1.z.string()).optional(),
        stepsTaken: zod_1.z.array(zod_1.z.string()).optional(),
        recommendedProducts: zod_1.z
            .array(zod_1.z.object({
            name: zod_1.z.string({ required_error: 'Product name is required' }),
            price: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional(),
            buyLink: zod_1.z.string().optional(),
        }))
            .optional(),
        conversation: zod_1.z.string().optional(),
        notes: zod_1.z.string().optional(),
        links: zod_1.z.array(zod_1.z.string()).optional(),
        images: zod_1.z.array(zod_1.z.string()).optional(),
    }),
});
const updateReportZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        summary: zod_1.z.string().optional(),
        keyPoints: zod_1.z.array(zod_1.z.string()).optional(),
        stepsTaken: zod_1.z.array(zod_1.z.string()).optional(),
        recommendedProducts: zod_1.z
            .array(zod_1.z.object({
            name: zod_1.z.string({ required_error: 'Product name is required' }),
            price: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional(),
            buyLink: zod_1.z.string().optional(),
        }))
            .optional(),
        conversation: zod_1.z.string().optional(),
        notes: zod_1.z.string().optional(),
        links: zod_1.z.array(zod_1.z.string()).optional(),
        images: zod_1.z.array(zod_1.z.string()).optional(),
    }),
});
exports.ReportValidation = {
    createReportZodSchema,
    updateReportZodSchema,
};
