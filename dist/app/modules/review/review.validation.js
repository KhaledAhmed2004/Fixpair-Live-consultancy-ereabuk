"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewValidation = void 0;
const zod_1 = require("zod");
const createReviewZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        consultationId: zod_1.z.string({
            required_error: 'Consultation ID is required',
        }),
        rating: zod_1.z.number({
            required_error: 'Rating is required',
        }).min(1).max(5),
        comment: zod_1.z.string({
            required_error: 'Comment is required',
        }),
    }),
});
const updateReviewZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        rating: zod_1.z.number().min(1).max(5).optional(),
        comment: zod_1.z.string().optional(),
    }),
});
exports.ReviewValidation = {
    createReviewZodSchema,
    updateReviewZodSchema,
};
