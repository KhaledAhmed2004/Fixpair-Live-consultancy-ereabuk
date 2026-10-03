"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Consultation = exports.Availability = void 0;
const mongoose_1 = require("mongoose");
// Availability Schema (Consultant's UNAVAILABLE time slots)
const availabilitySchema = new mongoose_1.Schema({
    consultant: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    slots: [
        {
            date: { type: Date, required: true },
            startTime: { type: String, required: true },
            endTime: { type: String, required: true },
        },
    ],
}, { timestamps: true });
availabilitySchema.index({ consultant: 1 }, { unique: true });
availabilitySchema.index({ 'slots.date': 1 });
exports.Availability = (0, mongoose_1.model)('Availability', availabilitySchema);
// Consultation/Booking Schema
const consultationSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    consultant: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    bookingType: {
        type: String,
        enum: ['scheduled', 'instant', 'callback'],
        required: true,
    },
    date: {
        type: Date,
        required: false,
    },
    startTime: {
        type: String,
        required: false,
    },
    endTime: {
        type: String,
        required: false,
    },
    preferredWindow: {
        type: String,
        enum: ['asap', 'today', 'tomorrow'],
        required: false,
    },
    notes: {
        type: String,
        default: null,
    },
    perMinuteRate: {
        type: Number,
        required: true,
    },
    platformFee: {
        type: Number,
        default: 5,
    },
    finalSettledAmount: {
        type: Number,
        default: 0,
    },
    preAuthIntentId: {
        type: String,
        default: null,
    },
    authorizedAmount: {
        type: Number,
        default: 0,
    },
    consumedAmount: {
        type: Number,
        default: 0,
    },
    remainingMinutes: {
        type: Number,
        default: 0,
    },
    billingStatus: {
        type: String,
        enum: ['pending', 'authorized', 'active', 'failed', 'completed'],
        default: 'pending',
    },
    terminationReason: {
        type: String,
        enum: ['manual', 'insufficient_funds', 'force_terminated'],
        default: null,
    },
    status: {
        type: String,
        enum: [
            'pending',
            'ongoing',
            'accepted',
            'rejected',
            'confirmed',
            'completed',
            'cancelled',
            'expired',
        ],
        default: 'pending',
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'authorized', 'paid', 'failed'],
        default: 'pending',
    },
    remindersSent: {
        twentyFourHour: { type: Boolean, default: false },
        oneHour: { type: Boolean, default: false },
    },
    cancelledAt: {
        type: Date,
        default: null,
    },
    cancelReason: {
        type: String,
        default: null,
    },
    cancelledBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    aiSummary: {
        overview: { type: String, default: null },
        keyPoints: [{ type: String }],
        actionItems: [{ type: String }],
        recommendations: [{ type: String }],
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});
consultationSchema.virtual('report', {
    ref: 'Report',
    localField: '_id',
    foreignField: 'consultation',
    justOne: true,
});
consultationSchema.index({ consultant: 1, date: 1, startTime: 1, endTime: 1 });
consultationSchema.index({ user: 1, status: 1 });
consultationSchema.index({ status: 1, bookingType: 1 });
consultationSchema.index({ status: 1 }, { partialFilterExpression: { status: 'pending' } });
exports.Consultation = (0, mongoose_1.model)('Consultation', consultationSchema);
