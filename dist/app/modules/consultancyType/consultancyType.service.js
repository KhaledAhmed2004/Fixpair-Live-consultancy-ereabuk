"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsultancyTypeService = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const consultancyType_model_1 = require("./consultancyType.model");
const user_1 = require("../../../enums/user");
const createConsultancyType = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield consultancyType_model_1.ConsultancyType.findOne({ name: payload.name });
    if (isExist) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'Consultancy type already exists');
    }
    const result = yield consultancyType_model_1.ConsultancyType.create(payload);
    return result;
});
const getAllConsultancyTypes = () => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield consultancyType_model_1.ConsultancyType.aggregate([
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
                                    { $eq: ['$role', user_1.USER_ROLES.CONSULTANT] },
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
});
const getActiveConsultancyTypes = () => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield consultancyType_model_1.ConsultancyType.aggregate([
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
                                    { $eq: ['$role', user_1.USER_ROLES.CONSULTANT] },
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
});
const updateConsultancyType = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    if (payload.name) {
        const isExist = yield consultancyType_model_1.ConsultancyType.findOne({ name: payload.name, _id: { $ne: id } });
        if (isExist) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'Consultancy type with this name already exists');
        }
    }
    const result = yield consultancyType_model_1.ConsultancyType.findByIdAndUpdate(id, payload, { new: true });
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Consultancy type not found');
    }
    return result;
});
const deleteConsultancyType = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield consultancyType_model_1.ConsultancyType.findByIdAndDelete(id);
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Consultancy type not found');
    }
    return result;
});
exports.ConsultancyTypeService = {
    createConsultancyType,
    getAllConsultancyTypes,
    getActiveConsultancyTypes,
    updateConsultancyType,
    deleteConsultancyType,
};
