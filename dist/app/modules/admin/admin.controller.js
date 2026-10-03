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
exports.AdminController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const system_1 = require("../../utils/system");
const admin_service_1 = require("./admin.service");
const parseMonths = (value) => {
    return value === '6' ? 6 : 12;
};
const parseLimit = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};
const getDashboardSummary = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const filter = req.query.filter || 'all_time';
    const result = yield admin_service_1.AdminService.getDashboardSummary(filter);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Dashboard summary retrieved successfully',
        meta: { comparisonPeriod: filter },
        data: result,
    });
}));
const getConsultationTrend = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const months = parseMonths(req.query.months);
    const result = yield admin_service_1.AdminService.getConsultationTrend(months);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Consultation trend retrieved successfully',
        data: result,
    });
}));
const getUserGrowth = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const months = parseMonths(req.query.months);
    const result = yield admin_service_1.AdminService.getUserGrowth(months);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'User growth retrieved successfully',
        data: result,
    });
}));
const getConsultationStatusDistribution = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const months = parseMonths(req.query.months);
    const result = yield admin_service_1.AdminService.getConsultationStatusDistribution(months);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Consultation status distribution retrieved successfully',
        data: result,
    });
}));
const getTopConsultants = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const limit = parseLimit(req.query.limit, 5);
    const result = yield admin_service_1.AdminService.getTopConsultants(limit);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Top consultants retrieved successfully',
        data: result,
    });
}));
const getRecentActivities = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const limit = parseLimit(req.query.limit, 10);
    const result = yield admin_service_1.AdminService.getRecentActivities(limit);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Recent activities retrieved successfully',
        data: result,
    });
}));
const getRecentConsultations = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const limit = parseLimit(req.query.limit, 5);
    const result = yield admin_service_1.AdminService.getRecentConsultations(limit);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Recent consultations retrieved successfully',
        data: result,
    });
}));
const getActiveConsultations = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield admin_service_1.AdminService.getActiveConsultations();
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Active consultations count retrieved successfully',
        data: result,
    });
}));
const getRevenueSummary = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield admin_service_1.AdminService.getRevenueSummary();
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Revenue summary retrieved successfully',
        data: result,
    });
}));
const getAllTransactions = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield admin_service_1.AdminService.getAllTransactions(req.query);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Transactions retrieved successfully',
        pagination: result.meta,
        data: result.result,
    });
}));
const getRevenueTrend = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield admin_service_1.AdminService.getRevenueTrend();
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Revenue trend retrieved successfully',
        data: result,
    });
}));
const getSystemMonitor = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, system_1.getSystemMetrics)();
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'System metrics retrieved successfully',
        data: result,
    });
}));
exports.AdminController = {
    getDashboardSummary,
    getConsultationTrend,
    getUserGrowth,
    getConsultationStatusDistribution,
    getTopConsultants,
    getRecentActivities,
    getRecentConsultations,
    getActiveConsultations,
    getRevenueSummary,
    getAllTransactions,
    getRevenueTrend,
    getSystemMonitor,
};
