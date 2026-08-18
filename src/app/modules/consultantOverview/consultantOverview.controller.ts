import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { TrendDays } from './consultantOverview.interface';
import { ConsultantOverviewService } from './consultantOverview.service';

const parseLimit = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const parseDays = (value: unknown): TrendDays => {
  return value === '7' ? 7 : 30;
};

const getDashboardSummary = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const result = await ConsultantOverviewService.getDashboardSummary(user.id);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Consultant dashboard summary retrieved successfully',
    meta: { comparisonPeriod: '30d' },
    data: result,
  });
});

const getConsultationTrend = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const days = parseDays(req.query.days);
  const result = await ConsultantOverviewService.getConsultationTrend(
    user.id,
    days,
  );

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Consultant consultation trend retrieved successfully',
    data: result,
  });
});

const getMyRatings = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const result = await ConsultantOverviewService.getMyRatings(user.id);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Consultant ratings retrieved successfully',
    data: result,
  });
});

const getRecentBookings = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const limit = parseLimit(req.query.limit, 5);
  const result = await ConsultantOverviewService.getRecentBookings(
    user.id,
    limit,
  );

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Recent bookings retrieved successfully',
    data: result,
  });
});

const getRecentFeedback = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const limit = parseLimit(req.query.limit, 5);
  const result = await ConsultantOverviewService.getRecentFeedback(
    user.id,
    limit,
  );

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Recent feedback retrieved successfully',
    data: result,
  });
});

const getMyTransactions = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const result = await ConsultantOverviewService.getMyTransactions(
    user.id,
    req.query,
  );

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Transactions retrieved successfully',
    pagination: result.meta,
    data: result.result,
  });
});

export const ConsultantOverviewController = {
  getDashboardSummary,
  getConsultationTrend,
  getMyRatings,
  getRecentBookings,
  getRecentFeedback,
  getMyTransactions,
};

