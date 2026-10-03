"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerSupportRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const customerSupport_controller_1 = require("./customerSupport.controller");
const customerSupport_validation_1 = require("./customerSupport.validation");
const router = express_1.default.Router();
router.post('/create-update', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(customerSupport_validation_1.CustomerSupportValidation.createOrUpdateCustomerSupportZodSchema), customerSupport_controller_1.CustomerSupportController.createOrUpdateCustomerSupport);
router.get('/', customerSupport_controller_1.CustomerSupportController.getCustomerSupport);
exports.CustomerSupportRoutes = router;
