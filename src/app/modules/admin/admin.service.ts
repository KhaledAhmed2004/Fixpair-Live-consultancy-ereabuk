/* eslint-disable @typescript-eslint/no-explicit-any */
import { USER_ROLES } from '../../../enums/user';
import QueryBuilder from '../../builder/QueryBuilder';
import { Consultation } from '../consultation/consultation.model';
import { Transaction } from '../payment/payment.model';
import { Review } from '../review/review.model';
import { User } from '../user/user.model';
import { VideoSession } from '../videoSession/videoSession.model';
import {
  ChartPeriodMonths,
  IConsultationStatusDistribution,
  IConsultationTrend,
  IDashboardMetric,
  IDashboardSummary,
  IRecentActivity,
  IRecentConsultation,
  IRevenueSummary,
  ITopConsultant,
  IUserGrowth,
  MetricDirection,
} from './admin.interface';

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const calculateGrowthPercentage = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

const getDirection = (pct: number): MetricDirection => {
  if (pct > 0) return 'up';
  if (pct < 0) return 'down';
  return 'neutral';
};

const toMetric = (current: number, previous: number): IDashboardMetric => {
  const changePct = calculateGrowthPercentage(current, previous);
  return {
    value: current,
    changePct,
    direction: getDirection(changePct),
  };
};

const buildMonthPeriod = (months: ChartPeriodMonths) => {
  const end = new Date();
  const start = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (months - 1), 1, 0, 0, 0, 0),
  );

  const buckets: { key: string; label: string; year: number; month: number }[] =
    [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - i, 1),
    );
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    buckets.push({
      key: `${year}-${String(month).padStart(2, '0')}`,
      label: MONTH_LABELS[month - 1],
      year,
      month,
    });
  }

  return {
    months,
    start,
    end,
    buckets,
    period: {
      months,
      start: start.toISOString(),
      end: end.toISOString(),
    },
  };
};

const resolveScheduledAt = (consultation: {
  date?: Date | null;
  startTime?: string | null;
  createdAt?: Date;
}): Date => {
  if (consultation.date && consultation.startTime) {
    const base = new Date(consultation.date);
    const [hours, minutes] = consultation.startTime.split(':').map(Number);
    if (!Number.isNaN(hours)) {
      base.setUTCHours(hours, Number.isNaN(minutes) ? 0 : minutes, 0, 0);
      return base;
    }
  }
  return consultation.createdAt ? new Date(consultation.createdAt) : new Date();
};

const getDashboardSummary = async (): Promise<IDashboardSummary> => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    previousUsers,
    totalConsultants,
    previousConsultants,
    totalConsultations,
    previousConsultations,
    completedConsultations,
    previousCompleted,
    cancelledConsultations,
    previousCancelled,
    avgRatingResult,
    previousAvgRatingResult,
    totalRevenueResult,
    previousTotalRevenueResult,
  ] = await Promise.all([
    User.countDocuments({ role: USER_ROLES.USER, status: 'active' }),
    User.countDocuments({
      role: USER_ROLES.USER,
      status: 'active',
      createdAt: { $lte: thirtyDaysAgo },
    }),
    User.countDocuments({ role: USER_ROLES.CONSULTANT, status: 'active' }),
    User.countDocuments({
      role: USER_ROLES.CONSULTANT,
      status: 'active',
      createdAt: { $lte: thirtyDaysAgo },
    }),
    Consultation.countDocuments(),
    Consultation.countDocuments({ createdAt: { $lte: thirtyDaysAgo } }),
    Consultation.countDocuments({ status: 'completed' }),
    Consultation.countDocuments({
      status: 'completed',
      createdAt: { $lte: thirtyDaysAgo },
    }),
    Consultation.countDocuments({ status: 'cancelled' }),
    Consultation.countDocuments({
      status: 'cancelled',
      createdAt: { $lte: thirtyDaysAgo },
    }),
    Review.aggregate([
      { $group: { _id: null, averageRating: { $avg: '$rating' } } },
    ]),
    Review.aggregate([
      { $match: { createdAt: { $lte: thirtyDaysAgo } } },
      { $group: { _id: null, averageRating: { $avg: '$rating' } } },
    ]),
    Transaction.aggregate([
      { $match: { status: 'captured' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Transaction.aggregate([
      {
        $match: {
          status: 'captured',
          createdAt: { $lte: thirtyDaysAgo },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  const currentAvg =
    avgRatingResult[0]?.averageRating != null
      ? Number(Number(avgRatingResult[0].averageRating).toFixed(1))
      : 0;
  const previousAvg =
    previousAvgRatingResult[0]?.averageRating != null
      ? Number(Number(previousAvgRatingResult[0].averageRating).toFixed(1))
      : 0;

  const currentRevenue = totalRevenueResult[0]?.total || 0;
  const previousRevenue = previousTotalRevenueResult[0]?.total || 0;

  return {
    totalUsers: toMetric(totalUsers, previousUsers),
    totalConsultants: toMetric(totalConsultants, previousConsultants),
    totalConsultations: toMetric(totalConsultations, previousConsultations),
    completedConsultations: toMetric(completedConsultations, previousCompleted),
    cancelledConsultations: toMetric(cancelledConsultations, previousCancelled),
    averageRating: toMetric(currentAvg, previousAvg),
    totalRevenue: toMetric(currentRevenue, previousRevenue),
  };
};

const getConsultationTrend = async (
  months: ChartPeriodMonths = 12,
): Promise<IConsultationTrend> => {
  const { start, period, buckets } = buildMonthPeriod(months);

  const grouped = await Consultation.aggregate([
    { $match: { createdAt: { $gte: start } } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const countMap = new Map(
    grouped.map(item => [
      `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      item.count as number,
    ]),
  );

  return {
    period,
    points: buckets.map(bucket => ({
      month: bucket.key,
      label: bucket.label,
      count: countMap.get(bucket.key) || 0,
    })),
  };
};

const getUserGrowth = async (
  months: ChartPeriodMonths = 12,
): Promise<IUserGrowth> => {
  const { start, period, buckets } = buildMonthPeriod(months);

  const grouped = await User.aggregate([
    {
      $match: {
        createdAt: { $gte: start },
        role: { $in: [USER_ROLES.USER, USER_ROLES.CONSULTANT] },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          role: '$role',
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const usersMap = new Map<string, number>();
  const consultantsMap = new Map<string, number>();

  grouped.forEach(item => {
    const key = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
    if (item._id.role === USER_ROLES.USER) {
      usersMap.set(key, item.count);
    } else if (item._id.role === USER_ROLES.CONSULTANT) {
      consultantsMap.set(key, item.count);
    }
  });

  return {
    period,
    points: buckets.map(bucket => {
      const users = usersMap.get(bucket.key) || 0;
      const consultants = consultantsMap.get(bucket.key) || 0;
      return {
        month: bucket.key,
        label: bucket.label,
        users,
        consultants,
        total: users + consultants,
      };
    }),
  };
};

const CONSULTATION_STATUSES = [
  'pending',
  'ongoing',
  'accepted',
  'rejected',
  'confirmed',
  'completed',
  'cancelled',
  'expired',
] as const;

const getConsultationStatusDistribution = async (
  months: ChartPeriodMonths = 12,
): Promise<IConsultationStatusDistribution> => {
  const { start, period } = buildMonthPeriod(months);

  const grouped = await Consultation.aggregate([
    { $match: { createdAt: { $gte: start } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const countMap = new Map(
    grouped.map(item => [item._id as string, item.count as number]),
  );

  const total = CONSULTATION_STATUSES.reduce(
    (sum, status) => sum + (countMap.get(status) || 0),
    0,
  );

  const items = CONSULTATION_STATUSES.map(status => {
    const count = countMap.get(status) || 0;
    return {
      status,
      count,
      percentage:
        total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
    };
  }).sort((a, b) => b.count - a.count);

  return { period, total, items };
};

const getTopConsultants = async (limit = 5): Promise<ITopConsultant[]> => {
  const consultants = await User.find({
    role: USER_ROLES.CONSULTANT,
    status: 'active',
  })
    .sort({ totalConsultations: -1, averageRating: -1 })
    .limit(limit)
    .select('name image totalConsultations averageRating')
    .lean();

  const consultantIds = consultants.map(c => c._id);

  const earningsByConsultant = await Transaction.aggregate([
    {
      $match: {
        status: 'captured',
        consultant: { $in: consultantIds },
      },
    },
    {
      $group: {
        _id: '$consultant',
        earnings: { $sum: '$amount' },
      },
    },
  ]);

  const earningsMap = new Map(
    earningsByConsultant.map(item => [
      String(item._id),
      Number(Number(item.earnings).toFixed(2)),
    ]),
  );

  return consultants.map(c => ({
    consultantId: String(c._id),
    name: c.name,
    image: c.image || null,
    totalSessions: c.totalConsultations || 0,
    averageRating: c.averageRating || 0,
    earnings: earningsMap.get(String(c._id)) || 0,
  }));
};

const getRecentActivities = async (limit = 10): Promise<IRecentActivity[]> => {
  const [users, consultants, completed, cancelled, reviews] = await Promise.all(
    [
      User.find({ role: USER_ROLES.USER, status: 'active' })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('name createdAt')
        .lean(),
      User.find({ role: USER_ROLES.CONSULTANT, status: 'active' })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('name createdAt')
        .lean(),
      Consultation.find({ status: 'completed' })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .populate([
          { path: 'user', select: 'name' },
          { path: 'consultant', select: 'name' },
        ])
        .select('user consultant updatedAt')
        .lean(),
      Consultation.find({ status: 'cancelled' })
        .sort({ cancelledAt: -1, updatedAt: -1 })
        .limit(limit)
        .populate([
          { path: 'user', select: 'name' },
          { path: 'consultant', select: 'name' },
        ])
        .select('user consultant cancelledAt updatedAt')
        .lean(),
      Review.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate([
          { path: 'user', select: 'name' },
          { path: 'consultant', select: 'name' },
        ])
        .select('user consultant rating createdAt')
        .lean(),
    ],
  );

  const activities: IRecentActivity[] = [
    ...users.map((user: any) => ({
      id: String(user._id),
      type: 'USER_REGISTERED' as const,
      title: `${user.name} registered as a user`,
      timestamp: user.createdAt as Date,
    })),
    ...consultants.map((consultant: any) => ({
      id: String(consultant._id),
      type: 'CONSULTANT_JOINED' as const,
      title: `${consultant.name} joined as a consultant`,
      timestamp: consultant.createdAt as Date,
    })),
    ...completed.map((c: any) => ({
      id: String(c._id),
      type: 'CONSULTATION_COMPLETED' as const,
      title: `Consultation completed between ${c.user?.name || 'a user'} and ${c.consultant?.name || 'a consultant'}`,
      timestamp: c.updatedAt as Date,
    })),
    ...cancelled.map((c: any) => ({
      id: String(c._id),
      type: 'CONSULTATION_CANCELLED' as const,
      title: `Consultation cancelled between ${c.user?.name || 'a user'} and ${c.consultant?.name || 'a consultant'}`,
      timestamp: (c.cancelledAt || c.updatedAt) as Date,
    })),
    ...reviews.map((r: any) => ({
      id: String(r._id),
      type: 'REVIEW_SUBMITTED' as const,
      title: `${r.user?.name || 'A user'} submitted a review for ${r.consultant?.name || 'a consultant'}`,
      timestamp: r.createdAt as Date,
    })),
  ];

  return activities
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    .slice(0, limit);
};

const getRecentConsultations = async (
  limit = 5,
): Promise<IRecentConsultation[]> => {
  const consultations = await Consultation.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate([
      { path: 'user', select: 'name image' },
      { path: 'consultant', select: 'name image' },
    ])
    .select('user consultant date startTime bookingType status createdAt finalSettledAmount')
    .lean();

  return consultations.map((c: any) => ({
    consultationId: String(c._id),
    consultantName: c.consultant?.name || 'Unknown',
    consultantImage: c.consultant?.image || null,
    patientName: c.user?.name || 'Unknown',
    patientImage: c.user?.image || null,
    scheduledAt: resolveScheduledAt(c),
    bookingType: c.bookingType,
    status: c.status,
    paymentAmount: c.finalSettledAmount || 0,
  }));
};

const getActiveConsultations = async () => {
  const activeSessions = await VideoSession.find({ status: 'ongoing' })
    .populate([
      { path: 'user', select: 'name' },
      { path: 'consultant', select: 'name' },
    ])
    .select('user consultant startedAt');

  const count = activeSessions.length;
  const sessions = activeSessions.map(session => ({
    sessionId: session._id,
    consultantName: (session.consultant as any)?.name,
    userName: (session.user as any)?.name,
    startedAt: session.startedAt,
  }));

  return { count, sessions };
};

const getRevenueSummary = async (): Promise<IRevenueSummary> => {
  const totalRevenueResult = await Transaction.aggregate([
    { $match: { status: 'captured' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const totalLifetimeRevenue = totalRevenueResult[0]?.total || 0;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const currentMonthRevenueResult = await Transaction.aggregate([
    {
      $match: {
        status: 'captured',
        createdAt: { $gte: startOfMonth },
      },
    },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const currentMonthRevenue = currentMonthRevenueResult[0]?.total || 0;

  return {
    totalLifetimeRevenue,
    currentMonthRevenue,
  };
};

const getAllTransactions = async (query: Record<string, unknown>) => {
  const transactionQuery = new QueryBuilder(
    Transaction.find().populate([
      { path: 'user', select: 'name email' },
      { path: 'consultant', select: 'name email' },
      { path: 'consultation' },
    ]),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await transactionQuery.modelQuery;
  const meta = await transactionQuery.getPaginationInfo();

  return {
    meta,
    result,
  };
};

const getRevenueTrend = async () => {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const revenueData = await Transaction.aggregate([
    {
      $match: {
        status: 'captured',
        createdAt: { $gte: twelveMonthsAgo },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        },
        revenue: { $sum: '$amount' },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const trend = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - (11 - i));
    const year = d.getFullYear();
    const month = d.getMonth() + 1;

    const match = revenueData.find(
      item => item._id.year === year && item._id.month === month,
    );

    trend.push({
      month: monthNames[month - 1],
      revenue: match ? match.revenue : 0,
    });
  }

  return trend;
};

export const AdminService = {
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
};
