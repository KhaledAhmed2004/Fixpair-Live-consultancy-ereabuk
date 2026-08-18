import { Schema, model } from 'mongoose';
import { IConsultancyType, ConsultancyTypeModel } from './consultancyType.interface';

const consultancyTypeSchema = new Schema<IConsultancyType, ConsultancyTypeModel>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

export const ConsultancyType = model<IConsultancyType, ConsultancyTypeModel>('ConsultancyType', consultancyTypeSchema);
