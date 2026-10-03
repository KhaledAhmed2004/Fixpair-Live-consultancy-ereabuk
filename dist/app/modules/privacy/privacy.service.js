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
exports.PrivacyService = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const privacy_model_1 = require("./privacy.model");
const cache_1 = require("../../utils/cache");
const createPrivacy = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield privacy_model_1.Privacy.create(payload);
    cache_1.cacheHelper.clearByPrefix('privacy:list');
    return result;
});
const getAllPrivacies = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const cacheKey = `privacy:list:${JSON.stringify(query)}`;
    const cachedData = cache_1.cacheHelper.get(cacheKey);
    if (cachedData)
        return cachedData;
    const privacyQuery = new QueryBuilder_1.default(privacy_model_1.Privacy.find(), query)
        .search(['title', 'content'])
        .filter()
        .sort()
        .paginate()
        .fields();
    const result = yield privacyQuery.modelQuery.lean();
    const meta = yield privacyQuery.getPaginationInfo();
    const response = {
        meta,
        result,
    };
    cache_1.cacheHelper.set(cacheKey, response, 3600); // 1 hour
    return response;
});
const getSinglePrivacy = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield privacy_model_1.Privacy.findById(id).lean();
    return result;
});
const updatePrivacy = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield privacy_model_1.Privacy.findById(id);
    if (!isExist) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Privacy Policy not found');
    }
    const result = yield privacy_model_1.Privacy.findByIdAndUpdate(id, payload, {
        new: true,
    });
    if (result) {
        cache_1.cacheHelper.clearByPrefix('privacy:list');
    }
    return result;
});
const deletePrivacy = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield privacy_model_1.Privacy.findById(id);
    if (!isExist) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Privacy Policy not found');
    }
    const result = yield privacy_model_1.Privacy.findByIdAndDelete(id);
    if (result) {
        cache_1.cacheHelper.clearByPrefix('privacy:list');
    }
    return result;
});
exports.PrivacyService = {
    createPrivacy,
    getAllPrivacies,
    getSinglePrivacy,
    updatePrivacy,
    deletePrivacy,
};
