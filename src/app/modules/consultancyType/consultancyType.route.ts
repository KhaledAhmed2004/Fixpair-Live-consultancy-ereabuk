import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { ConsultancyTypeController } from './consultancyType.controller';
import { ConsultancyTypeValidation } from './consultancyType.validation';

const router = express.Router();

router.post(
  '/',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  validateRequest(ConsultancyTypeValidation.createConsultancyTypeZodSchema),
  ConsultancyTypeController.createConsultancyType,
);

router.get(
  '/',
  // Public or let's just make it available for all users/consultants/admins.
  // We can omit auth if it's public for guests to see consultant types, or keep it open.
  // Usually this is public to filter the consultants on homepage.
  ConsultancyTypeController.getAllConsultancyTypes,
);

router.patch(
  '/:typeId',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  validateRequest(ConsultancyTypeValidation.updateConsultancyTypeZodSchema),
  ConsultancyTypeController.updateConsultancyType,
);

router.delete(
  '/:typeId',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  ConsultancyTypeController.deleteConsultancyType,
);

export const ConsultancyTypeRoutes = router;
