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
exports.ReviewService = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const consultation_model_1 = require("../consultation/consultation.model");
const review_model_1 = require("./review.model");
const mongoose_1 = __importDefault(require("mongoose"));
const user_model_1 = require("../user/user.model");
const cache_1 = require("../../utils/cache");
/**
 * Helper to update consultant precomputed stats
 */
const updateConsultantStats = (consultantId) => __awaiter(void 0, void 0, void 0, function* () {
    const stats = yield review_model_1.Review.aggregate([
        {
            $match: {
                consultant: new mongoose_1.default.Types.ObjectId(consultantId.toString()),
            },
        },
        {
            $group: {
                _id: '$consultant',
                avgRating: { $avg: '$rating' },
                totalReviews: { $sum: 1 },
            },
        },
    ]);
    const avgRating = stats.length > 0 ? parseFloat(stats[0].avgRating.toFixed(1)) : 0;
    const totalReviews = stats.length > 0 ? stats[0].totalReviews : 0;
    yield user_model_1.User.findByIdAndUpdate(consultantId, {
        averageRating: avgRating,
        totalReviews: totalReviews,
    });
    // Invalidate related caches
    cache_1.cacheHelper.clearByPrefix('consultants:recommended');
    cache_1.cacheHelper.clearByPrefix(`consultants:list`);
    cache_1.cacheHelper.clearByPrefix(`reviews:list:${consultantId}`);
    cache_1.cacheHelper.clearByPrefix('reviews:recent');
});
const createReview = (user, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { consultationId, rating, comment } = payload;
    // 1. Check if consultation exists and is completed
    const consultation = yield consultation_model_1.Consultation.findById(consultationId);
    if (!consultation) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Consultation not found');
    }
    if (consultation.status !== 'completed') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Review can only be created for completed consultations');
    }
    // 2. Check ownership (only the user who had the consultation can review)
    if (consultation.user.toString() !== user.id) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You are not authorized to review this consultation');
    }
    // 3. Check if review already exists for this consultation
    const existingReview = yield review_model_1.Review.findOne({ consultation: consultationId });
    if (existingReview) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Review already exists for this consultation');
    }
    // 4. Create review
    const reviewData = {
        user: new mongoose_1.default.Types.ObjectId(user.id),
        consultant: consultation.consultant,
        consultation: new mongoose_1.default.Types.ObjectId(consultationId),
        rating,
        comment,
    };
    const result = yield review_model_1.Review.create(reviewData);
    // Update consultant precomputed fields
    yield updateConsultantStats(consultation.consultant);
    return result;
});
const getReviewsByConsultant = (consultantId, query) => __awaiter(void 0, void 0, void 0, function* () {
    const cacheKey = `reviews:list:${consultantId}:${JSON.stringify(query)}`;
    const cachedData = cache_1.cacheHelper.get(cacheKey);
    if (cachedData)
        return cachedData;
    const reviewQuery = new QueryBuilder_1.default(review_model_1.Review.find({ consultant: consultantId }), query)
        .filter()
        .sort()
        .paginate()
        .fields();
    const result = yield reviewQuery.modelQuery
        .populate([
        { path: 'user', select: 'name image avatar' },
        { path: 'consultant', select: 'name image avatar' },
    ])
        .lean();
    const meta = yield reviewQuery.getPaginationInfo();
    const response = { result, meta };
    cache_1.cacheHelper.set(cacheKey, response, 300); // 5 mins
    return response;
});
const updateReview = (user, reviewId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const review = yield review_model_1.Review.findById(reviewId);
    if (!review) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Review not found');
    }
    // Check ownership
    if (review.user.toString() !== user.id) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You can only update your own reviews');
    }
    const result = yield review_model_1.Review.findByIdAndUpdate(reviewId, payload, {
        new: true,
    });
    if (result) {
        yield updateConsultantStats(result.consultant);
    }
    return result;
});
const deleteReview = (user, reviewId) => __awaiter(void 0, void 0, void 0, function* () {
    const review = yield review_model_1.Review.findById(reviewId);
    if (!review) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Review not found');
    }
    // Check ownership
    if (review.user.toString() !== user.id) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You can only delete your own reviews');
    }
    yield review_model_1.Review.findByIdAndDelete(reviewId);
    // Update consultant precomputed fields
    yield updateConsultantStats(review.consultant);
    return null;
});
const getConsultantStats = (consultantId) => __awaiter(void 0, void 0, void 0, function* () {
    const stats = yield review_model_1.Review.aggregate([
        { $match: { consultant: new mongoose_1.default.Types.ObjectId(consultantId) } },
        {
            $group: {
                _id: '$consultant',
                avgRating: { $avg: '$rating' },
                totalReviews: { $sum: 1 },
            },
        },
    ]);
    return stats.length > 0
        ? {
            avgRating: parseFloat(stats[0].avgRating.toFixed(1)),
            totalReviews: stats[0].totalReviews,
        }
        : { avgRating: 0, totalReviews: 0 };
});
const getBulkConsultantStats = (consultantIds) => __awaiter(void 0, void 0, void 0, function* () {
    const ids = consultantIds.map(id => new mongoose_1.default.Types.ObjectId(id));
    const stats = yield review_model_1.Review.aggregate([
        { $match: { consultant: { $in: ids } } },
        {
            $group: {
                _id: '$consultant',
                avgRating: { $avg: '$rating' },
                totalReviews: { $sum: 1 },
            },
        },
    ]);
    const statsMap = {};
    stats.forEach(s => {
        statsMap[s._id.toString()] = {
            avgRating: parseFloat(s.avgRating.toFixed(1)),
            totalReviews: s.totalReviews,
        };
    });
    return statsMap;
});
const getRecentReviews = () => __awaiter(void 0, void 0, void 0, function* () {
    const cacheKey = 'reviews:recent';
    const cachedData = cache_1.cacheHelper.get(cacheKey);
    if (cachedData)
        return cachedData;
    const result = yield review_model_1.Review.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate([
        { path: 'user', select: 'name image avatar' },
        { path: 'consultant', select: 'name image avatar' },
    ])
        .lean();
    cache_1.cacheHelper.set(cacheKey, result, 300); // 5 mins
    return result;
});
exports.ReviewService = {
    createReview,
    getReviewsByConsultant,
    updateReview,
    deleteReview,
    getConsultantStats,
    getBulkConsultantStats,
    getRecentReviews,
};
