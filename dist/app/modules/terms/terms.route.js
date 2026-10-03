"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TermsRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const terms_controller_1 = require("./terms.controller");
const terms_validation_1 = require("./terms.validation");
const router = express_1.default.Router();
router
    .route('/')
    .post((0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(terms_validation_1.TermsValidation.createTermsZodSchema), terms_controller_1.TermsController.createTerms)
    .get(terms_controller_1.TermsController.getAllTerms);
router
    .route('/:id')
    .get(terms_controller_1.TermsController.getSingleTerms)
    .patch((0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(terms_validation_1.TermsValidation.updateTermsZodSchema), terms_controller_1.TermsController.updateTerms)
    .delete((0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), terms_controller_1.TermsController.deleteTerms);
exports.TermsRoutes = router;
