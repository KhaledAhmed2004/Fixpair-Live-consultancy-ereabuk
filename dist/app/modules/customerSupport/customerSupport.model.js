"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerSupport = void 0;
const mongoose_1 = require("mongoose");
const customerSupportSchema = new mongoose_1.Schema({
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
    },
    phoneNumber: {
        type: String,
        trim: true,
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
    },
});
exports.CustomerSupport = (0, mongoose_1.model)('CustomerSupport', customerSupportSchema);
