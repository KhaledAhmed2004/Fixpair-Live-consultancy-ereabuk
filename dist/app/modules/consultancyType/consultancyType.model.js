"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsultancyType = void 0;
const mongoose_1 = require("mongoose");
const consultancyTypeSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active',
    },
}, {
    timestamps: true,
});
exports.ConsultancyType = (0, mongoose_1.model)('ConsultancyType', consultancyTypeSchema);
