export type MetricDirection = 'up' | 'down' | 'neutral';

export type IDashboardMetric = {
  value: number;
  changePct: number;
  direction: MetricDirection;
};

export type IConsultantDashboardSummary = {
  upcomingConsultations: IDashboardMetric;
  completedConsultations: IDashboardMetric;
  totalSessions: IDashboardMetric;
  cancelledConsultations: IDashboardMetric;
};

export type TrendDays = 7 | 30;

export type IConsultationDayPoint = {
  date: string;
  label: string;
  upcoming: number;
  completed: number;
  cancelled: number;
};

export type IConsultantConsultationTrend = {
  period: {
    days: TrendDays;
    start: string;
    end: string;
  };
  points: IConsultationDayPoint[];
};

export type IRatingBreakdownItem = {
  stars: number;
  count: number;
  percentage: number;
};

export type IConsultantRatings = {
  totalRatings: number;
  averageRating: number;
  label: string;
  breakdown: IRatingBreakdownItem[];
};

export type IRecentBooking = {
  consultationId: string;
  clientName: string;
  clientImage: string | null;
  scheduledAt: Date;
  status: string;
};

export type IRecentFeedback = {
  id: string;
  clientName: string;
  clientImage: string | null;
  rating: number;
  comment: string;
  createdAt: Date;
};
