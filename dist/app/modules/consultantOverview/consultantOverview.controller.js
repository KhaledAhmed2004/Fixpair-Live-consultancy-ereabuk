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
exports.ConsultantOverviewController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const consultantOverview_service_1 = require("./consultantOverview.service");
const parseLimit = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};
const parseDays = (value) => {
    return value === '7' ? 7 : 30;
};
const getDashboardSummary = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield consultantOverview_service_1.ConsultantOverviewService.getDashboardSummary(user.id);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Consultant dashboard summary retrieved successfully',
        meta: { comparisonPeriod: '30d' },
        data: result,
    });
}));
const getConsultationTrend = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const days = parseDays(req.query.days);
    const result = yield consultantOverview_service_1.ConsultantOverviewService.getConsultationTrend(user.id, days);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Consultant consultation trend retrieved successfully',
        data: result,
    });
}));
const getMyRatings = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield consultantOverview_service_1.ConsultantOverviewService.getMyRatings(user.id);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Consultant ratings retrieved successfully',
        data: result,
    });
}));
const getRecentBookings = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const limit = parseLimit(req.query.limit, 5);
    const result = yield consultantOverview_service_1.ConsultantOverviewService.getRecentBookings(user.id, limit);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Recent bookings retrieved successfully',
        data: result,
    });
}));
const getRecentFeedback = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const limit = parseLimit(req.query.limit, 5);
    const result = yield consultantOverview_service_1.ConsultantOverviewService.getRecentFeedback(user.id, limit);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Recent feedback retrieved successfully',
        data: result,
    });
}));
const getMyTransactions = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield consultantOverview_service_1.ConsultantOverviewService.getMyTransactions(user.id, req.query);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Transactions retrieved successfully',
        pagination: result.meta,
        data: result.result,
    });
}));
exports.ConsultantOverviewController = {
    getDashboardSummary,
    getConsultationTrend,
    getMyRatings,
    getRecentBookings,
    getRecentFeedback,
    getMyTransactions,
};
