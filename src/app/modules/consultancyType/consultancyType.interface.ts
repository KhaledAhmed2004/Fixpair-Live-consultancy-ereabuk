import { Model } from 'mongoose';

export type IConsultancyType = {
  name: string;
  status: 'active' | 'inactive';
};

export type ConsultancyTypeModel = Model<IConsultancyType, Record<string, unknown>>;
