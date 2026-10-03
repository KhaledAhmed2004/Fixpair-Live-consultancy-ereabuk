"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoSession = void 0;
const mongoose_1 = require("mongoose");
const videoSessionSchema = new mongoose_1.Schema({
    consultation: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Consultation',
        required: true,
    },
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
    channelName: {
        type: String,
        required: true,
    },
    token: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'ongoing', 'ended'],
        default: 'pending',
    },
    startedAt: {
        type: Date,
    },
    endedAt: {
        type: Date,
    },
    duration: {
        type: Number,
    },
    sttTaskId: {
        type: String,
    },
    transcriptionStatus: {
        type: String,
        enum: ['pending', 'starting', 'active', 'failed', 'stopping', 'stopped'],
        default: 'pending',
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
    },
});
// Indexes
videoSessionSchema.index({ consultation: 1 }, { unique: true });
videoSessionSchema.index({ user: 1 });
videoSessionSchema.index({ consultant: 1 });
videoSessionSchema.index({ channelName: 1 }, { unique: true });
exports.VideoSession = (0, mongoose_1.model)('VideoSession', videoSessionSchema);
