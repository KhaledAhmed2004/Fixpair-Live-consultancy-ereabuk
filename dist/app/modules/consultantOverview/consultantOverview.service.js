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
exports.ConsultantOverviewService = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
const mongoose_1 = __importDefault(require("mongoose"));
const consultation_model_1 = require("../consultation/consultation.model");
const payment_model_1 = require("../payment/payment.model");
const review_model_1 = require("../review/review.model");
const UPCOMING_STATUSES = ['pending', 'accepted', 'confirmed', 'ongoing'];
const calculateGrowthPercentage = (current, previous) => {
    if (previous === 0)
        return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
};
const getDirection = (pct) => {
    if (pct > 0)
        return 'up';
    if (pct < 0)
        return 'down';
    return 'neutral';
};
const toMetric = (current, previous) => {
    const changePct = calculateGrowthPercentage(current, previous);
    return {
        value: current,
        changePct,
        direction: getDirection(changePct),
    };
};
const toObjectId = (consultantId) => new mongoose_1.default.Types.ObjectId(consultantId);
const resolveScheduledAt = (consultation) => {
    if (consultation.date && consultation.startTime) {
        const base = new Date(consultation.date);
        const [hours, minutes] = consultation.startTime.split(':').map(Number);
        if (!Number.isNaN(hours)) {
            base.setHours(hours, Number.isNaN(minutes) ? 0 : minutes, 0, 0);
            return base;
        }
    }
    return consultation.createdAt ? new Date(consultation.createdAt) : new Date();
};
const getDashboardSummary = (consultantId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const consultant = toObjectId(consultantId);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [upcoming, previousUpcoming, completed, previousCompleted, totalSessions, previousTotalSessions, cancelled, previousCancelled, earningsResult, previousEarningsResult,] = yield Promise.all([
        consultation_model_1.Consultation.countDocuments({
            consultant,
            status: { $in: UPCOMING_STATUSES },
        }),
        consultation_model_1.Consultation.countDocuments({
            consultant,
            status: { $in: UPCOMING_STATUSES },
            createdAt: { $lte: thirtyDaysAgo },
        }),
        consultation_model_1.Consultation.countDocuments({ consultant, status: 'completed' }),
        consultation_model_1.Consultation.countDocuments({
            consultant,
            status: 'completed',
            createdAt: { $lte: thirtyDaysAgo },
        }),
        consultation_model_1.Consultation.countDocuments({ consultant }),
        consultation_model_1.Consultation.countDocuments({
            consultant,
            createdAt: { $lte: thirtyDaysAgo },
        }),
        consultation_model_1.Consultation.countDocuments({ consultant, status: 'cancelled' }),
        consultation_model_1.Consultation.countDocuments({
            consultant,
            status: 'cancelled',
            createdAt: { $lte: thirtyDaysAgo },
        }),
        payment_model_1.Transaction.aggregate([
            { $match: { consultant, status: 'captured' } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        payment_model_1.Transaction.aggregate([
            {
                $match: {
                    consultant,
                    status: 'captured',
                    createdAt: { $lte: thirtyDaysAgo },
                },
            },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
    ]);
    const earnings = ((_a = earningsResult[0]) === null || _a === void 0 ? void 0 : _a.total) || 0;
    const previousEarnings = ((_b = previousEarningsResult[0]) === null || _b === void 0 ? void 0 : _b.total) || 0;
    return {
        upcomingConsultations: toMetric(upcoming, previousUpcoming),
        completedConsultations: toMetric(completed, previousCompleted),
        totalSessions: toMetric(totalSessions, previousTotalSessions),
        cancelledConsultations: toMetric(cancelled, previousCancelled),
        totalEarnings: toMetric(earnings, previousEarnings),
    };
});
const getConsultationTrend = (consultantId_1, ...args_1) => __awaiter(void 0, [consultantId_1, ...args_1], void 0, function* (consultantId, days = 30) {
    const consultant = toObjectId(consultantId);
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    start.setUTCHours(0, 0, 0, 0);
    const grouped = yield consultation_model_1.Consultation.aggregate([
        {
            $match: {
                consultant,
                createdAt: { $gte: start, $lte: end },
            },
        },
        {
            $group: {
                _id: {
                    date: {
                        $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                    },
                    status: '$status',
                },
                count: { $sum: 1 },
            },
        },
    ]);
    const dayMap = new Map();
    grouped.forEach(item => {
        const key = item._id.date;
        const status = item._id.status;
        const current = dayMap.get(key) || {
            upcoming: 0,
            completed: 0,
            cancelled: 0,
        };
        if (UPCOMING_STATUSES.includes(status)) {
            current.upcoming += item.count;
        }
        else if (status === 'completed') {
            current.completed += item.count;
        }
        else if (status === 'cancelled') {
            current.cancelled += item.count;
        }
        dayMap.set(key, current);
    });
    const points = [];
    for (let i = 0; i < days; i++) {
        const d = new Date(start);
        d.setUTCDate(start.getUTCDate() + i);
        const key = d.toISOString().slice(0, 10);
        const counts = dayMap.get(key) || {
            upcoming: 0,
            completed: 0,
            cancelled: 0,
        };
        points.push({
            date: key,
            label: `${d.getUTCDate()} ${d.toLocaleString('en-US', {
                month: 'short',
                timeZone: 'UTC',
            })}`,
            upcoming: counts.upcoming,
            completed: counts.completed,
            cancelled: counts.cancelled,
        });
    }
    return {
        period: {
            days,
            start: start.toISOString(),
            end: end.toISOString(),
        },
        points,
    };
});
const RATING_LABELS = {
    5: 'Excellent',
    4: 'Good',
    3: 'Average',
    2: 'Poor',
    1: 'Terrible',
};
const getAverageRatingLabel = (averageRating) => {
    if (averageRating <= 0)
        return 'No ratings';
    const rounded = Math.round(averageRating);
    return RATING_LABELS[rounded] || 'Average';
};
const getMyRatings = (consultantId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const consultant = toObjectId(consultantId);
    const [summary, grouped] = yield Promise.all([
        review_model_1.Review.aggregate([
            { $match: { consultant } },
            {
                $group: {
                    _id: null,
                    totalRatings: { $sum: 1 },
                    averageRating: { $avg: '$rating' },
                },
            },
        ]),
        review_model_1.Review.aggregate([
            { $match: { consultant } },
            { $group: { _id: '$rating', count: { $sum: 1 } } },
        ]),
    ]);
    const totalRatings = ((_a = summary[0]) === null || _a === void 0 ? void 0 : _a.totalRatings) || 0;
    const averageRating = ((_b = summary[0]) === null || _b === void 0 ? void 0 : _b.averageRating) != null
        ? Number(Number(summary[0].averageRating).toFixed(1))
        : 0;
    const countMap = new Map(grouped.map(item => [item._id, item.count]));
    const breakdown = [5, 4, 3, 2, 1].map(stars => {
        const count = countMap.get(stars) || 0;
        return {
            stars,
            count,
            percentage: totalRatings > 0
                ? Number(((count / totalRatings) * 100).toFixed(1))
                : 0,
        };
    });
    return {
        totalRatings,
        averageRating,
        label: getAverageRatingLabel(averageRating),
        breakdown,
    };
});
const getRecentBookings = (consultantId_1, ...args_1) => __awaiter(void 0, [consultantId_1, ...args_1], void 0, function* (consultantId, limit = 5) {
    const consultations = yield consultation_model_1.Consultation.find({
        consultant: toObjectId(consultantId),
    })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate({ path: 'user', select: 'name image' })
        .select('user date startTime status createdAt')
        .lean();
    return consultations.map((c) => {
        var _a, _b;
        return ({
            consultationId: String(c._id),
            clientName: ((_a = c.user) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown',
            clientImage: ((_b = c.user) === null || _b === void 0 ? void 0 : _b.image) || null,
            scheduledAt: resolveScheduledAt(c),
            status: c.status,
        });
    });
});
const getRecentFeedback = (consultantId_1, ...args_1) => __awaiter(void 0, [consultantId_1, ...args_1], void 0, function* (consultantId, limit = 5) {
    const reviews = yield review_model_1.Review.find({
        consultant: toObjectId(consultantId),
    })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate({ path: 'user', select: 'name image' })
        .select('user rating comment createdAt')
        .lean();
    return reviews.map((r) => {
        var _a, _b;
        return ({
            id: String(r._id),
            clientName: ((_a = r.user) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown',
            clientImage: ((_b = r.user) === null || _b === void 0 ? void 0 : _b.image) || null,
            rating: r.rating,
            comment: r.comment,
            createdAt: r.createdAt,
        });
    });
});
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const getMyTransactions = (consultantId, query) => __awaiter(void 0, void 0, void 0, function* () {
    const transactionQuery = new QueryBuilder_1.default(payment_model_1.Transaction.find({ consultant: toObjectId(consultantId) }).populate([
        { path: 'user', select: 'name image' },
        { path: 'consultation' },
    ]), query)
        .filter()
        .sort()
        .paginate()
        .fields();
    const result = yield transactionQuery.modelQuery;
    const meta = yield transactionQuery.getPaginationInfo();
    return {
        meta,
        result,
    };
});
exports.ConsultantOverviewService = {
    getDashboardSummary,
    getConsultationTrend,
    getMyRatings,
    getRecentBookings,
    getRecentFeedback,
    getMyTransactions,
};
