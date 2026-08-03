import { z } from 'zod';

const slotSchema = z.object({
  date: z.string({ required_error: 'Date is required' }),
  startTime: z.string({ required_error: 'Start time is required' }),
  endTime: z.string({ required_error: 'End time is required' }),
});

const setUnavailabilityZodSchema = z.object({
  body: z.object({
    slots: z.array(slotSchema),
  }),
});

const createBookingZodSchema = z.object({
  body: z.object({
    consultantId: z.string({ required_error: 'Consultant ID is required' }),
    bookingType: z.enum(['scheduled', 'instant', 'callback'], {
      required_error: 'Booking type is required',
    }),
    date: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    preferredWindow: z.enum(['asap', 'today', 'tomorrow']).optional(),
    notes: z.string().optional(),
  }),
});

const updateBookingStatusZodSchema = z.object({
  body: z.object({
    status: z.enum([
      'pending',
      'ongoing',
      'accepted',
      'rejected',
      'confirmed',
      'completed',
      'cancelled',
      'expired',
    ]),
    date: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
  }),
});

const getAvailableSlotsZodSchema = z.object({
  query: z.object({
    date: z.string().optional(),
  }),
});

const rescheduleBookingZodSchema = z.object({
  body: z.object({
    date: z.string({ required_error: 'Date is required' }),
    startTime: z.string({ required_error: 'Start time is required' }),
    endTime: z.string({ required_error: 'End time is required' }),
  }),
});

const cancelBookingZodSchema = z.object({
  body: z.object({
    cancelReason: z.string().optional(),
  }),
});

export const ConsultationValidation = {
  setUnavailabilityZodSchema,
  getAvailableSlotsZodSchema,
  createBookingZodSchema,
  updateBookingStatusZodSchema,
  rescheduleBookingZodSchema,
  cancelBookingZodSchema,
};
