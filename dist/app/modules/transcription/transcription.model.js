"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Transcript = void 0;
const mongoose_1 = require("mongoose");
const transcriptSchema = new mongoose_1.Schema({
    consultation: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Consultation',
        required: true,
    },
    channelName: {
        type: String,
        required: true,
    },
    speakerUid: {
        type: Number,
        required: true,
    },
    speakerRole: {
        type: String,
        enum: ['user', 'consultant'],
        required: true,
    },
    text: {
        type: String,
        required: true,
    },
    language: {
        type: String,
        default: 'en',
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
    isFinal: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
});
exports.Transcript = (0, mongoose_1.model)('Transcript', transcriptSchema);
