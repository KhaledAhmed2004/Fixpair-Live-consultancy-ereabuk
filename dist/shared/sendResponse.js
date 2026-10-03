"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sendResponse = (res, data) => {
    const resData = {
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
exports.default = sendResponse;
