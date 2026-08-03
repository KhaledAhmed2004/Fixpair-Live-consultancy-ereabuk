import { z } from 'zod';

const recentLimitQueryZodSchema = z.object({
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

const daysQueryZodSchema = z.object({
  query: z.object({
    days: z.enum(['7', '30']).optional().default('30'),
  }),
});

export const ConsultantOverviewValidation = {
  recentLimitQueryZodSchema,
  daysQueryZodSchema,
};
