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
exports.PaymentController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const stripe_service_1 = require("./stripe.service");
const user_model_1 = require("../user/user.model");
const payment_model_1 = require("./payment.model");
const consultation_model_1 = require("../consultation/consultation.model");
const billing_service_1 = require("./billing.service");
const notification_service_1 = require("../notification/notification.service");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const config_1 = __importDefault(require("../../../config"));
const logger_1 = require("../../../shared/logger");
const createStripeCustomer = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const userData = yield user_model_1.User.findById(user.id);
    if (!userData)
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
    if (userData.stripeCustomerId) {
        return (0, sendResponse_1.default)(res, {
            success: true,
            statusCode: http_status_codes_1.StatusCodes.OK,
            message: 'Customer already exists',
            data: { stripeCustomerId: userData.stripeCustomerId },
        });
    }
    const customer = yield stripe_service_1.StripeService.createCustomer(userData.email, userData.name);
    userData.stripeCustomerId = customer.id;
    yield userData.save();
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        message: 'Stripe customer created successfully',
        data: { stripeCustomerId: customer.id },
    });
}));
const attachPaymentMethod = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const user = req.user;
    const { paymentMethodId } = req.body;
    const userData = yield user_model_1.User.findById(user.id);
    if (!userData) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
    }
    let stripeCustomerId = userData.stripeCustomerId;
    if (!stripeCustomerId) {
        const customer = yield stripe_service_1.StripeService.createCustomer(userData.email, userData.name);
        stripeCustomerId = customer.id;
        userData.stripeCustomerId = stripeCustomerId;
        yield userData.save();
    }
    // Check if this payment method is already in our DB for this user
    const existingMethod = (_a = userData.paymentMethods) === null || _a === void 0 ? void 0 : _a.find(m => m.methodId === paymentMethodId);
    try {
        // 1. Retrieve the payment method to check its status
        const method = yield stripe_service_1.StripeService.stripe.paymentMethods.retrieve(paymentMethodId);
        // 2. If it's not already attached to this customer, attach it
        if (method.customer !== stripeCustomerId) {
            yield stripe_service_1.StripeService.attachPaymentMethod(stripeCustomerId, paymentMethodId);
        }
        // 3. Update our database if it doesn't exist yet
        if (!existingMethod) {
            const methodData = {
                provider: 'stripe',
                methodId: paymentMethodId,
                last4: (_b = method.card) === null || _b === void 0 ? void 0 : _b.last4,
                brand: (_c = method.card) === null || _c === void 0 ? void 0 : _c.brand,
                isDefault: (((_d = userData.paymentMethods) === null || _d === void 0 ? void 0 : _d.length) || 0) === 0,
            };
            yield user_model_1.User.findByIdAndUpdate(user.id, {
                $push: { paymentMethods: methodData },
            });
            return (0, sendResponse_1.default)(res, {
                success: true,
                statusCode: http_status_codes_1.StatusCodes.OK,
                message: 'Payment method attached successfully',
                data: methodData,
            });
        }
        (0, sendResponse_1.default)(res, {
            success: true,
            statusCode: http_status_codes_1.StatusCodes.OK,
            message: 'Payment method already attached',
            data: existingMethod,
        });
    }
    catch (error) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Stripe Error: ${error.message}`);
    }
}));
const setDefaultPaymentMethod = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const user = req.user;
    const { paymentMethodId } = req.body;
    if (!paymentMethodId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'paymentMethodId is required');
    }
    const userData = yield user_model_1.User.findById(user.id);
    if (!userData)
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
    const methodExists = (_a = userData.paymentMethods) === null || _a === void 0 ? void 0 : _a.some(m => m.methodId === paymentMethodId);
    if (!methodExists) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Payment method not found');
    }
    (_b = userData.paymentMethods) === null || _b === void 0 ? void 0 : _b.forEach(m => {
        m.isDefault = m.methodId === paymentMethodId;
    });
    yield userData.save();
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Default payment method updated successfully',
        data: userData.paymentMethods,
    });
}));
const getPaymentMethods = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const userData = yield user_model_1.User.findById(user.id);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Payment methods retrieved successfully',
        data: (userData === null || userData === void 0 ? void 0 : userData.paymentMethods) || [],
    });
}));
const deletePaymentMethod = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const user = req.user;
    const paymentMethodId = req.params.paymentMethodId || req.body.paymentMethodId;
    if (!paymentMethodId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'paymentMethodId is required');
    }
    const userData = yield user_model_1.User.findById(user.id);
    if (!userData) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
    }
    const targetIndex = (_a = userData.paymentMethods) === null || _a === void 0 ? void 0 : _a.findIndex(m => m.methodId === paymentMethodId);
    if (targetIndex === undefined || targetIndex === -1) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Payment method not found');
    }
    // Check if there is an active ongoing consultation billing
    const activeConsultation = yield consultation_model_1.Consultation.findOne({
        user: user.id,
        billingStatus: { $in: ['authorized', 'active'] },
        status: { $in: ['in-progress', 'active'] },
    });
    if (activeConsultation) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Cannot remove payment method while a consultation is actively in progress');
    }
    const targetMethod = userData.paymentMethods[targetIndex];
    // If Stripe provider, detach from Stripe
    if (targetMethod.provider === 'stripe') {
        try {
            yield stripe_service_1.StripeService.detachPaymentMethod(paymentMethodId);
        }
        catch (error) {
            logger_1.logger.warn(`Stripe detach warning for ${paymentMethodId}: ${error.message}`);
        }
    }
    const wasDefault = targetMethod.isDefault;
    userData.paymentMethods.splice(targetIndex, 1);
    // If removed method was default and other methods remain, designate the first one as default
    if (wasDefault && userData.paymentMethods.length > 0) {
        userData.paymentMethods[0].isDefault = true;
        if (userData.stripeCustomerId &&
            userData.paymentMethods[0].provider === 'stripe') {
            try {
                yield stripe_service_1.StripeService.stripe.customers.update(userData.stripeCustomerId, {
                    invoice_settings: {
                        default_payment_method: userData.paymentMethods[0].methodId,
                    },
                });
            }
            catch (error) {
                logger_1.logger.warn(`Failed to update default payment method in Stripe for customer ${userData.stripeCustomerId}: ${error.message}`);
            }
        }
    }
    yield userData.save();
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Payment method removed successfully',
        data: userData.paymentMethods || [],
    });
}));
const handleStripeWebhook = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = config_1.default.payment.stripe.webhookSecret;
    let event;
    try {
        event = stripe_service_1.StripeService.stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    }
    catch (err) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Webhook Error: ${err.message}`);
    }
    // Handle specific events
    switch (event.type) {
        case 'payment_intent.succeeded': {
            const intent = event.data.object;
            const consultationId = intent.metadata.consultationId;
            // Find the transaction first to check current status
            let existingTransaction = yield payment_model_1.Transaction.findOne({
                transactionId: intent.id,
            });
            // If it doesn't exist (e.g. manual payment from Stripe Dashboard), create it
            if (!existingTransaction) {
                const userId = intent.metadata.userId;
                if (!userId) {
                    logger_1.logger.warn(`Webhook received for intent ${intent.id} without userId in metadata`);
                    break;
                }
                existingTransaction = yield payment_model_1.Transaction.create({
                    consultation: consultationId,
                    user: userId,
                    transactionId: intent.id,
                    amount: intent.amount / 100,
                    provider: 'stripe',
                    status: 'pending',
                    type: 'charge',
                });
            }
            // If transaction is not already captured, mark it as captured
            if (existingTransaction.status !== 'captured') {
                existingTransaction.status = 'captured';
                yield existingTransaction.save();
            }
            // Send notification using idempotencyKey to prevent duplicates.
            // We send this here as a fallback/confirmation. If billing.service already sent it, 
            // the NotificationService will block this duplicate.
            yield notification_service_1.NotificationService.sendNotification({
                user: existingTransaction.user.toString(),
                title: 'Payment Successful',
                message: `Your payment of $${(intent.amount / 100).toFixed(2)} has been completed successfully.`,
                type: 'PAYMENT_SUCCESS',
                relatedBooking: consultationId,
                idempotencyKey: `payment_success_${intent.id}`,
                metadata: {
                    amount: intent.amount / 100,
                    status: 'captured',
                    transactionId: intent.id,
                },
            });
            break;
        }
        case 'payment_intent.payment_failed': {
            const intent = event.data.object;
            const consultationId = intent.metadata.consultationId;
            if (consultationId) {
                // Trigger auto-end if an ongoing billing charge fails
                yield billing_service_1.BillingService.stopBilling(consultationId);
                yield consultation_model_1.Consultation.findByIdAndUpdate(consultationId, {
                    billingStatus: 'failed',
                    status: 'cancelled',
                });
            }
            break;
        }
    }
    res.json({ received: true });
}));
exports.PaymentController = {
    createStripeCustomer,
    attachPaymentMethod,
    setDefaultPaymentMethod,
    getPaymentMethods,
    deletePaymentMethod,
    handleStripeWebhook,
};
