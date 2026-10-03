"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsultationRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const consultation_controller_1 = require("./consultation.controller");
const consultation_validation_1 = require("./consultation.validation");
const transcription_controller_1 = require("../transcription/transcription.controller");
const router = express_1.default.Router();
// Transcription sub-routes
router.post('/transcription/start', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN), transcription_controller_1.TranscriptionController.startTranscription);
router.post('/:consultationId/transcription/start', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN), transcription_controller_1.TranscriptionController.startTranscription);
router.post('/transcription/stop', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN), transcription_controller_1.TranscriptionController.stopTranscription);
router.post('/:consultationId/transcription/stop', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN), transcription_controller_1.TranscriptionController.stopTranscription);
router.get('/transcription/history', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN), transcription_controller_1.TranscriptionController.getTranscriptHistory);
router.get('/:consultationId/transcription/history', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN), transcription_controller_1.TranscriptionController.getTranscriptHistory);
// Consultant: Manage unavailable slots
router.post('/unavailability', (0, auth_1.default)(user_1.USER_ROLES.CONSULTANT), (0, validateRequest_1.default)(consultation_validation_1.ConsultationValidation.setUnavailabilityZodSchema), consultation_controller_1.ConsultationController.setUnavailability);
router.get('/unavailability', (0, auth_1.default)(user_1.USER_ROLES.CONSULTANT), consultation_controller_1.ConsultationController.getMyUnavailability);
router.delete('/unavailability/:slotId', (0, auth_1.default)(user_1.USER_ROLES.CONSULTANT), consultation_controller_1.ConsultationController.removeUnavailability);
router.delete('/unavailability', (0, auth_1.default)(user_1.USER_ROLES.CONSULTANT), consultation_controller_1.ConsultationController.removeUnavailability);
// User: View unavailable and booked slots for a consultant
router.get('/available-slots/:consultantId', (0, validateRequest_1.default)(consultation_validation_1.ConsultationValidation.getAvailableSlotsZodSchema), consultation_controller_1.ConsultationController.getAvailableSlots);
// User: Book a consultation
router.post('/book', (0, auth_1.default)(user_1.USER_ROLES.USER), (0, validateRequest_1.default)(consultation_validation_1.ConsultationValidation.createBookingZodSchema), consultation_controller_1.ConsultationController.createBooking);
// User/Consultant: View their bookings
router.get('/my-bookings', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), consultation_controller_1.ConsultationController.getMyBookings);
// User/Consultant: View their appointments (scheduled & callback requests)
router.get('/my-appointments', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(consultation_validation_1.ConsultationValidation.getMyAppointmentsZodSchema), consultation_controller_1.ConsultationController.getMyAppointments);
// Consultant/Admin: Update booking status
router.patch('/status/:id', (0, auth_1.default)(user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(consultation_validation_1.ConsultationValidation.updateBookingStatusZodSchema), consultation_controller_1.ConsultationController.updateBookingStatus);
// Consultant: Initiate a callback
router.post('/initiate-callback/:id', (0, auth_1.default)(user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN), consultation_controller_1.ConsultationController.initiateCallback);
// User: Reschedule a booking
router.patch('/reschedule/:id', (0, auth_1.default)(user_1.USER_ROLES.USER), (0, validateRequest_1.default)(consultation_validation_1.ConsultationValidation.rescheduleBookingZodSchema), consultation_controller_1.ConsultationController.rescheduleBooking);
// User: Cancel a booking
router.patch('/cancel/:id', (0, auth_1.default)(user_1.USER_ROLES.USER), (0, validateRequest_1.default)(consultation_validation_1.ConsultationValidation.cancelBookingZodSchema), consultation_controller_1.ConsultationController.cancelBooking);
// Get total completed consultations for a specific consultant
router.get('/consultants/:consultantId/total-consultations', consultation_controller_1.ConsultationController.getConsultantTotalConsultations);
exports.ConsultationRoutes = router;
