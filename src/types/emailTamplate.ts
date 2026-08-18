export type ICreateAccount = {
  name: string;
  email: string;
  otp: number;
};

export type IResetPassword = {
  email: string;
  otp: number;
};

export type IReportStatusEmail = {
  email: string;
  decision: 'resolved' | 'dismissed';
  explanation: string;
  serviceName?: string;
  serviceId?: string;
  serviceDetails?: string;
  consultationId?: string;
  consultantName?: string;
  productName?: string;
  productId?: string;
  productDetails?: string;
};

export type IConsultationBookingEmail = {
  userName: string;
  userEmail: string;
  consultantName: string;
  bookingType: string;
  date?: Date | string;
  startTime?: string;
};

export type IConsultationReportEmail = {
  userName: string;
  userEmail: string;
  consultantName: string;
  consultationId: string;
  pdfUrl?: string;
  notes?: string;
};

export type IInvoiceEmail = {
  userName: string;
  userEmail: string;
  consultantName: string;
  invoiceNumber: string;
  totalAmount: number;
  pdfUrl?: string;
};

