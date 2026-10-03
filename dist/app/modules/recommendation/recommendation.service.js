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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecommendationService = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
const user_model_1 = require("../user/user.model");
const user_1 = require("../../../enums/user");
const cache_1 = require("../../utils/cache");
const db_perf_1 = require("../../utils/db-perf");
const getRecommendedConsultants = () => __awaiter(void 0, void 0, void 0, function* () {
    const cacheKey = 'consultants:recommended';
    const cachedData = cache_1.cacheHelper.get(cacheKey);
    if (cachedData)
        return cachedData;
    const consultants = yield (0, db_perf_1.monitorDB)('getRecommendedConsultants', () => user_model_1.User.find({
        role: user_1.USER_ROLES.CONSULTANT,
        status: 'active',
        verified: true,
        consultancyType: { $ne: null },
    })
        .select('name firstName lastName consultancyType expertise averageRating totalConsultations totalReviews perMinuteRate visitFee image avatar activeStatus')
        .sort({
        consultancyType: 1,
        averageRating: -1,
        totalConsultations: -1,
    })
        .lean());
    // Group by category and slice top 5 manually (faster than aggregation for this size)
    const grouped = {};
    consultants.forEach(c => {
        const type = String(c.consultancyType || 'Other');
        if (!grouped[type])
            grouped[type] = [];
        if (grouped[type].length < 5) {
            grouped[type].push(Object.assign(Object.assign({}, c), { rating: c.averageRating, tag: 'Recommended' }));
        }
    });
    const result = Object.entries(grouped).map(([category, consultants]) => ({
        category,
        consultants,
    }));
    cache_1.cacheHelper.set(cacheKey, result, 300); // 5 mins
    return result;
});
exports.RecommendationService = {
    getRecommendedConsultants,
};
