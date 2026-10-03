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
exports.TermsService = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const terms_model_1 = require("./terms.model");
const cache_1 = require("../../utils/cache");
const createTerms = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield terms_model_1.Terms.create(payload);
    cache_1.cacheHelper.clearByPrefix('terms:list');
    return result;
});
const getAllTerms = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const cacheKey = `terms:list:${JSON.stringify(query)}`;
    const cachedData = cache_1.cacheHelper.get(cacheKey);
    if (cachedData)
        return cachedData;
    const termsQuery = new QueryBuilder_1.default(terms_model_1.Terms.find(), query)
        .search(['title', 'content'])
        .filter()
        .sort()
        .paginate()
        .fields();
    const result = yield termsQuery.modelQuery.lean();
    const meta = yield termsQuery.getPaginationInfo();
    const response = {
        meta,
        result,
    };
    cache_1.cacheHelper.set(cacheKey, response, 3600); // 1 hour
    return response;
});
const getSingleTerms = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield terms_model_1.Terms.findById(id).lean();
    return result;
});
const updateTerms = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield terms_model_1.Terms.findById(id);
    if (!isExist) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Terms & Conditions not found');
    }
    const result = yield terms_model_1.Terms.findByIdAndUpdate(id, payload, {
        new: true,
    });
    if (result) {
        cache_1.cacheHelper.clearByPrefix('terms:list');
    }
    return result;
});
const deleteTerms = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield terms_model_1.Terms.findById(id);
    if (!isExist) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Terms & Conditions not found');
    }
    const result = yield terms_model_1.Terms.findByIdAndDelete(id);
    if (result) {
        cache_1.cacheHelper.clearByPrefix('terms:list');
    }
    return result;
});
exports.TermsService = {
    createTerms,
    getAllTerms,
    getSingleTerms,
    updateTerms,
    deleteTerms,
};
