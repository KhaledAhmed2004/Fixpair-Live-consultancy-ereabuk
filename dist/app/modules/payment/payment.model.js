"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingTransaction = exports.Invoice = exports.Transaction = void 0;
const mongoose_1 = require("mongoose");
const transactionSchema = new mongoose_1.Schema({
    consultation: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Consultation',
        required: true,
    },
    user: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    consultant: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, enum: ['stripe', 'paypal'], required: true },
    transactionId: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'usd' },
    status: {
        type: String,
        enum: [
            'pending',
            'authorized',
            'captured',
            'failed',
            'refunded',
            'voided',
        ],
        default: 'pending',
    },
    type: {
        type: String,
        enum: ['authorization', 'capture', 'charge'],
        required: true,
    },
    retryCount: { type: Number, default: 0 },
    metadata: { type: mongoose_1.Schema.Types.Mixed },
}, { timestamps: true });
transactionSchema.index({ consultation: 1 });
transactionSchema.index({ transactionId: 1 }, { unique: true });
exports.Transaction = (0, mongoose_1.model)('Transaction', transactionSchema);
const invoiceSchema = new mongoose_1.Schema({
    session: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Consultation',
        required: true,
    },
    user: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    consultant: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    invoiceNumber: { type: String, required: true },
    duration: { type: Number, required: true },
    perMinuteRate: { type: Number, required: true },
    platformFee: { type: Number, required: true },
    subtotal: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    paymentMethod: { type: String, required: true },
    status: {
        type: String,
        enum: ['paid', 'unpaid', 'failed'],
        default: 'unpaid',
    },
    pdfUrl: { type: String },
}, { timestamps: true });
invoiceSchema.index({ session: 1 });
invoiceSchema.index({ user: 1 });
invoiceSchema.index({ invoiceNumber: 1 }, { unique: true });
exports.Invoice = (0, mongoose_1.model)('Invoice', invoiceSchema);
const billingTransactionSchema = new mongoose_1.Schema({
    consultationId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Consultation',
        required: true,
    },
    billingMinute: {
        type: Number,
        required: true,
    },
    type: {
        type: String,
        enum: ['preauth', 'charge', 'adjustment', 'refund'],
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'succeeded', 'failed', 'unknown'],
        default: 'pending',
    },
    stripePaymentIntentId: {
        type: String,
    },
    idempotencyKey: {
        type: String,
        required: true,
    },
    processingStartedAt: {
        type: Date,
    },
}, { timestamps: true });
// P0 Requirement: Unique compound index to prevent duplicate charges
billingTransactionSchema.index({ consultationId: 1, billingMinute: 1, type: 1 }, { unique: true });
exports.BillingTransaction = (0, mongoose_1.model)('BillingTransaction', billingTransactionSchema);
