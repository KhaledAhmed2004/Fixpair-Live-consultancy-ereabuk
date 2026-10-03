"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrivacyValidation = void 0;
const zod_1 = require("zod");
const createPrivacyZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string({
            required_error: 'Title is required',
        }),
        content: zod_1.z.string({
            required_error: 'Content is required',
        }),
    }),
});
const updatePrivacyZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string().optional(),
        content: zod_1.z.string().optional(),
    }),
});
exports.PrivacyValidation = {
    createPrivacyZodSchema,
    updatePrivacyZodSchema,
};
