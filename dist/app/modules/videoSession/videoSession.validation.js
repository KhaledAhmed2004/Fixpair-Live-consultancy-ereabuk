"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoSessionValidation = void 0;
const zod_1 = require("zod");
const createSessionZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        consultationId: zod_1.z.string({
            required_error: 'Consultation ID is required',
        }),
    }),
});
const joinSessionZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        sessionId: zod_1.z.string({
            required_error: 'Session ID is required',
        }),
    }),
});
const endSessionZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        sessionId: zod_1.z.string({
            required_error: 'Session ID is required',
        }),
    }),
});
const callActionZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        sessionId: zod_1.z.string({
            required_error: 'Session ID is required',
        }),
        action: zod_1.z.enum(['REJECT', 'CANCEL', 'END'], {
            required_error: 'Action is required (REJECT, CANCEL, or END)',
        }),
    }),
});
exports.VideoSessionValidation = {
    createSessionZodSchema,
    joinSessionZodSchema,
    endSessionZodSchema,
    callActionZodSchema,
};
