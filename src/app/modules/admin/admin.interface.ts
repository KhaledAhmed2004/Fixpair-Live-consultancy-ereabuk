export type MetricDirection = 'up' | 'down' | 'neutral';

export type IDashboardMetric = {
  value: number;
  changePct: number;
  direction: MetricDirection;
};

export type IDashboardSummary = {
  totalUsers: IDashboardMetric;
  totalConsultants: IDashboardMetric;
  totalConsultations: IDashboardMetric;
  completedConsultations: IDashboardMetric;
  cancelledConsultations: IDashboardMetric;
  averageRating: IDashboardMetric;
  totalRevenue: IDashboardMetric;
};

export type IRevenueSummary = {
  totalLifetimeRevenue: number;
  currentMonthRevenue: number;
};

export type ChartPeriodMonths = 6 | 12;

export type IChartPeriod = {
  months: ChartPeriodMonths;
  start: string;
  end: string;
};

export type IConsultationTrendPoint = {
  month: string;
  label: string;
  count: number;
};

export type IConsultationTrend = {
  period: IChartPeriod;
  points: IConsultationTrendPoint[];
};

export type IUserGrowthPoint = {
  month: string;
  label: string;
  users: number;
  consultants: number;
  total: number;
};

export type IUserGrowth = {
  period: IChartPeriod;
  points: IUserGrowthPoint[];
};

export type IStatusDistributionItem = {
  status: string;
  count: number;
  percentage: number;
};

export type IConsultationStatusDistribution = {
  period: IChartPeriod;
  total: number;
  items: IStatusDistributionItem[];
};

export type ITopConsultant = {
  consultantId: string;
  name: string;
  image: string | null;
  totalSessions: number;
  averageRating: number;
  earnings: number;
};

export type AdminActivityType =
  | 'USER_REGISTERED'
  | 'CONSULTANT_JOINED'
  | 'CONSULTATION_COMPLETED'
  | 'CONSULTATION_CANCELLED'
  | 'REVIEW_SUBMITTED';

export type IRecentActivity = {
  id: string;
  type: AdminActivityType;
  title: string;
  timestamp: Date;
};

export type IRecentConsultation = {
  consultationId: string;
  consultantName: string;
  consultantImage: string | null;
  patientName: string;
  patientImage: string | null;
  scheduledAt: Date;
  bookingType: string;
  status: string;
  paymentAmount: number;
};
