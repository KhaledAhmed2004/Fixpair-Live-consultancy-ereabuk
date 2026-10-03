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
exports.monitorDB = void 0;
const logger_1 = require("../../shared/logger");
/**
 * Database Performance Monitor
 */
const monitorDB = (operationName, queryFn) => __awaiter(void 0, void 0, void 0, function* () {
    const start = Date.now();
    try {
        const result = yield queryFn();
        const duration = Date.now() - start;
        if (duration > 100) {
            logger_1.logger.warn(`[DB PERF] SLOW: ${operationName} took ${duration}ms`);
        }
        else {
            logger_1.logger.info(`[DB PERF] ${operationName} took ${duration}ms`);
        }
        return result;
    }
    catch (error) {
        logger_1.logger.error(`[DB PERF] ERROR in ${operationName}:`, error);
        throw error;
    }
});
exports.monitorDB = monitorDB;
