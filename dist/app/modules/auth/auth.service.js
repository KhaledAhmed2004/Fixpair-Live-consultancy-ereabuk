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
exports.AuthService = void 0;
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
const bcrypt_1 = __importDefault(require("bcrypt"));
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const http_status_codes_1 = require("http-status-codes");
const config_1 = __importDefault(require("../../../config"));
const user_1 = require("../../../enums/user");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const emailHelper_1 = require("../../../helpers/emailHelper");
const jwtHelper_1 = require("../../../helpers/jwtHelper");
const emailTemplate_1 = require("../../../shared/emailTemplate");
const cryptoToken_1 = __importDefault(require("../../../util/cryptoToken"));
const generateOTP_1 = __importDefault(require("../../../util/generateOTP"));
const resetToken_model_1 = require("../resetToken/resetToken.model");
const user_model_1 = require("../user/user.model");
const cache_1 = require("../../utils/cache");
const socketHelper_1 = require("../../../helpers/socketHelper");
//login
const loginUserFromDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password, rememberMe = false } = payload;
    const isExistUser = yield user_model_1.User.findOne({ email }).select('+password');
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    //check verified and status
    if (!isExistUser.verified) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Please verify your account, then try to login again');
    }
    //check user status
    if (isExistUser.status === 'deleted') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'You don’t have permission to access this content.It looks like your account has been deactivated.');
    }
    //check match password
    if (password &&
        !(yield user_model_1.User.isMatchPassword(password, isExistUser.password))) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Password is incorrect!');
    }
    //create access token
    const accessToken = jwtHelper_1.jwtHelper.createToken({
        id: isExistUser._id.toString(),
        role: isExistUser.role,
        email: isExistUser.email,
    }, config_1.default.jwt.jwt_secret, config_1.default.jwt.jwt_expire_in);
    // Set refresh token expiration based on rememberMe:
    // rememberMe: true => long-lived (e.g. 90d from config)
    // rememberMe: false => short-lived (1d)
    const refreshExpireIn = rememberMe
        ? config_1.default.jwt.jwt_refresh_expire_in || '90d'
        : '1d';
    //create refresh token
    const refreshToken = jwtHelper_1.jwtHelper.createToken({
        id: isExistUser._id.toString(),
        role: isExistUser.role,
        email: isExistUser.email,
        rememberMe,
    }, config_1.default.jwt.jwt_refresh_secret, refreshExpireIn);
    // If user is a CONSULTANT, mark activeStatus: true and broadcast presence
    if (isExistUser.role === user_1.USER_ROLES.CONSULTANT) {
        yield user_model_1.User.findByIdAndUpdate(isExistUser._id, { activeStatus: true });
        cache_1.cacheHelper.clearByPrefix('consultants:recommended');
        cache_1.cacheHelper.clearByPrefix('consultants:list');
        socketHelper_1.socketHelper.broadcastAll('consultant:status-changed', {
            consultantId: isExistUser._id.toString(),
            activeStatus: true,
        });
    }
    return { accessToken, refreshToken, rememberMe };
});
//social login
const socialLoginFromDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { idToken, provider, rememberMe = false } = payload;
    try {
        // Verify the Firebase ID Token
        const decodedToken = yield firebase_admin_1.default.auth().verifyIdToken(idToken);
        // Extracted user details from Firebase token
        const firebaseUid = decodedToken.uid;
        const email = decodedToken.email;
        const name = decodedToken.name || ((_a = decodedToken.email) === null || _a === void 0 ? void 0 : _a.split('@')[0]) || 'User';
        const avatar = decodedToken.picture || '';
        // Database Sync Flow:
        // 1. Check if user already exists in database by email or firebaseUid
        let user = yield user_model_1.User.findOne({
            $or: [{ email }, { firebaseUid }],
        });
        if (!user) {
            // 2. If user does not exist, create a new record (Auto-Registration)
            user = yield user_model_1.User.create({
                name,
                email,
                firebaseUid,
                avatar,
                verified: true, // Social accounts are pre-verified
                provider: provider,
                role: user_1.USER_ROLES.USER, // Default role for social login
            });
        }
        else {
            // Update firebaseUid or provider details if missing or different
            let isUpdated = false;
            if (!user.firebaseUid) {
                user.firebaseUid = firebaseUid;
                isUpdated = true;
            }
            if (user.provider !== provider) {
                user.provider = provider;
                isUpdated = true;
            }
            if (isUpdated) {
                yield user.save();
            }
        }
        // 3. Generate standard backend JWT tokens
        const accessToken = jwtHelper_1.jwtHelper.createToken({
            id: user._id.toString(),
            role: user.role,
            email: user.email,
        }, config_1.default.jwt.jwt_secret, config_1.default.jwt.jwt_expire_in);
        const refreshExpireIn = rememberMe
            ? config_1.default.jwt.jwt_refresh_expire_in || '90d'
            : '1d';
        const refreshToken = jwtHelper_1.jwtHelper.createToken({
            id: user._id.toString(),
            role: user.role,
            email: user.email,
            rememberMe,
        }, config_1.default.jwt.jwt_refresh_secret, refreshExpireIn);
        if (user.role === user_1.USER_ROLES.CONSULTANT) {
            yield user_model_1.User.findByIdAndUpdate(user._id, { activeStatus: true });
            cache_1.cacheHelper.clearByPrefix('consultants:recommended');
            cache_1.cacheHelper.clearByPrefix('consultants:list');
            socketHelper_1.socketHelper.broadcastAll('consultant:status-changed', {
                consultantId: user._id.toString(),
                activeStatus: true,
            });
        }
        return { accessToken, refreshToken, rememberMe };
    }
    catch (error) {
        console.error('Firebase Token Verification Error Details:', {
            message: error.message,
            code: error.code,
            stack: error.stack,
        });
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, `Firebase verification failed: ${error.message}`);
    }
});
//forget password
const forgetPasswordToDB = (email) => __awaiter(void 0, void 0, void 0, function* () {
    const isExistUser = yield user_model_1.User.isExistUserByEmail(email);
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    //send mail
    const otp = (0, generateOTP_1.default)();
    const value = {
        otp,
        email: isExistUser.email,
    };
    const forgetPassword = emailTemplate_1.emailTemplate.resetPassword(value);
    emailHelper_1.emailHelper.sendEmail(forgetPassword);
    //save to DB
    yield user_model_1.User.findOneAndUpdate({ email }, {
        $set: {
            'authentication.oneTimeCode': otp,
            'authentication.expireAt': new Date(Date.now() + 3 * 60000),
        },
    });
});
//verify email
const verifyEmailToDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { email, oneTimeCode } = payload;
    const isExistUser = yield user_model_1.User.findOne({ email });
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    if (!oneTimeCode) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Please give the otp, check your email we send a code');
    }
    if (((_a = isExistUser.authentication) === null || _a === void 0 ? void 0 : _a.oneTimeCode) !== oneTimeCode) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'You provided wrong otp');
    }
    const date = new Date();
    if (date > ((_b = isExistUser.authentication) === null || _b === void 0 ? void 0 : _b.expireAt)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Otp already expired, Please try again');
    }
    let message;
    let data;
    if (!isExistUser.verified) {
        yield user_model_1.User.findOneAndUpdate({ _id: isExistUser._id }, {
            $set: {
                verified: true,
                'authentication.oneTimeCode': null,
                'authentication.expireAt': null,
            },
        });
        message = 'Email verify successfully';
    }
    else {
        yield user_model_1.User.findOneAndUpdate({ _id: isExistUser._id }, {
            $set: {
                'authentication.isResetPassword': true,
                'authentication.oneTimeCode': null,
                'authentication.expireAt': null,
            },
        });
        //create token ;
        const createToken = (0, cryptoToken_1.default)();
        yield resetToken_model_1.ResetToken.create({
            user: isExistUser._id,
            token: createToken,
            expireAt: new Date(Date.now() + 5 * 60000),
        });
        message =
            'Verification Successful: Please securely store and utilize this code for reset password';
        data = createToken;
    }
    return { data, message };
});
//forget password
const resetPasswordToDB = (token, payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { newPassword, confirmPassword } = payload;
    //isExist token
    const isExistToken = yield resetToken_model_1.ResetToken.isExistToken(token.trim());
    if (!isExistToken) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'You are not authorized');
    }
    //user permission check
    const isExistUser = yield user_model_1.User.findById(isExistToken.user).select('+authentication');
    if (!((_a = isExistUser === null || isExistUser === void 0 ? void 0 : isExistUser.authentication) === null || _a === void 0 ? void 0 : _a.isResetPassword)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, "You don't have permission to change the password. Please click again to 'Forgot Password'");
    }
    //validity check
    const isValid = yield resetToken_model_1.ResetToken.isExpireToken(token);
    if (!isValid) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Token expired, Please click again to the forget password');
    }
    //check password
    if (newPassword !== confirmPassword) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "New password and Confirm password doesn't match!");
    }
    const hashPassword = yield bcrypt_1.default.hash(newPassword, Number(config_1.default.bcrypt_salt_rounds));
    yield user_model_1.User.findOneAndUpdate({ _id: isExistToken.user }, {
        $set: {
            password: hashPassword,
            'authentication.isResetPassword': false,
        },
    }, {
        new: true,
    });
});
const changePasswordToDB = (user, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { currentPassword, newPassword, confirmPassword } = payload;
    const isExistUser = yield user_model_1.User.findById(user.id).select('+password');
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    //current password match
    if (currentPassword &&
        !(yield user_model_1.User.isMatchPassword(currentPassword, isExistUser.password))) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Password is incorrect');
    }
    //newPassword and current password
    if (currentPassword === newPassword) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Please give different password from current password');
    }
    //new password and confirm password check
    if (newPassword !== confirmPassword) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "Password and Confirm password doesn't matched");
    }
    //hash password
    const hashPassword = yield bcrypt_1.default.hash(newPassword, Number(config_1.default.bcrypt_salt_rounds));
    yield user_model_1.User.findOneAndUpdate({ _id: user.id }, { $set: { password: hashPassword } }, { new: true });
});
// resend otp
const resendOtpToDB = (email) => __awaiter(void 0, void 0, void 0, function* () {
    const isExistUser = yield user_model_1.User.findOne({ email });
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    const now = new Date();
    const auth = isExistUser.authentication;
    // Rate limit logic: 3 requests, then 15 minutes wait
    if (auth === null || auth === void 0 ? void 0 : auth.lastOtpRequestTime) {
        const timeDifference = now.getTime() - auth.lastOtpRequestTime.getTime();
        const fifteenMinutes = 15 * 60 * 1000;
        if (auth.otpRequestCount >= 3) {
            if (timeDifference < fifteenMinutes) {
                const remainingTime = Math.ceil((fifteenMinutes - timeDifference) / 60000);
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.TOO_MANY_REQUESTS, `Too many requests. Please try again after ${remainingTime} minutes.`);
            }
            else {
                // Reset count after 15 minutes
                yield user_model_1.User.findOneAndUpdate({ _id: isExistUser._id }, { $set: { 'authentication.otpRequestCount': 0 } });
            }
        }
    }
    // generate new otp
    const otp = (0, generateOTP_1.default)();
    const values = {
        name: isExistUser.name,
        otp,
        email: isExistUser.email,
    };
    const resendTemplate = emailTemplate_1.emailTemplate.createAccount(values);
    emailHelper_1.emailHelper.sendEmail(resendTemplate);
    // update user authentication data using dot notation
    yield user_model_1.User.findOneAndUpdate({ _id: isExistUser._id }, {
        $set: {
            'authentication.oneTimeCode': otp,
            'authentication.expireAt': new Date(Date.now() + 3 * 60000), // 3 minutes expiry
            'authentication.lastOtpRequestTime': now,
        },
        $inc: { 'authentication.otpRequestCount': 1 },
    });
    return { message: 'OTP resent successfully, please check your email' };
});
const refreshToken = (token) => __awaiter(void 0, void 0, void 0, function* () {
    let verifiedToken = null;
    try {
        verifiedToken = jwtHelper_1.jwtHelper.verifyToken(token, config_1.default.jwt.jwt_refresh_secret);
    }
    catch (err) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Invalid Refresh Token');
    }
    const { id } = verifiedToken;
    const isExistUser = yield user_model_1.User.findById(id);
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    //create access token
    const accessToken = jwtHelper_1.jwtHelper.createToken({
        id: isExistUser._id.toString(),
        role: isExistUser.role,
        email: isExistUser.email,
    }, config_1.default.jwt.jwt_secret, config_1.default.jwt.jwt_expire_in);
    return { accessToken };
});
const logoutUserFromDB = (userId, role, deviceToken) => __awaiter(void 0, void 0, void 0, function* () {
    // If deviceToken is provided, remove it from fcmTokens
    if (deviceToken) {
        yield user_model_1.User.findByIdAndUpdate(userId, {
            $pull: { fcmTokens: deviceToken },
        });
    }
    // If consultant logs out, mark activeStatus to false and notify clients
    if (role === user_1.USER_ROLES.CONSULTANT) {
        yield user_model_1.User.findByIdAndUpdate(userId, { activeStatus: false });
        cache_1.cacheHelper.clearByPrefix('consultants:recommended');
        cache_1.cacheHelper.clearByPrefix('consultants:list');
        socketHelper_1.socketHelper.broadcastAll('consultant:status-changed', {
            consultantId: userId,
            activeStatus: false,
        });
    }
    // Disconnect active socket connections for this user
    socketHelper_1.socketHelper.disconnectUser(userId);
    return { message: 'Logged out successfully' };
});
exports.AuthService = {
    verifyEmailToDB,
    loginUserFromDB,
    socialLoginFromDB,
    forgetPasswordToDB,
    resetPasswordToDB,
    changePasswordToDB,
    resendOtpToDB,
    refreshToken,
    logoutUserFromDB,
};
