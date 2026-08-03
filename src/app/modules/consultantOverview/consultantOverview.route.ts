import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { ConsultantOverviewController } from './consultantOverview.controller';
import { ConsultantOverviewValidation } from './consultantOverview.validation';

const router = express.Router();

router.get(
  '/dashboard-summary',
  auth(USER_ROLES.CONSULTANT),
  ConsultantOverviewController.getDashboardSummary,
);

router.get(
  '/consultation-trend',
  auth(USER_ROLES.CONSULTANT),
  validateRequest(ConsultantOverviewValidation.daysQueryZodSchema),
  ConsultantOverviewController.getConsultationTrend,
);

router.get(
  '/my-ratings',
  auth(USER_ROLES.CONSULTANT),
  ConsultantOverviewController.getMyRatings,
);

router.get(
  '/recent-bookings',
  auth(USER_ROLES.CONSULTANT),
  validateRequest(ConsultantOverviewValidation.recentLimitQueryZodSchema),
  ConsultantOverviewController.getRecentBookings,
);

router.get(
  '/recent-feedback',
  auth(USER_ROLES.CONSULTANT),
  validateRequest(ConsultantOverviewValidation.recentLimitQueryZodSchema),
  ConsultantOverviewController.getRecentFeedback,
);

export const ConsultantOverviewRoutes = router;
