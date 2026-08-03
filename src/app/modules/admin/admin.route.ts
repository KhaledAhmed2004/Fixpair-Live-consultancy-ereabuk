import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { AdminController } from './admin.controller';
import { AdminValidation } from './admin.validation';

const router = express.Router();

router.get(
  '/dashboard-summary',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AdminController.getDashboardSummary,
);

router.get(
  '/consultation-trend',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(AdminValidation.monthsQueryZodSchema),
  AdminController.getConsultationTrend,
);

router.get(
  '/user-growth',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(AdminValidation.monthsQueryZodSchema),
  AdminController.getUserGrowth,
);

router.get(
  '/consultation-status-distribution',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(AdminValidation.monthsQueryZodSchema),
  AdminController.getConsultationStatusDistribution,
);

router.get(
  '/top-consultants',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(AdminValidation.topConsultantsQueryZodSchema),
  AdminController.getTopConsultants,
);

router.get(
  '/recent-activities',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(AdminValidation.recentActivitiesQueryZodSchema),
  AdminController.getRecentActivities,
);

router.get(
  '/recent-consultations',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(AdminValidation.recentConsultationsQueryZodSchema),
  AdminController.getRecentConsultations,
);

router.get(
  '/active-consultations',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AdminController.getActiveConsultations,
);

router.get(
  '/revenue-summary',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AdminController.getRevenueSummary,
);

router.get(
  '/transactions',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AdminController.getAllTransactions,
);

router.get(
  '/revenue-trend',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AdminController.getRevenueTrend,
);

router.get(
  '/monitor',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AdminController.getSystemMonitor,
);

export const AdminRoutes = router;
