import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { IConsultancyType } from './consultancyType.interface';
import { ConsultancyType } from './consultancyType.model';
import { USER_ROLES } from '../../../enums/user';

const createConsultancyType = async (payload: IConsultancyType) => {
  const isExist = await ConsultancyType.findOne({ name: payload.name });
  if (isExist) {
    throw new ApiError(StatusCodes.CONFLICT, 'Consultancy type already exists');
  }
  const result = await ConsultancyType.create(payload);
  return result;
};

const getAllConsultancyTypes = async () => {
  const result = await ConsultancyType.aggregate([
    {
      $lookup: {
        from: 'users',
        let: { typeId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$consultancyType', '$$typeId'] },
                  { $eq: ['$role', USER_ROLES.CONSULTANT] },
                ]
              }
            }
          }
        ],
        as: 'consultants',
      }
    },
    {
      $addFields: {
        consultantCount: { $size: '$consultants' }
      }
    },
    {
      $project: {
        consultants: 0
      }
    },
    {
      $sort: { createdAt: -1 }
    }
  ]);
  return result;
};

const getActiveConsultancyTypes = async () => {
  const result = await ConsultancyType.aggregate([
    {
      $match: { status: 'active' }
    },
    {
      $lookup: {
        from: 'users',
        let: { typeId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$consultancyType', '$$typeId'] },
                  { $eq: ['$role', USER_ROLES.CONSULTANT] },
                ]
              }
            }
          }
        ],
        as: 'consultants',
      }
    },
    {
      $addFields: {
        consultantCount: { $size: '$consultants' }
      }
    },
    {
      $project: {
        consultants: 0
      }
    },
    {
      $sort: { createdAt: -1 }
    }
  ]);
  return result;
};

const updateConsultancyType = async (id: string, payload: Partial<IConsultancyType>) => {
  if (payload.name) {
    const isExist = await ConsultancyType.findOne({ name: payload.name, _id: { $ne: id } });
    if (isExist) {
      throw new ApiError(StatusCodes.CONFLICT, 'Consultancy type with this name already exists');
    }
  }
  const result = await ConsultancyType.findByIdAndUpdate(id, payload, { new: true });
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Consultancy type not found');
  }
  return result;
};

const deleteConsultancyType = async (id: string) => {
  const result = await ConsultancyType.findByIdAndDelete(id);
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Consultancy type not found');
  }
  return result;
};

export const ConsultancyTypeService = {
  createConsultancyType,
  getAllConsultancyTypes,
  getActiveConsultancyTypes,
  updateConsultancyType,
  deleteConsultancyType,
};
