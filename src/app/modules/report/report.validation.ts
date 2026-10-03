import { z } from 'zod';

const createReportZodSchema = z.object({
  body: z.object({
    consultationId: z.string({
      required_error: 'Consultation ID is required',
    }),
    summary: z.string().optional(),
    keyPoints: z.array(z.string()).optional(),
    stepsTaken: z.array(z.string()).optional(),
    recommendedProducts: z
      .array(
        z.object({
          name: z.string({ required_error: 'Product name is required' }),
          price: z.union([z.string(), z.number()]).optional(),
          buyLink: z.string().optional(),
        }),
      )
      .optional(),
    conversation: z.string().optional(),
    notes: z.string().optional(),
    links: z.array(z.string()).optional(),
    images: z.array(z.string()).optional(),
  }),
});

const updateReportZodSchema = z.object({
  body: z.object({
    summary: z.string().optional(),
    keyPoints: z.array(z.string()).optional(),
    stepsTaken: z.array(z.string()).optional(),
    recommendedProducts: z
      .array(
        z.object({
          name: z.string({ required_error: 'Product name is required' }),
          price: z.union([z.string(), z.number()]).optional(),
          buyLink: z.string().optional(),
        }),
      )
      .optional(),
    conversation: z.string().optional(),
    notes: z.string().optional(),
    links: z.array(z.string()).optional(),
    images: z.array(z.string()).optional(),
  }),
});

export const ReportValidation = {
  createReportZodSchema,
  updateReportZodSchema,
};
