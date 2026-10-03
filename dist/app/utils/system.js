"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSystemMetrics = void 0;
const os_1 = __importDefault(require("os"));
const cache_1 = require("./cache");
/**
 * System Monitoring Utility
 */
const getSystemMetrics = () => {
    const freeMem = os_1.default.freemem();
    const totalMem = os_1.default.totalmem();
    const usedMem = totalMem - freeMem;
    const memUsage = (usedMem / totalMem) * 100;
    const cpus = os_1.default.cpus();
    const loadAvg = os_1.default.loadavg();
    const processMetrics = {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        uptime: process.uptime(),
    };
    return {
        os: {
            platform: os_1.default.platform(),
            release: os_1.default.release(),
            uptime: os_1.default.uptime(),
            loadAvg,
            memory: {
                total: `${(totalMem / 1024 / 1024 / 1024).toFixed(2)} GB`,
                free: `${(freeMem / 1024 / 1024 / 1024).toFixed(2)} GB`,
                used: `${(usedMem / 1024 / 1024 / 1024).toFixed(2)} GB`,
                usage: `${memUsage.toFixed(2)}%`,
            },
            cpus: cpus.length,
        },
        process: {
            pid: process.pid,
            uptime: `${processMetrics.uptime.toFixed(2)}s`,
            memory: {
                rss: `${(processMetrics.memory.rss / 1024 / 1024).toFixed(2)} MB`,
                heapTotal: `${(processMetrics.memory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
                heapUsed: `${(processMetrics.memory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
            },
        },
        cache: cache_1.cacheHelper.getStats(),
    };
};
exports.getSystemMetrics = getSystemMetrics;
