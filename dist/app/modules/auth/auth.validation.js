"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthValidation = void 0;
const zod_1 = require("zod");
const createVerifyEmailZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string({ required_error: 'Email is required' }),
        oneTimeCode: zod_1.z.number({ required_error: 'One time code is required' }),
    }),
});
const createLoginZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string({ required_error: 'Email is required' }),
        password: zod_1.z.string({ required_error: 'Password is required' }),
        rememberMe: zod_1.z.boolean().optional(),
    }),
});
const createForgetPasswordZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string({ required_error: 'Email is required' }),
    }),
});
const createResetPasswordZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        newPassword: zod_1.z.string({ required_error: 'Password is required' }),
        confirmPassword: zod_1.z.string({
            required_error: 'Confirm Password is required',
        }),
    }),
});
const createChangePasswordZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        currentPassword: zod_1.z.string({
            required_error: 'Current Password is required',
        }),
        newPassword: zod_1.z.string({ required_error: 'New Password is required' }),
        confirmPassword: zod_1.z.string({
            required_error: 'Confirm Password is required',
        }),
    }),
});
const resendOtpZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string({ required_error: 'Email is required' }),
    }),
});
const createRefreshTokenZodSchema = zod_1.z.object({
    cookies: zod_1.z.object({
        refreshToken: zod_1.z.string({ required_error: 'Refresh token is required' }),
    }),
});
const socialLoginZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        idToken: zod_1.z.string({ required_error: 'ID Token is required' }),
        provider: zod_1.z.enum(['google', 'apple'], {
            required_error: 'Provider is required',
        }),
        rememberMe: zod_1.z.boolean().optional(),
    }),
});
exports.AuthValidation = {
    createVerifyEmailZodSchema,
    createForgetPasswordZodSchema,
    createLoginZodSchema,
    createResetPasswordZodSchema,
    createChangePasswordZodSchema,
    resendOtpZodSchema,
    createRefreshTokenZodSchema,
    socialLoginZodSchema,
};
