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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerSupportService = void 0;
const customerSupport_model_1 = require("./customerSupport.model");
const createOrUpdateCustomerSupportToDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    // Since there should typically only be one support contact entry
    const isExist = yield customerSupport_model_1.CustomerSupport.findOne();
    if (isExist) {
        const result = yield customerSupport_model_1.CustomerSupport.findOneAndUpdate({}, payload, {
            new: true,
            runValidators: true,
        });
        return result;
    }
    const result = yield customerSupport_model_1.CustomerSupport.create(payload);
    return result;
});
const getCustomerSupportFromDB = () => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield customerSupport_model_1.CustomerSupport.findOne();
    return result;
});
exports.CustomerSupportService = {
    createOrUpdateCustomerSupportToDB,
    getCustomerSupportFromDB,
};
