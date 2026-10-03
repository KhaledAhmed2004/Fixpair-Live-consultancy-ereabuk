"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const fileUploadHandler_1 = __importDefault(require("../../middlewares/fileUploadHandler"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const user_controller_1 = require("./user.controller");
const user_validation_1 = require("./user.validation");
const router = express_1.default.Router();
router
    .route('/profile')
    .get((0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT), user_controller_1.UserController.getUserProfile)
    .patch((0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT), (0, fileUploadHandler_1.default)(), (req, res, next) => {
    if (req.body.data) {
        req.body = user_validation_1.UserValidation.updateUserZodSchema.parse(JSON.parse(req.body.data));
    }
    return user_controller_1.UserController.updateProfile(req, res, next);
})
    .delete((0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT), user_controller_1.UserController.deleteAccount);
router
    .route('/')
    .get((0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT), user_controller_1.UserController.getAllUsers)
    .post((0, fileUploadHandler_1.default)(), (req, res, next) => {
    if (req.body.data) {
        try {
            req.body = JSON.parse(req.body.data);
        }
        catch (error) {
            return next(error);
        }
    }
    next();
}, (0, validateRequest_1.default)(user_validation_1.UserValidation.createUserZodSchema), user_controller_1.UserController.createUser);
router.get('/consultants', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT), user_controller_1.UserController.getConsultants);
router.post('/device-token', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT), (0, validateRequest_1.default)(user_validation_1.UserValidation.deviceTokenZodSchema), user_controller_1.UserController.updateDeviceToken);
router.patch('/toggle-status', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT), user_controller_1.UserController.toggleStatus);
router.get('/:userId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT), user_controller_1.UserController.getSingleUser);
router.patch('/:userId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.ADMIN), (0, fileUploadHandler_1.default)(), (req, res, next) => {
    if (req.body.data) {
        req.body = user_validation_1.UserValidation.updateUserZodSchema.parse(JSON.parse(req.body.data));
    }
    return user_controller_1.UserController.updateUser(req, res, next);
});
router.delete('/:userId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.ADMIN), user_controller_1.UserController.deleteUser);
exports.UserRoutes = router;
