/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
import express from 'express';
import { NextFunction, Request, Response } from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import fileUploadHandler from '../../middlewares/fileUploadHandler';
import validateRequest from '../../middlewares/validateRequest';
import { ReportController } from './report.controller';
import { ReportValidation } from './report.validation';

const router = express.Router();

router
  .route('/')
  .post(
    auth(USER_ROLES.CONSULTANT),
    fileUploadHandler(),
    (req: Request, res: Response, next: NextFunction) => {
      if (req.body.data) {
        req.body = ReportValidation.createReportZodSchema.parse({
          body: JSON.parse(req.body.data),
        }).body;
      }
      return ReportController.createReport(req, res, next);
    },
  )
  .get(
    auth(
      USER_ROLES.USER,
      USER_ROLES.CONSULTANT,
      USER_ROLES.ADMIN,
      USER_ROLES.SUPER_ADMIN,
    ),
    ReportController.getReports,
  );

router.get(
  '/total-consultations',
  auth(USER_ROLES.CONSULTANT),
  ReportController.getTotalConsultations,
);

router
  .route('/ai-summary/:consultationId')
  .get(
    auth(
      USER_ROLES.USER,
      USER_ROLES.CONSULTANT,
      USER_ROLES.ADMIN,
      USER_ROLES.SUPER_ADMIN,
    ),
    ReportController.getAiSummary,
  )
  .post(
    auth(
      USER_ROLES.USER,
      USER_ROLES.CONSULTANT,
      USER_ROLES.ADMIN,
      USER_ROLES.SUPER_ADMIN,
    ),
    ReportController.getAiSummary,
  );

router
  .route('/:id')
  .get(
    auth(
      USER_ROLES.USER,
      USER_ROLES.CONSULTANT,
      USER_ROLES.ADMIN,
      USER_ROLES.SUPER_ADMIN,
    ),
    ReportController.getSingleReport,
  )
  .patch(
    auth(USER_ROLES.CONSULTANT, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
    fileUploadHandler(),
    (req: Request, res: Response, next: NextFunction) => {
      if (req.body.data) {
        req.body = ReportValidation.updateReportZodSchema.parse({
          body:
            typeof req.body.data === 'string'
              ? JSON.parse(req.body.data)
              : req.body.data,
        }).body;
      } else if (req.body && Object.keys(req.body).length > 0) {
        req.body = ReportValidation.updateReportZodSchema.parse({
          body: req.body,
        }).body;
      }
      return ReportController.updateReport(req, res, next);
    },
  );

export const ReportRoutes = router;
