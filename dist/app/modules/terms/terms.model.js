"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Terms = void 0;
const mongoose_1 = require("mongoose");
const termsSchema = new mongoose_1.Schema({
    title: {
        type: String,
        required: true,
    },
    content: {
        type: String,
        required: true,
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
    },
});
exports.Terms = (0, mongoose_1.model)('Terms', termsSchema);
