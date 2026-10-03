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
exports.UserService = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
const bcrypt_1 = __importDefault(require("bcrypt"));
const http_status_codes_1 = require("http-status-codes");
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../../../config"));
const user_1 = require("../../../enums/user");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const emailHelper_1 = require("../../../helpers/emailHelper");
const emailTemplate_1 = require("../../../shared/emailTemplate");
const unlinkFile_1 = __importDefault(require("../../../shared/unlinkFile"));
const generateOTP_1 = __importDefault(require("../../../util/generateOTP"));
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const user_model_1 = require("./user.model");
const review_service_1 = require("../review/review.service");
const consultantOverview_service_1 = require("../consultantOverview/consultantOverview.service");
const cache_1 = require("../../utils/cache");
const consultancyType_model_1 = require("../consultancyType/consultancyType.model");
const notification_service_1 = require("../notification/notification.service");
const socketHelper_1 = require("../../../helpers/socketHelper");
const getAllUsersToDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const userQuery = new QueryBuilder_1.default(user_model_1.User.find().select('-authentication -password -paymentMethods -fcmTokens -stripeCustomerId -paypalPayerId').populate('consultancyType'), query)
        .search(['name', 'email', 'contact'])
        .filter()
        .paginate()
        .fields();
    const result = yield userQuery.modelQuery.lean();
    const meta = yield userQuery.getPaginationInfo();
    // If fetching consultants, attach their stats efficiently
    const consultantIds = result
        .filter((user) => user.role === user_1.USER_ROLES.CONSULTANT)
        .map((user) => user._id.toString());
    const statsMap = yield review_service_1.ReviewService.getBulkConsultantStats(consultantIds);
    const resultWithStats = result.map((user) => {
        if (user.role === user_1.USER_ROLES.CONSULTANT) {
            const stats = statsMap[user._id.toString()] || {
                avgRating: 0,
                totalReviews: 0,
            };
            return Object.assign(Object.assign({}, user), { stats });
        }
        return user;
    });
    return { result: resultWithStats, meta };
});
const createUserToDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    //set role
    payload.role = payload.role || user_1.USER_ROLES.USER;
    if (payload.role === user_1.USER_ROLES.CONSULTANT) {
        payload.verified = true;
        if (payload.consultancyType) {
            const isExistType = yield consultancyType_model_1.ConsultancyType.findOne({ _id: payload.consultancyType, status: 'active' });
            if (!isExistType) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid or inactive consultancy type');
            }
        }
    }
    const createUser = yield user_model_1.User.create(payload);
    if (!createUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Failed to create user');
    }
    if (payload.role === user_1.USER_ROLES.CONSULTANT) {
        // Notify admins about the new consultant registration
        yield notification_service_1.NotificationService.notifyAdmins({
            title: 'New Consultant Registration',
            message: `${createUser.name} has registered as a Consultant.`,
            type: 'NEW_CONSULTANT_REGISTERED',
            metadata: {
                consultantId: createUser._id.toString(),
                name: createUser.name,
            },
        });
    }
    if (payload.role !== user_1.USER_ROLES.CONSULTANT) {
        //send email
        const otp = (0, generateOTP_1.default)();
        const values = {
            name: createUser.name,
            otp: otp,
            email: createUser.email,
        };
        const createAccountTemplate = emailTemplate_1.emailTemplate.createAccount(values);
        emailHelper_1.emailHelper.sendEmail(createAccountTemplate);
        //save to DB
        yield user_model_1.User.findOneAndUpdate({ _id: createUser._id }, {
            $set: {
                'authentication.oneTimeCode': otp,
                'authentication.expireAt': new Date(Date.now() + 3 * 60000),
            },
        });
    }
    return createUser;
});
const getUserProfileFromDB = (user) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = user;
    const isExistUser = yield user_model_1.User.findById(id).select('-authentication -password -fcmTokens -stripeCustomerId -paypalPayerId').populate('consultancyType');
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    const userObj = isExistUser.toObject();
    // If user is a consultant, attach stats
    if (userObj.role === user_1.USER_ROLES.CONSULTANT) {
        const stats = yield review_service_1.ReviewService.getConsultantStats(id);
        userObj.stats = stats;
    }
    return userObj;
});
const updateProfileToDB = (user, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = user;
    const isExistUser = yield user_model_1.User.findById(id);
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    // Prevent users from manually updating sensitive fields via profile update
    const protectedFields = [
        'role',
        'verified',
        'stripeCustomerId',
        'paypalPayerId',
        'authentication',
        'fcmTokens',
        'password',
    ];
    protectedFields.forEach(field => {
        delete payload[field];
    });
    if (payload.consultancyType) {
        const isExistType = yield consultancyType_model_1.ConsultancyType.findOne({ _id: payload.consultancyType, status: 'active' });
        if (!isExistType) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid or inactive consultancy type');
        }
    }
    //unlink file here
    if (payload.image) {
        if (isExistUser.image) {
            (0, unlinkFile_1.default)(isExistUser.image);
        }
    }
    const updateDoc = yield user_model_1.User.findOneAndUpdate({ _id: id }, payload, {
        new: true,
    }).select('-authentication -password -fcmTokens -stripeCustomerId -paypalPayerId').populate('consultancyType');
    if (updateDoc) {
        // Invalidate consultant related caches
        cache_1.cacheHelper.clearByPrefix('consultants:recommended');
        cache_1.cacheHelper.clearByPrefix(`consultants:list`);
    }
    return updateDoc;
});
const updateUserToDB = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const isExistUser = yield user_model_1.User.findById(id);
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User doesn't exist!");
    }
    if (payload.consultancyType) {
        const isExistType = yield consultancyType_model_1.ConsultancyType.findOne({ _id: payload.consultancyType, status: 'active' });
        if (!isExistType) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid or inactive consultancy type');
        }
    }
    //unlink file here
    if (payload.image) {
        if (isExistUser.image) {
            (0, unlinkFile_1.default)(isExistUser.image);
        }
    }
    // Hash password if provided by admin
    if (payload.password) {
        payload.password = yield bcrypt_1.default.hash(payload.password, Number(config_1.default.bcrypt_salt_rounds));
    }
    const updateDoc = yield user_model_1.User.findOneAndUpdate({ _id: id }, payload, {
        new: true,
    }).select('-authentication -password -fcmTokens -stripeCustomerId -paypalPayerId').populate('consultancyType');
    if (updateDoc) {
        // Invalidate consultant related caches
        cache_1.cacheHelper.clearByPrefix('consultants:recommended');
        cache_1.cacheHelper.clearByPrefix(`consultants:list`);
    }
    return updateDoc;
});
const deleteAccountFromDB = (user) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = user;
    const isExistUser = yield user_model_1.User.isExistUserById(id);
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    if (isExistUser.role === user_1.USER_ROLES.SUPER_ADMIN) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Super Admin account cannot be deleted!');
    }
    //unlink file here
    if (isExistUser.image) {
        (0, unlinkFile_1.default)(isExistUser.image);
    }
    const deleteDoc = yield user_model_1.User.findByIdAndDelete(id);
    return deleteDoc;
});
const deleteUserFromDB = (adminId, targetId) => __awaiter(void 0, void 0, void 0, function* () {
    const adminUser = yield user_model_1.User.findById(adminId);
    const targetUser = yield user_model_1.User.findById(targetId);
    if (!targetUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User doesn't exist!");
    }
    // Requirement: Super Admin cannot be deleted by anyone
    if (targetUser.role === user_1.USER_ROLES.SUPER_ADMIN) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Super Admin account cannot be deleted!');
    }
    if ((adminUser === null || adminUser === void 0 ? void 0 : adminUser.role) === user_1.USER_ROLES.ADMIN) {
        // Admin cannot delete other Admins
        if (targetUser.role === user_1.USER_ROLES.ADMIN) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Admin cannot delete another Admin account!');
        }
    }
    // Unlink image if exists
    if (targetUser.image) {
        (0, unlinkFile_1.default)(targetUser.image);
    }
    const result = yield user_model_1.User.findByIdAndDelete(targetId);
    return result;
});
const getSingleUserFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const isExistUser = yield user_model_1.User.findById(id).select('-authentication -password -fcmTokens -stripeCustomerId -paypalPayerId').populate('consultancyType');
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User doesn't exist!");
    }
    const userObj = isExistUser.toObject();
    // If user is a consultant, attach stats
    if (userObj.role === user_1.USER_ROLES.CONSULTANT) {
        const [reviewStats, dashboardStats, reviewsResponse, trendResponse] = yield Promise.all([
            review_service_1.ReviewService.getConsultantStats(id),
            consultantOverview_service_1.ConsultantOverviewService.getDashboardSummary(id),
            review_service_1.ReviewService.getReviewsByConsultant(id, { limit: '5', sort: '-createdAt' }),
            consultantOverview_service_1.ConsultantOverviewService.getConsultationTrend(id, 7) // Last 7 days for the chart
        ]);
        userObj.stats = Object.assign({ averageRating: reviewStats.avgRating }, dashboardStats);
        userObj.reviews = reviewsResponse.result.map((r) => {
            var _a;
            return ({
                _id: r._id,
                name: ((_a = r.user) === null || _a === void 0 ? void 0 : _a.name) || 'Anonymous',
                rating: r.rating,
                date: new Date(r.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
                comment: r.comment
            });
        });
        userObj.chartData = trendResponse.points.map(p => {
            // p.date is usually "YYYY-MM-DD"
            // p.label is like "15 Aug", we convert to "Aug 15"
            const parts = p.label.split(' ');
            const formattedDate = parts.length === 2 ? `${parts[1]} ${parts[0]}` : p.label;
            return {
                rawDate: p.date, // Best practice: keep the raw date for sorting/filtering
                date: formattedDate, // Display date for X-axis
                upcoming: p.upcoming,
                completed: p.completed,
                cancelled: p.cancelled
            };
        });
    }
    return userObj;
});
const getConsultantsFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const cacheKey = `consultants:list:${JSON.stringify(query)}`;
    const cachedData = cache_1.cacheHelper.get(cacheKey);
    if (cachedData)
        return cachedData;
    // Use searchTerm for name filtering if name is provided in query
    const queryData = Object.assign({}, query);
    if (queryData.name) {
        queryData.searchTerm = queryData.name;
        delete queryData.name;
    }
    if (queryData.minPrice !== undefined || queryData.maxPrice !== undefined) {
        queryData.perMinuteRate = {};
        if (queryData.minPrice !== undefined) {
            queryData.perMinuteRate.$gte = Number(queryData.minPrice);
            delete queryData.minPrice;
        }
        if (queryData.maxPrice !== undefined) {
            queryData.perMinuteRate.$lte = Number(queryData.maxPrice);
            delete queryData.maxPrice;
        }
    }
    if (queryData.minRating !== undefined) {
        queryData.averageRating = { $gte: Number(queryData.minRating) };
        delete queryData.minRating;
    }
    if (queryData.consultancyType && !mongoose_1.default.Types.ObjectId.isValid(queryData.consultancyType)) {
        const typeDoc = yield consultancyType_model_1.ConsultancyType.findOne({ name: { $regex: new RegExp(`^${queryData.consultancyType}$`, 'i') } });
        if (typeDoc) {
            queryData.consultancyType = typeDoc._id;
        }
        else {
            queryData.consultancyType = new mongoose_1.default.Types.ObjectId();
        }
    }
    const consultantQuery = new QueryBuilder_1.default(user_model_1.User.find({
        role: user_1.USER_ROLES.CONSULTANT,
        status: 'active',
    }).select('name image bio consultancyType experience languages expertise perMinuteRate currency activeStatus averageRating totalReviews createdAt updatedAt').populate('consultancyType'), queryData)
        .search(['name', 'email', 'expertise'])
        .filter()
        .paginate()
        .fields();
    const result = yield consultantQuery.modelQuery.lean();
    const meta = yield consultantQuery.getPaginationInfo();
    const response = { result, meta };
    cache_1.cacheHelper.set(cacheKey, response, 300); // 5 mins
    return response;
});
const updateDeviceTokenToDB = (userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { deviceToken, deviceType, action = 'add' } = payload;
    let updateOperation;
    if (action === 'add') {
        updateOperation = {
            $addToSet: { fcmTokens: deviceToken },
            $set: { deviceType },
        };
    }
    else {
        updateOperation = {
            $pull: { fcmTokens: deviceToken },
        };
    }
    const result = yield user_model_1.User.findByIdAndUpdate(userId, updateOperation, {
        new: true,
    });
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
    }
    return result;
});
const toggleStatusInDB = (userId, activeStatus) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield user_model_1.User.findByIdAndUpdate(userId, { activeStatus }, { new: true, runValidators: true }).select('name email activeStatus role');
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
    }
    // Clear cache if they are a consultant
    if (user.role === 'CONSULTANT') {
        cache_1.cacheHelper.clearByPrefix('consultants:recommended');
        cache_1.cacheHelper.clearByPrefix('consultants:list');
        socketHelper_1.socketHelper.broadcastAll('consultant:status-changed', {
            consultantId: userId,
            activeStatus: user.activeStatus,
        });
    }
    return user;
});
exports.UserService = {
    getAllUsersToDB,
    createUserToDB,
    getUserProfileFromDB,
    updateProfileToDB,
    deleteAccountFromDB,
    deleteUserFromDB,
    getSingleUserFromDB,
    getConsultantsFromDB,
    updateDeviceTokenToDB,
    toggleStatusInDB,
    updateUserToDB,
};
