"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsultationValidation = void 0;
const zod_1 = require("zod");
const slotSchema = zod_1.z.object({
    date: zod_1.z.string({ required_error: 'Date is required' }),
    startTime: zod_1.z.string({ required_error: 'Start time is required' }),
    endTime: zod_1.z.string({ required_error: 'End time is required' }),
});
const setUnavailabilityZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        slots: zod_1.z.array(slotSchema),
    }),
});
const createBookingZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        consultantId: zod_1.z.string({ required_error: 'Consultant ID is required' }),
        bookingType: zod_1.z.enum(['scheduled', 'instant', 'callback'], {
            required_error: 'Booking type is required',
        }),
        date: zod_1.z.string().optional(),
        startTime: zod_1.z.string().optional(),
        endTime: zod_1.z.string().optional(),
        preferredWindow: zod_1.z.enum(['asap', 'today', 'tomorrow']).optional(),
        notes: zod_1.z.string().optional(),
    }),
});
const updateBookingStatusZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        status: zod_1.z.enum([
            'pending',
            'ongoing',
            'accepted',
            'rejected',
            'confirmed',
            'completed',
            'cancelled',
            'expired',
        ]),
        date: zod_1.z.string().optional(),
        startTime: zod_1.z.string().optional(),
        endTime: zod_1.z.string().optional(),
    }),
});
const getAvailableSlotsZodSchema = zod_1.z.object({
    query: zod_1.z.object({
        date: zod_1.z.string().optional(),
    }),
});
const rescheduleBookingZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        date: zod_1.z.string({ required_error: 'Date is required' }),
        startTime: zod_1.z.string({ required_error: 'Start time is required' }),
        endTime: zod_1.z.string({ required_error: 'End time is required' }),
    }),
});
const cancelBookingZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        cancelReason: zod_1.z.string().optional(),
    }),
});
const getMyAppointmentsZodSchema = zod_1.z.object({
    query: zod_1.z
        .object({
        bookingType: zod_1.z.string().optional(),
        status: zod_1.z.string().optional(),
        tab: zod_1.z.enum(['upcoming', 'requests', 'history', 'all']).optional(),
        page: zod_1.z.string().optional(),
        limit: zod_1.z.string().optional(),
        sort: zod_1.z.string().optional(),
        searchTerm: zod_1.z.string().optional(),
    })
        .optional(),
});
exports.ConsultationValidation = {
    setUnavailabilityZodSchema,
    getAvailableSlotsZodSchema,
    createBookingZodSchema,
    updateBookingStatusZodSchema,
    rescheduleBookingZodSchema,
    cancelBookingZodSchema,
    getMyAppointmentsZodSchema,
};
