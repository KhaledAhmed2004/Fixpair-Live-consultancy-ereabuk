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
exports.ConsultationController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const consultation_service_1 = require("./consultation.service");
const setUnavailability = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield consultation_service_1.ConsultationService.setUnavailability(user, req.body.slots);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Unavailability set successfully',
        data: result,
    });
}));
const getMyUnavailability = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield consultation_service_1.ConsultationService.getMyUnavailability(user);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'My unavailability retrieved successfully',
        data: result,
    });
}));
const removeUnavailability = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { slotId } = req.params;
    const result = yield consultation_service_1.ConsultationService.removeUnavailability(user, slotId, req.body);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Unavailable slot removed successfully',
        data: result,
    });
}));
const getAvailableSlots = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { consultantId } = req.params;
    const { date } = req.query;
    const result = yield consultation_service_1.ConsultationService.getAvailableSlots(consultantId, date);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Available slots retrieved successfully',
        data: result,
    });
}));
const createBooking = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield consultation_service_1.ConsultationService.createBooking(user, req.body);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        message: 'Consultation booked successfully',
        data: result,
    });
}));
const getMyBookings = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield consultation_service_1.ConsultationService.getMyBookings(user, req.query);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Bookings retrieved successfully',
        pagination: result.meta,
        data: result.result,
    });
}));
const getMyAppointments = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield consultation_service_1.ConsultationService.getMyAppointments(user, req.query);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Appointments retrieved successfully',
        pagination: result.meta,
        data: result.result,
    });
}));
const updateBookingStatus = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { id } = req.params;
    const result = yield consultation_service_1.ConsultationService.updateBookingStatus(user, id, req.body);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Booking status updated successfully',
        data: result,
    });
}));
const rescheduleBooking = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { id } = req.params;
    const result = yield consultation_service_1.ConsultationService.rescheduleBooking(user, id, req.body);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Booking rescheduled successfully. Waiting for consultant approval.',
        data: result,
    });
}));
const cancelBooking = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { id } = req.params;
    const result = yield consultation_service_1.ConsultationService.cancelBooking(user, id, req.body);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Booking cancelled successfully',
        data: result,
    });
}));
const getConsultantTotalConsultations = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { consultantId } = req.params;
    const result = yield consultation_service_1.ConsultationService.getConsultantTotalConsultations(consultantId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Consultant total consultations retrieved successfully',
        data: result,
    });
}));
const initiateCallback = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { id } = req.params;
    const result = yield consultation_service_1.ConsultationService.initiateCallback(user, id);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Callback initiated successfully',
        data: result,
    });
}));
exports.ConsultationController = {
    setUnavailability,
    getMyUnavailability,
    removeUnavailability,
    getAvailableSlots,
    createBooking,
    getMyBookings,
    getMyAppointments,
    updateBookingStatus,
    rescheduleBooking,
    cancelBooking,
    getConsultantTotalConsultations,
    initiateCallback,
};
