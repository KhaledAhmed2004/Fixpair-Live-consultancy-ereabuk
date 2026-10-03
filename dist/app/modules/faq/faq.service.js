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
exports.FaqService = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const faq_model_1 = require("./faq.model");
const cache_1 = require("../../utils/cache");
const createFaq = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield faq_model_1.Faq.create(payload);
    cache_1.cacheHelper.clearByPrefix('faq:list');
    return result;
});
const getAllFaqs = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const cacheKey = `faq:list:${JSON.stringify(query)}`;
    const cachedData = cache_1.cacheHelper.get(cacheKey);
    if (cachedData)
        return cachedData;
    const faqQuery = new QueryBuilder_1.default(faq_model_1.Faq.find({ status: 'active' }), query)
        .search(['question', 'answer'])
        .filter()
        .sort()
        .paginate()
        .fields();
    const result = yield faqQuery.modelQuery.lean();
    const meta = yield faqQuery.getPaginationInfo();
    const response = {
        meta,
        result,
    };
    cache_1.cacheHelper.set(cacheKey, response, 1800); // 30 mins
    return response;
});
const getSingleFaq = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield faq_model_1.Faq.findById(id).lean();
    return result;
});
const updateFaq = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield faq_model_1.Faq.findById(id);
    if (!isExist) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'FAQ not found');
    }
    const result = yield faq_model_1.Faq.findByIdAndUpdate(id, payload, {
        new: true,
    });
    if (result) {
        cache_1.cacheHelper.clearByPrefix('faq:list');
    }
    return result;
});
const deleteFaq = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield faq_model_1.Faq.findById(id);
    if (!isExist) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'FAQ not found');
    }
    const result = yield faq_model_1.Faq.findByIdAndDelete(id);
    if (result) {
        cache_1.cacheHelper.clearByPrefix('faq:list');
    }
    return result;
});
exports.FaqService = {
    createFaq,
    getAllFaqs,
    getSingleFaq,
    updateFaq,
    deleteFaq,
};
