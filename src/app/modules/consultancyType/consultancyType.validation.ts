import { z } from 'zod';

const createConsultancyTypeZodSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Name is required' }),
    status: z.enum(['active', 'inactive']).optional(),
  }),
});

const updateConsultancyTypeZodSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    status: z.enum(['active', 'inactive']).optional(),
  }),
});

export const ConsultancyTypeValidation = {
  createConsultancyTypeZodSchema,
  updateConsultancyTypeZodSchema,
};
