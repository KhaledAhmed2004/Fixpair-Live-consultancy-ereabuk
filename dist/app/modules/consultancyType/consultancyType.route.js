"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsultancyTypeRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const consultancyType_controller_1 = require("./consultancyType.controller");
const consultancyType_validation_1 = require("./consultancyType.validation");
const router = express_1.default.Router();
router.post('/', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(consultancyType_validation_1.ConsultancyTypeValidation.createConsultancyTypeZodSchema), consultancyType_controller_1.ConsultancyTypeController.createConsultancyType);
router.get('/', 
// Public or let's just make it available for all users/consultants/admins.
// We can omit auth if it's public for guests to see consultant types, or keep it open.
// Usually this is public to filter the consultants on homepage.
consultancyType_controller_1.ConsultancyTypeController.getAllConsultancyTypes);
router.patch('/:typeId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(consultancyType_validation_1.ConsultancyTypeValidation.updateConsultancyTypeZodSchema), consultancyType_controller_1.ConsultancyTypeController.updateConsultancyType);
router.delete('/:typeId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.ADMIN), consultancyType_controller_1.ConsultancyTypeController.deleteConsultancyType);
exports.ConsultancyTypeRoutes = router;
