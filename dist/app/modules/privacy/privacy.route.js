"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrivacyRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const privacy_controller_1 = require("./privacy.controller");
const privacy_validation_1 = require("./privacy.validation");
const router = express_1.default.Router();
router
    .route('/')
    .post((0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(privacy_validation_1.PrivacyValidation.createPrivacyZodSchema), privacy_controller_1.PrivacyController.createPrivacy)
    .get(privacy_controller_1.PrivacyController.getAllPrivacies);
router
    .route('/:id')
    .get(privacy_controller_1.PrivacyController.getSinglePrivacy)
    .patch((0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(privacy_validation_1.PrivacyValidation.updatePrivacyZodSchema), privacy_controller_1.PrivacyController.updatePrivacy)
    .delete((0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), privacy_controller_1.PrivacyController.deletePrivacy);
exports.PrivacyRoutes = router;
