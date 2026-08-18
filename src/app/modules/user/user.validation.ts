import { z } from 'zod';
import { USER_ROLES } from '../../../enums/user';

const createUserZodSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Name is required' }),
    email: z.string({ required_error: 'Email is required' }),
    password: z.string({ required_error: 'Password is required' }),
    role: z.nativeEnum(USER_ROLES).optional(),
    consultancyType: z.string().regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid consultancy type ID' }).optional(),
    experience: z.string().optional(),
    languages: z.array(z.string()).optional(),
    expertise: z.array(z.string()).optional(),
    bio: z.string().max(500).optional(),
    perMinuteRate: z.number().nonnegative().optional(),
    activeStatus: z.boolean().optional(),
    profile: z.string().optional(),
  }),
}).superRefine((data, ctx) => {
  if (data.body.role === USER_ROLES.CONSULTANT) {
    if (!data.body.consultancyType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Consultancy Type is required for consultants',
        path: ['body', 'consultancyType'],
      });
    }
    if (data.body.perMinuteRate === undefined || data.body.perMinuteRate === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Per Minute Rate is required for consultants',
        path: ['body', 'perMinuteRate'],
      });
    }
  }
});

const updateUserZodSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  password: z.string().optional(),
  image: z.string().optional(),
  consultancyType: z.string().regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid consultancy type ID' }).optional(),
  experience: z.string().optional(),
  languages: z.array(z.string()).optional(),
  expertise: z.array(z.string()).optional(),
  bio: z.string().max(500).optional(),
  perMinuteRate: z.number().nonnegative().optional(),
  activeStatus: z.boolean().optional(),
});

const deviceTokenZodSchema = z.object({
  body: z.object({
    deviceToken: z.string({ required_error: 'Device token is required' }),
    deviceType: z.enum(['android', 'ios'], {
      required_error: 'Device type is required',
    }),
    action: z.enum(['add', 'remove']).default('add'),
  }),
});

export const UserValidation = {
  createUserZodSchema,
  updateUserZodSchema,
  deviceTokenZodSchema,
};
