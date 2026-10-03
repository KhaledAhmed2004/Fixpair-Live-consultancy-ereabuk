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
exports.ConsultancyTypeController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const consultancyType_service_1 = require("./consultancyType.service");
const createConsultancyType = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield consultancyType_service_1.ConsultancyTypeService.createConsultancyType(req.body);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        message: 'Consultancy type created successfully',
        data: result,
    });
}));
const getAllConsultancyTypes = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // If admin, they might want to see all. If normal user, maybe only active. 
    // Let's just return all for this endpoint and we can filter on frontend or use a query param.
    // The service separates getActive and getAll. We can check query param `?activeOnly=true`.
    const { activeOnly } = req.query;
    const result = activeOnly === 'true'
        ? yield consultancyType_service_1.ConsultancyTypeService.getActiveConsultancyTypes()
        : yield consultancyType_service_1.ConsultancyTypeService.getAllConsultancyTypes();
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Consultancy types retrieved successfully',
        data: result,
    });
}));
const updateConsultancyType = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield consultancyType_service_1.ConsultancyTypeService.updateConsultancyType(req.params.typeId, req.body);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Consultancy type updated successfully',
        data: result,
    });
}));
const deleteConsultancyType = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield consultancyType_service_1.ConsultancyTypeService.deleteConsultancyType(req.params.typeId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Consultancy type deleted successfully',
        data: result,
    });
}));
exports.ConsultancyTypeController = {
    createConsultancyType,
    getAllConsultancyTypes,
    updateConsultancyType,
    deleteConsultancyType,
};
