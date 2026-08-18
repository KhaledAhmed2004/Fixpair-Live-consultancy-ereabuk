import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { ConsultancyTypeService } from './consultancyType.service';

const createConsultancyType = catchAsync(async (req: Request, res: Response) => {
  const result = await ConsultancyTypeService.createConsultancyType(req.body);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Consultancy type created successfully',
    data: result,
  });
});

const getAllConsultancyTypes = catchAsync(async (req: Request, res: Response) => {
  // If admin, they might want to see all. If normal user, maybe only active. 
  // Let's just return all for this endpoint and we can filter on frontend or use a query param.
  // The service separates getActive and getAll. We can check query param `?activeOnly=true`.
  const { activeOnly } = req.query;
  const result = activeOnly === 'true' 
    ? await ConsultancyTypeService.getActiveConsultancyTypes() 
    : await ConsultancyTypeService.getAllConsultancyTypes();

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Consultancy types retrieved successfully',
    data: result,
  });
});

const updateConsultancyType = catchAsync(async (req: Request, res: Response) => {
  const result = await ConsultancyTypeService.updateConsultancyType(req.params.typeId, req.body);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Consultancy type updated successfully',
    data: result,
  });
});

const deleteConsultancyType = catchAsync(async (req: Request, res: Response) => {
  const result = await ConsultancyTypeService.deleteConsultancyType(req.params.typeId);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Consultancy type deleted successfully',
    data: result,
  });
});

export const ConsultancyTypeController = {
  createConsultancyType,
  getAllConsultancyTypes,
  updateConsultancyType,
  deleteConsultancyType,
};
