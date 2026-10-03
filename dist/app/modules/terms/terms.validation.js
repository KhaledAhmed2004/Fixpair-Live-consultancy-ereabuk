"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TermsValidation = void 0;
const zod_1 = require("zod");
const createTermsZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string({
            required_error: 'Title is required',
        }),
        content: zod_1.z.string({
            required_error: 'Content is required',
        }),
    }),
});
const updateTermsZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string().optional(),
        content: zod_1.z.string().optional(),
    }),
});
exports.TermsValidation = {
    createTermsZodSchema,
    updateTermsZodSchema,
};
