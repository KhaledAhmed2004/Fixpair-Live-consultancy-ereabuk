"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportRoutes = void 0;
/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const fileUploadHandler_1 = __importDefault(require("../../middlewares/fileUploadHandler"));
const report_controller_1 = require("./report.controller");
const report_validation_1 = require("./report.validation");
const router = express_1.default.Router();
router
    .route('/')
    .post((0, auth_1.default)(user_1.USER_ROLES.CONSULTANT), (0, fileUploadHandler_1.default)(), (req, res, next) => {
    if (req.body.data) {
        req.body = report_validation_1.ReportValidation.createReportZodSchema.parse({
            body: JSON.parse(req.body.data),
        }).body;
    }
    return report_controller_1.ReportController.createReport(req, res, next);
})
    .get((0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), report_controller_1.ReportController.getReports);
router.get('/total-consultations', (0, auth_1.default)(user_1.USER_ROLES.CONSULTANT), report_controller_1.ReportController.getTotalConsultations);
router
    .route('/ai-summary/:consultationId')
    .get((0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), report_controller_1.ReportController.getAiSummary)
    .post((0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), report_controller_1.ReportController.getAiSummary);
router
    .route('/:id')
    .get((0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), report_controller_1.ReportController.getSingleReport)
    .patch((0, auth_1.default)(user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, fileUploadHandler_1.default)(), (req, res, next) => {
    if (req.body.data) {
        req.body = report_validation_1.ReportValidation.updateReportZodSchema.parse({
            body: typeof req.body.data === 'string'
                ? JSON.parse(req.body.data)
                : req.body.data,
        }).body;
    }
    else if (req.body && Object.keys(req.body).length > 0) {
        req.body = report_validation_1.ReportValidation.updateReportZodSchema.parse({
            body: req.body,
        }).body;
    }
    return report_controller_1.ReportController.updateReport(req, res, next);
});
exports.ReportRoutes = router;
