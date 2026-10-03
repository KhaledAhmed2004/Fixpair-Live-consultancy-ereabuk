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
exports.PayPalService = void 0;
const checkout_server_sdk_1 = __importDefault(require("@paypal/checkout-server-sdk"));
const config_1 = __importDefault(require("../../../config"));
/**
 * PayPal SDK Configuration
 */
const environment = config_1.default.payment.paypal.environment === 'live'
    ? new checkout_server_sdk_1.default.core.LiveEnvironment(config_1.default.payment.paypal.clientId, config_1.default.payment.paypal.clientSecret)
    : new checkout_server_sdk_1.default.core.SandboxEnvironment(config_1.default.payment.paypal.clientId, config_1.default.payment.paypal.clientSecret);
const client = new checkout_server_sdk_1.default.core.PayPalHttpClient(environment);
/**
 * PayPal Service
 * Handles authorization and capture flows
 */
const authorizePayment = (amount, consultationId) => __awaiter(void 0, void 0, void 0, function* () {
    const request = new checkout_server_sdk_1.default.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
        intent: 'AUTHORIZE',
        purchase_units: [
            {
                reference_id: consultationId,
                amount: {
                    currency_code: 'USD',
                    value: amount.toFixed(2),
                },
            },
        ],
    });
    const order = yield client.execute(request);
    return order.result;
});
const capturePayment = (authorizationId, amount) => __awaiter(void 0, void 0, void 0, function* () {
    const request = new checkout_server_sdk_1.default.payments.AuthorizationsCaptureRequest(authorizationId);
    request.requestBody({
        amount: {
            currency_code: 'USD',
            value: amount.toFixed(2),
        },
        final_capture: true,
        invoice_id: `INV-${Date.now()}`,
        note_to_payer: 'Consultation payment',
        soft_descriptor: 'FixPair',
    });
    const response = yield client.execute(request);
    return response.result;
});
const voidAuthorization = (authorizationId) => __awaiter(void 0, void 0, void 0, function* () {
    const request = new checkout_server_sdk_1.default.payments.AuthorizationsVoidRequest(authorizationId);
    const response = yield client.execute(request);
    return response.result;
});
exports.PayPalService = {
    authorizePayment,
    capturePayment,
    voidAuthorization,
    client,
};
