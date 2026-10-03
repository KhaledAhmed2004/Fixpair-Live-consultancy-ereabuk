import { Types } from 'mongoose';

export type IRecommendedProduct = {
  name: string;
  price?: number | string;
  buyLink?: string;
};

export type IAiSummary = {
  overview: string;
  keyPoints: string[];
  actionItems: string[];
  recommendations?: string[];
};

export type IReport = {
  consultation: Types.ObjectId;
  user: Types.ObjectId;
  consultant: Types.ObjectId;
  conversation: string;
  duration?: number;
  summary?: string;
  keyPoints?: string[];
  stepsTaken?: string[];
  recommendedProducts?: IRecommendedProduct[];
  notes?: string;
  images?: string[];
  links?: string[];
  pdfUrl?: string;
  aiSummary?: IAiSummary;
};

