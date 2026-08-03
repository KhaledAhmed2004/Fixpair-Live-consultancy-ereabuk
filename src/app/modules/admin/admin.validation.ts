import { z } from 'zod';

const monthsQueryZodSchema = z.object({
  query: z.object({
    months: z.enum(['6', '12']).optional().default('12'),
  }),
});

const topConsultantsQueryZodSchema = z.object({
  query: z.object({
    limit: z
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

const recentActivitiesQueryZodSchema = z.object({
  query: z.object({
    limit: z
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

const recentConsultationsQueryZodSchema = z.object({
  query: z.object({
    limit: z
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

export const AdminValidation = {
  monthsQueryZodSchema,
  topConsultantsQueryZodSchema,
  recentActivitiesQueryZodSchema,
  recentConsultationsQueryZodSchema,
};
