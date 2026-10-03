"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-explicit-any */
const bcrypt_1 = __importDefault(require("bcrypt"));
const http_status_codes_1 = require("http-status-codes");
const mongoose_1 = require("mongoose");
const config_1 = __importDefault(require("../../../config"));
const user_1 = require("../../../enums/user");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const userSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: Object.values(user_1.USER_ROLES),
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
    },
    password: {
        type: String,
        select: 0,
        minlength: 8,
        default: null,
    },
    image: {
        type: String,
        default: 'https://i.ibb.co/z5YHLV9/profile.png',
    },
    status: {
        type: String,
        enum: ['active', 'delete'],
        default: 'active',
    },
    verified: {
        type: Boolean,
        default: false,
    },
    firebaseUid: {
        type: String,
        unique: true,
        sparse: true,
    },
    consultancyType: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'ConsultancyType',
        default: null,
    },
    experience: {
        type: String,
        default: null,
    },
    languages: {
        type: [String],
        default: [],
    },
    expertise: {
        type: [String],
        default: [],
    },
    bio: {
        type: String,
        default: null,
        maxlength: 500,
    },
    perMinuteRate: {
        type: Number,
        default: 0,
    },
    activeStatus: {
        type: Boolean,
        default: true,
    },
    stripeCustomerId: {
        type: String,
        default: null,
    },
    paypalPayerId: {
        type: String,
        default: null,
    },
    paymentMethods: [
        {
            provider: { type: String, enum: ['stripe', 'paypal'] },
            methodId: { type: String },
            last4: { type: String },
            brand: { type: String },
            isDefault: { type: Boolean, default: false },
        },
    ],
    authentication: {
        isResetPassword: {
            type: Boolean,
            default: false,
        },
        oneTimeCode: {
            type: Number,
            default: null,
        },
        expireAt: {
            type: Date,
            default: null,
        },
        otpRequestCount: {
            type: Number,
            default: 0,
        },
        lastOtpRequestTime: {
            type: Date,
            default: null,
        },
    },
    fcmTokens: {
        type: [String],
        default: [],
    },
    deviceType: {
        type: String,
        enum: ['android', 'ios', 'web'],
    },
    averageRating: {
        type: Number,
        default: 0,
    },
    totalReviews: {
        type: Number,
        default: 0,
    },
    totalConsultations: {
        type: Number,
        default: 0,
    },
}, {
    timestamps: true,
    toJSON: {
        transform(doc, ret) {
            delete ret.authentication;
            delete ret.password;
            delete ret.paymentMethods;
            return ret;
        },
    },
    toObject: {
        transform(doc, ret) {
            delete ret.authentication;
            delete ret.password;
            delete ret.paymentMethods;
            return ret;
        },
    },
});
//exist user check
userSchema.statics.isExistUserById = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield exports.User.findById(id);
    return isExist;
});
userSchema.statics.isExistUserByEmail = (email) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield exports.User.findOne({ email });
    return isExist;
});
//is match password
userSchema.statics.isMatchPassword = (password, hashPassword) => __awaiter(void 0, void 0, void 0, function* () {
    return yield bcrypt_1.default.compare(password, hashPassword);
});
//check user
userSchema.pre('save', function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        // Only check for existing email if it's a new user
        if (this.isNew) {
            const isExist = yield exports.User.findOne({ email: this.email });
            if (isExist) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Email already exist!');
            }
        }
        //password hash (only for local auth with password)
        if (this.password && this.isModified('password')) {
            this.password = yield bcrypt_1.default.hash(this.password, Number(config_1.default.bcrypt_salt_rounds));
        }
        next();
    });
});
// Indexes for performance
userSchema.index({ role: 1, status: 1 });
userSchema.index({
    role: 1,
    status: 1,
    averageRating: -1,
    totalConsultations: -1,
});
userSchema.index({ consultancyType: 1 }, { sparse: true });
userSchema.index({ activeStatus: 1 });
exports.User = (0, mongoose_1.model)('User', userSchema);
