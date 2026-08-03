import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { getSystemMetrics } from '../../utils/system';
import { ChartPeriodMonths } from './admin.interface';
import { AdminService } from './admin.service';

const parseMonths = (value: unknown): ChartPeriodMonths => {
  return value === '6' ? 6 : 12;
};

const parseLimit = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const getDashboardSummary = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.getDashboardSummary();

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Dashboard summary retrieved successfully',
    meta: { comparisonPeriod: '30d' },
    data: result,
  });
});

const getConsultationTrend = catchAsync(async (req: Request, res: Response) => {
  const months = parseMonths(req.query.months);
  const result = await AdminService.getConsultationTrend(months);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Consultation trend retrieved successfully',
    data: result,
  });
});

const getUserGrowth = catchAsync(async (req: Request, res: Response) => {
  const months = parseMonths(req.query.months);
  const result = await AdminService.getUserGrowth(months);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User growth retrieved successfully',
    data: result,
  });
});

const getConsultationStatusDistribution = catchAsync(
  async (req: Request, res: Response) => {
    const months = parseMonths(req.query.months);
    const result =
      await AdminService.getConsultationStatusDistribution(months);

    sendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Consultation status distribution retrieved successfully',
      data: result,
    });
  },
);

const getTopConsultants = catchAsync(async (req: Request, res: Response) => {
  const limit = parseLimit(req.query.limit, 5);
  const result = await AdminService.getTopConsultants(limit);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Top consultants retrieved successfully',
    data: result,
  });
});

const getRecentActivities = catchAsync(async (req: Request, res: Response) => {
  const limit = parseLimit(req.query.limit, 10);
  const result = await AdminService.getRecentActivities(limit);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Recent activities retrieved successfully',
    data: result,
  });
});

const getRecentConsultations = catchAsync(
  async (req: Request, res: Response) => {
    const limit = parseLimit(req.query.limit, 5);
    const result = await AdminService.getRecentConsultations(limit);

    sendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Recent consultations retrieved successfully',
      data: result,
    });
  },
);

const getActiveConsultations = catchAsync(
  async (req: Request, res: Response) => {
    const result = await AdminService.getActiveConsultations();

    sendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Active consultations count retrieved successfully',
      data: result,
    });
  },
);

const getRevenueSummary = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.getRevenueSummary();

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Revenue summary retrieved successfully',
    data: result,
  });
});

const getAllTransactions = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.getAllTransactions(req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Transactions retrieved successfully',
    pagination: result.meta,
    data: result.result,
  });
});

const getRevenueTrend = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.getRevenueTrend();

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Revenue trend retrieved successfully',
    data: result,
  });
});

const getSystemMonitor = catchAsync(async (req: Request, res: Response) => {
  const result = getSystemMetrics();

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'System metrics retrieved successfully',
    data: result,
  });
});

export const AdminController = {
  getDashboardSummary,
  getConsultationTrend,
  getUserGrowth,
  getConsultationStatusDistribution,
  getTopConsultants,
  getRecentActivities,
  getRecentConsultations,
  getActiveConsultations,
  getRevenueSummary,
  getAllTransactions,
  getRevenueTrend,
  getSystemMonitor,
};
