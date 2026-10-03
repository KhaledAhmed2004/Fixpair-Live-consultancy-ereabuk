"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const payment_controller_1 = require("./payment.controller");
const invoice_controller_1 = require("./invoice.controller");
const payment_validation_1 = require("./payment.validation");
const router = express_1.default.Router();
router.post('/webhook', express_1.default.raw({ type: 'application/json' }), payment_controller_1.PaymentController.handleStripeWebhook);
router.post('/create-customer', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT), payment_controller_1.PaymentController.createStripeCustomer);
router.post('/attach-method', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT), payment_controller_1.PaymentController.attachPaymentMethod);
router.post('/set-default', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT), payment_controller_1.PaymentController.setDefaultPaymentMethod);
router.get('/methods', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT), payment_controller_1.PaymentController.getPaymentMethods);
router.delete('/methods/:paymentMethodId', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT), (0, validateRequest_1.default)(payment_validation_1.PaymentValidation.deletePaymentMethodZodSchema), payment_controller_1.PaymentController.deletePaymentMethod);
router.post('/detach-method', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT), (0, validateRequest_1.default)(payment_validation_1.PaymentValidation.detachPaymentMethodZodSchema), payment_controller_1.PaymentController.deletePaymentMethod);
// Invoice routes
router.get('/invoice/:consultationId', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(payment_validation_1.PaymentValidation.getInvoiceZodSchema), invoice_controller_1.InvoiceController.getInvoiceData);
router.get('/invoice/pdf/:consultationId', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(payment_validation_1.PaymentValidation.getInvoiceZodSchema), invoice_controller_1.InvoiceController.downloadInvoicePDF);
exports.PaymentRoutes = router;
