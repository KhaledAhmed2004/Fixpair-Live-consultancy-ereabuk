"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Review = void 0;
const mongoose_1 = require("mongoose");
const reviewSchema = new mongoose_1.Schema({
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
    consultation: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Consultation',
        required: true,
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
    },
    comment: {
        type: String,
        required: true,
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
    },
});
// Indexes for optimized queries
reviewSchema.index({ consultant: 1, createdAt: -1 });
reviewSchema.index({ consultant: 1, status: 1, createdAt: -1 });
reviewSchema.index({ status: 1, createdAt: -1 });
reviewSchema.index({ consultation: 1 }, { unique: true });
reviewSchema.index({ createdAt: -1 });
exports.Review = (0, mongoose_1.model)('Review', reviewSchema);
