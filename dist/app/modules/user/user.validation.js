"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserValidation = void 0;
const zod_1 = require("zod");
const user_1 = require("../../../enums/user");
const createUserZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string({ required_error: 'Name is required' }),
        email: zod_1.z.string({ required_error: 'Email is required' }),
        password: zod_1.z.string({ required_error: 'Password is required' }),
        role: zod_1.z.nativeEnum(user_1.USER_ROLES).optional(),
        consultancyType: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid consultancy type ID' }).optional(),
        experience: zod_1.z.string().optional(),
        languages: zod_1.z.array(zod_1.z.string()).optional(),
        expertise: zod_1.z.array(zod_1.z.string()).optional(),
        bio: zod_1.z.string().max(500).optional(),
        perMinuteRate: zod_1.z.number().nonnegative().optional(),
        activeStatus: zod_1.z.boolean().optional(),
        profile: zod_1.z.string().optional(),
    }),
}).superRefine((data, ctx) => {
    if (data.body.role === user_1.USER_ROLES.CONSULTANT) {
        if (!data.body.consultancyType) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'Consultancy Type is required for consultants',
                path: ['body', 'consultancyType'],
            });
        }
        if (data.body.perMinuteRate === undefined || data.body.perMinuteRate === null) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'Per Minute Rate is required for consultants',
                path: ['body', 'perMinuteRate'],
            });
        }
    }
});
const updateUserZodSchema = zod_1.z.object({
    name: zod_1.z.string().optional(),
    email: zod_1.z.string().optional(),
    password: zod_1.z.string().optional(),
    image: zod_1.z.string().optional(),
    consultancyType: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid consultancy type ID' }).optional(),
    experience: zod_1.z.string().optional(),
    languages: zod_1.z.array(zod_1.z.string()).optional(),
    expertise: zod_1.z.array(zod_1.z.string()).optional(),
    bio: zod_1.z.string().max(500).optional(),
    perMinuteRate: zod_1.z.number().nonnegative().optional(),
    activeStatus: zod_1.z.boolean().optional(),
});
const deviceTokenZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        deviceToken: zod_1.z.string({ required_error: 'Device token is required' }),
        deviceType: zod_1.z.enum(['android', 'ios', 'web'], {
            required_error: 'Device type is required',
        }),
        action: zod_1.z.enum(['add', 'remove']).default('add'),
    }),
});
exports.UserValidation = {
    createUserZodSchema,
    updateUserZodSchema,
    deviceTokenZodSchema,
};
