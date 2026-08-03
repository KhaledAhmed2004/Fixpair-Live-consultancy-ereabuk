/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from 'mongoose';
import { Consultation } from '../consultation/consultation.model';
import { Review } from '../review/review.model';
import {
  IConsultantConsultationTrend,
  IConsultantDashboardSummary,
  IConsultantRatings,
  IDashboardMetric,
  IRecentBooking,
  IRecentFeedback,
  MetricDirection,
  TrendDays,
} from './consultantOverview.interface';

const UPCOMING_STATUSES = ['pending', 'accepted', 'confirmed', 'ongoing'];

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

const toObjectId = (consultantId: string) =>
  new mongoose.Types.ObjectId(consultantId);

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

const getDashboardSummary = async (
  consultantId: string,
): Promise<IConsultantDashboardSummary> => {
  const consultant = toObjectId(consultantId);
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    upcoming,
    previousUpcoming,
    completed,
    previousCompleted,
    totalSessions,
    previousTotalSessions,
    cancelled,
    previousCancelled,
  ] = await Promise.all([
    Consultation.countDocuments({
      consultant,
      status: { $in: UPCOMING_STATUSES },
    }),
    Consultation.countDocuments({
      consultant,
      status: { $in: UPCOMING_STATUSES },
      createdAt: { $lte: thirtyDaysAgo },
    }),
    Consultation.countDocuments({ consultant, status: 'completed' }),
    Consultation.countDocuments({
      consultant,
      status: 'completed',
      createdAt: { $lte: thirtyDaysAgo },
    }),
    Consultation.countDocuments({ consultant }),
    Consultation.countDocuments({
      consultant,
      createdAt: { $lte: thirtyDaysAgo },
    }),
    Consultation.countDocuments({ consultant, status: 'cancelled' }),
    Consultation.countDocuments({
      consultant,
      status: 'cancelled',
      createdAt: { $lte: thirtyDaysAgo },
    }),
  ]);

  return {
    upcomingConsultations: toMetric(upcoming, previousUpcoming),
    completedConsultations: toMetric(completed, previousCompleted),
    totalSessions: toMetric(totalSessions, previousTotalSessions),
    cancelledConsultations: toMetric(cancelled, previousCancelled),
  };
};

const getConsultationTrend = async (
  consultantId: string,
  days: TrendDays = 30,
): Promise<IConsultantConsultationTrend> => {
  const consultant = toObjectId(consultantId);
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  start.setUTCHours(0, 0, 0, 0);

  const grouped = await Consultation.aggregate([
    {
      $match: {
        consultant,
        createdAt: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: {
          date: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          status: '$status',
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const dayMap = new Map<
    string,
    { upcoming: number; completed: number; cancelled: number }
  >();

  grouped.forEach(item => {
    const key = item._id.date as string;
    const status = item._id.status as string;
    const current = dayMap.get(key) || {
      upcoming: 0,
      completed: 0,
      cancelled: 0,
    };

    if (UPCOMING_STATUSES.includes(status)) {
      current.upcoming += item.count as number;
    } else if (status === 'completed') {
      current.completed += item.count as number;
    } else if (status === 'cancelled') {
      current.cancelled += item.count as number;
    }

    dayMap.set(key, current);
  });

  const points = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    const counts = dayMap.get(key) || {
      upcoming: 0,
      completed: 0,
      cancelled: 0,
    };

    points.push({
      date: key,
      label: `${d.getUTCDate()} ${d.toLocaleString('en-US', {
        month: 'short',
        timeZone: 'UTC',
      })}`,
      upcoming: counts.upcoming,
      completed: counts.completed,
      cancelled: counts.cancelled,
    });
  }

  return {
    period: {
      days,
      start: start.toISOString(),
      end: end.toISOString(),
    },
    points,
  };
};

const RATING_LABELS: Record<number, string> = {
  5: 'Excellent',
  4: 'Good',
  3: 'Average',
  2: 'Poor',
  1: 'Terrible',
};

const getAverageRatingLabel = (averageRating: number): string => {
  if (averageRating <= 0) return 'No ratings';
  const rounded = Math.round(averageRating);
  return RATING_LABELS[rounded] || 'Average';
};

const getMyRatings = async (
  consultantId: string,
): Promise<IConsultantRatings> => {
  const consultant = toObjectId(consultantId);

  const [summary, grouped] = await Promise.all([
    Review.aggregate([
      { $match: { consultant } },
      {
        $group: {
          _id: null,
          totalRatings: { $sum: 1 },
          averageRating: { $avg: '$rating' },
        },
      },
    ]),
    Review.aggregate([
      { $match: { consultant } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]),
  ]);

  const totalRatings = summary[0]?.totalRatings || 0;
  const averageRating =
    summary[0]?.averageRating != null
      ? Number(Number(summary[0].averageRating).toFixed(1))
      : 0;

  const countMap = new Map(
    grouped.map(item => [item._id as number, item.count as number]),
  );

  const breakdown = [5, 4, 3, 2, 1].map(stars => {
    const count = countMap.get(stars) || 0;
    return {
      stars,
      count,
      percentage:
        totalRatings > 0
          ? Number(((count / totalRatings) * 100).toFixed(1))
          : 0,
    };
  });

  return {
    totalRatings,
    averageRating,
    label: getAverageRatingLabel(averageRating),
    breakdown,
  };
};

const getRecentBookings = async (
  consultantId: string,
  limit = 5,
): Promise<IRecentBooking[]> => {
  const consultations = await Consultation.find({
    consultant: toObjectId(consultantId),
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate({ path: 'user', select: 'name image' })
    .select('user date startTime status createdAt')
    .lean();

  return consultations.map((c: any) => ({
    consultationId: String(c._id),
    clientName: c.user?.name || 'Unknown',
    clientImage: c.user?.image || null,
    scheduledAt: resolveScheduledAt(c),
    status: c.status,
  }));
};

const getRecentFeedback = async (
  consultantId: string,
  limit = 5,
): Promise<IRecentFeedback[]> => {
  const reviews = await Review.find({
    consultant: toObjectId(consultantId),
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate({ path: 'user', select: 'name image' })
    .select('user rating comment createdAt')
    .lean();

  return reviews.map((r: any) => ({
    id: String(r._id),
    clientName: r.user?.name || 'Unknown',
    clientImage: r.user?.image || null,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt,
  }));
};

export const ConsultantOverviewService = {
  getDashboardSummary,
  getConsultationTrend,
  getMyRatings,
  getRecentBookings,
  getRecentFeedback,
};
