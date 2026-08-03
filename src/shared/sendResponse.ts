import { Response } from 'express';

type IData<T> = {
  success: boolean;
  statusCode: number;
  message?: string;
  meta?: Record<string, unknown>;
  pagination?: {
    page: number;
    limit: number;
    totalPage: number;
    total: number;
  };
  data?: T;
};

const sendResponse = <T>(res: Response, data: IData<T>) => {
  const resData: Record<string, unknown> = {
    success: data.success,
    message: data.message,
    data: data.data,
  };

  if (data.meta) {
    resData.meta = data.meta;
  }

  if (data.pagination) {
    resData.pagination = data.pagination;
  }

  res.status(data.statusCode).json(resData);
};

export default sendResponse;
