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
exports.AdminService = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
const user_1 = require("../../../enums/user");
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const consultation_model_1 = require("../consultation/consultation.model");
const payment_model_1 = require("../payment/payment.model");
const review_model_1 = require("../review/review.model");
const user_model_1 = require("../user/user.model");
const videoSession_model_1 = require("../videoSession/videoSession.model");
const MONTH_LABELS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
];
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
const buildMonthPeriod = (months) => {
    const end = new Date();
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (months - 1), 1, 0, 0, 0, 0));
    const buckets = [];
    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - i, 1));
        const year = d.getUTCFullYear();
        const month = d.getUTCMonth() + 1;
        buckets.push({
            key: `${year}-${String(month).padStart(2, '0')}`,
            label: MONTH_LABELS[month - 1],
            year,
            month,
        });
    }
    return {
        months,
        start,
        end,
        buckets,
        period: {
            months,
            start: start.toISOString(),
            end: end.toISOString(),
        },
    };
};
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
const getDashboardSummary = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (filter = 'all_time') {
    var _a, _b, _c, _d;
    const now = new Date();
    let cpStart;
    const cpEnd = now;
    let ppStart;
    let ppEnd;
    switch (filter) {
        case 'today':
            cpStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            ppStart = new Date(cpStart.getTime() - 24 * 60 * 60 * 1000);
            ppEnd = cpStart;
            break;
        case 'this_week':
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1);
            cpStart = new Date(now.getFullYear(), now.getMonth(), diff);
            cpStart.setHours(0, 0, 0, 0);
            ppStart = new Date(cpStart.getTime() - 7 * 24 * 60 * 60 * 1000);
            ppEnd = cpStart;
            break;
        case 'this_month':
            cpStart = new Date(now.getFullYear(), now.getMonth(), 1);
            ppStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            ppEnd = cpStart;
            break;
        case 'this_year':
            cpStart = new Date(now.getFullYear(), 0, 1);
            ppStart = new Date(now.getFullYear() - 1, 0, 1);
            ppEnd = cpStart;
            break;
        case 'all_time':
        default:
            cpStart = undefined;
            ppStart = undefined;
            ppEnd = undefined;
            break;
    }
    const buildQuery = (baseQuery, start, end) => {
        const query = Object.assign({}, baseQuery);
        if (start || end) {
            query.createdAt = {};
            if (start)
                query.createdAt.$gte = start;
            if (end)
                query.createdAt.$lte = end;
        }
        return query;
    };
    const currentMatch = buildQuery({}, cpStart, cpEnd);
    const previousMatch = buildQuery({}, ppStart, ppEnd);
    const [totalUsers, previousUsers, totalConsultants, previousConsultants, totalConsultations, previousConsultations, completedConsultations, previousCompleted, cancelledConsultations, previousCancelled, avgRatingResult, previousAvgRatingResult, totalRevenueResult, previousTotalRevenueResult,] = yield Promise.all([
        user_model_1.User.countDocuments(buildQuery({ role: user_1.USER_ROLES.USER, status: 'active' }, cpStart, cpEnd)),
        ppEnd ? user_model_1.User.countDocuments(buildQuery({ role: user_1.USER_ROLES.USER, status: 'active' }, ppStart, ppEnd)) : Promise.resolve(0),
        user_model_1.User.countDocuments(buildQuery({ role: user_1.USER_ROLES.CONSULTANT, status: 'active' }, cpStart, cpEnd)),
        ppEnd ? user_model_1.User.countDocuments(buildQuery({ role: user_1.USER_ROLES.CONSULTANT, status: 'active' }, ppStart, ppEnd)) : Promise.resolve(0),
        consultation_model_1.Consultation.countDocuments(buildQuery({}, cpStart, cpEnd)),
        ppEnd ? consultation_model_1.Consultation.countDocuments(buildQuery({}, ppStart, ppEnd)) : Promise.resolve(0),
        consultation_model_1.Consultation.countDocuments(buildQuery({ status: 'completed' }, cpStart, cpEnd)),
        ppEnd ? consultation_model_1.Consultation.countDocuments(buildQuery({ status: 'completed' }, ppStart, ppEnd)) : Promise.resolve(0),
        consultation_model_1.Consultation.countDocuments(buildQuery({ status: 'cancelled' }, cpStart, cpEnd)),
        ppEnd ? consultation_model_1.Consultation.countDocuments(buildQuery({ status: 'cancelled' }, ppStart, ppEnd)) : Promise.resolve(0),
        review_model_1.Review.aggregate([
            ...(Object.keys(currentMatch).length ? [{ $match: currentMatch }] : []),
            { $group: { _id: null, averageRating: { $avg: '$rating' } } },
        ]),
        ppEnd ? review_model_1.Review.aggregate([
            ...(Object.keys(previousMatch).length ? [{ $match: previousMatch }] : []),
            { $group: { _id: null, averageRating: { $avg: '$rating' } } },
        ]) : Promise.resolve([]),
        payment_model_1.Transaction.aggregate([
            { $match: buildQuery({ status: 'captured' }, cpStart, cpEnd) },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        ppEnd ? payment_model_1.Transaction.aggregate([
            { $match: buildQuery({ status: 'captured' }, ppStart, ppEnd) },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]) : Promise.resolve([]),
    ]);
    const currentAvg = ((_a = avgRatingResult[0]) === null || _a === void 0 ? void 0 : _a.averageRating) != null
        ? Number(Number(avgRatingResult[0].averageRating).toFixed(1))
        : 0;
    const previousAvg = ((_b = previousAvgRatingResult[0]) === null || _b === void 0 ? void 0 : _b.averageRating) != null
        ? Number(Number(previousAvgRatingResult[0].averageRating).toFixed(1))
        : 0;
    const currentRevenue = ((_c = totalRevenueResult[0]) === null || _c === void 0 ? void 0 : _c.total) || 0;
    const previousRevenue = ((_d = previousTotalRevenueResult[0]) === null || _d === void 0 ? void 0 : _d.total) || 0;
    return {
        totalUsers: toMetric(totalUsers, previousUsers),
        totalConsultants: toMetric(totalConsultants, previousConsultants),
        totalConsultations: toMetric(totalConsultations, previousConsultations),
        completedConsultations: toMetric(completedConsultations, previousCompleted),
        cancelledConsultations: toMetric(cancelledConsultations, previousCancelled),
        averageRating: toMetric(currentAvg, previousAvg),
        totalRevenue: toMetric(currentRevenue, previousRevenue),
    };
});
const getConsultationTrend = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (months = 12) {
    const { start, period, buckets } = buildMonthPeriod(months);
    const grouped = yield consultation_model_1.Consultation.aggregate([
        { $match: { createdAt: { $gte: start } } },
        {
            $group: {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                },
                count: { $sum: 1 },
            },
        },
    ]);
    const countMap = new Map(grouped.map(item => [
        `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
        item.count,
    ]));
    return {
        period,
        points: buckets.map(bucket => ({
            month: bucket.key,
            label: bucket.label,
            count: countMap.get(bucket.key) || 0,
        })),
    };
});
const getUserGrowth = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (months = 12) {
    const { start, period, buckets } = buildMonthPeriod(months);
    const grouped = yield user_model_1.User.aggregate([
        {
            $match: {
                createdAt: { $gte: start },
                role: { $in: [user_1.USER_ROLES.USER, user_1.USER_ROLES.CONSULTANT] },
            },
        },
        {
            $group: {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    role: '$role',
                },
                count: { $sum: 1 },
            },
        },
    ]);
    const usersMap = new Map();
    const consultantsMap = new Map();
    grouped.forEach(item => {
        const key = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
        if (item._id.role === user_1.USER_ROLES.USER) {
            usersMap.set(key, item.count);
        }
        else if (item._id.role === user_1.USER_ROLES.CONSULTANT) {
            consultantsMap.set(key, item.count);
        }
    });
    return {
        period,
        points: buckets.map(bucket => {
            const users = usersMap.get(bucket.key) || 0;
            const consultants = consultantsMap.get(bucket.key) || 0;
            return {
                month: bucket.key,
                label: bucket.label,
                users,
                consultants,
                total: users + consultants,
            };
        }),
    };
});
const CONSULTATION_STATUSES = [
    'pending',
    'ongoing',
    'accepted',
    'rejected',
    'confirmed',
    'completed',
    'cancelled',
    'expired',
];
const getConsultationStatusDistribution = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (months = 12) {
    const { start, period } = buildMonthPeriod(months);
    const grouped = yield consultation_model_1.Consultation.aggregate([
        { $match: { createdAt: { $gte: start } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(grouped.map(item => [item._id, item.count]));
    const total = CONSULTATION_STATUSES.reduce((sum, status) => sum + (countMap.get(status) || 0), 0);
    const items = CONSULTATION_STATUSES.map(status => {
        const count = countMap.get(status) || 0;
        return {
            status,
            count,
            percentage: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
        };
    }).sort((a, b) => b.count - a.count);
    return { period, total, items };
});
const getTopConsultants = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (limit = 5) {
    const consultants = yield user_model_1.User.find({
        role: user_1.USER_ROLES.CONSULTANT,
        status: 'active',
    })
        .sort({ totalConsultations: -1, averageRating: -1 })
        .limit(limit)
        .select('name image totalConsultations averageRating')
        .lean();
    const consultantIds = consultants.map(c => c._id);
    const earningsByConsultant = yield payment_model_1.Transaction.aggregate([
        {
            $match: {
                status: 'captured',
                consultant: { $in: consultantIds },
            },
        },
        {
            $group: {
                _id: '$consultant',
                earnings: { $sum: '$amount' },
            },
        },
    ]);
    const earningsMap = new Map(earningsByConsultant.map(item => [
        String(item._id),
        Number(Number(item.earnings).toFixed(2)),
    ]));
    return consultants.map(c => ({
        consultantId: String(c._id),
        name: c.name,
        image: c.image || null,
        totalSessions: c.totalConsultations || 0,
        averageRating: c.averageRating || 0,
        earnings: earningsMap.get(String(c._id)) || 0,
    }));
});
const getRecentActivities = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (limit = 10) {
    const [users, consultants, completed, cancelled, reviews] = yield Promise.all([
        user_model_1.User.find({ role: user_1.USER_ROLES.USER, status: 'active' })
            .sort({ createdAt: -1 })
            .limit(limit)
            .select('name createdAt')
            .lean(),
        user_model_1.User.find({ role: user_1.USER_ROLES.CONSULTANT, status: 'active' })
            .sort({ createdAt: -1 })
            .limit(limit)
            .select('name createdAt')
            .lean(),
        consultation_model_1.Consultation.find({ status: 'completed' })
            .sort({ updatedAt: -1 })
            .limit(limit)
            .populate([
            { path: 'user', select: 'name' },
            { path: 'consultant', select: 'name' },
        ])
            .select('user consultant updatedAt')
            .lean(),
        consultation_model_1.Consultation.find({ status: 'cancelled' })
            .sort({ cancelledAt: -1, updatedAt: -1 })
            .limit(limit)
            .populate([
            { path: 'user', select: 'name' },
            { path: 'consultant', select: 'name' },
        ])
            .select('user consultant cancelledAt updatedAt')
            .lean(),
        review_model_1.Review.find()
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate([
            { path: 'user', select: 'name' },
            { path: 'consultant', select: 'name' },
        ])
            .select('user consultant rating createdAt')
            .lean(),
    ]);
    const activities = [
        ...users.map((user) => ({
            id: String(user._id),
            type: 'USER_REGISTERED',
            title: `${user.name} registered as a user`,
            timestamp: user.createdAt,
        })),
        ...consultants.map((consultant) => ({
            id: String(consultant._id),
            type: 'CONSULTANT_JOINED',
            title: `${consultant.name} joined as a consultant`,
            timestamp: consultant.createdAt,
        })),
        ...completed.map((c) => {
            var _a, _b;
            return ({
                id: String(c._id),
                type: 'CONSULTATION_COMPLETED',
                title: `Consultation completed between ${((_a = c.user) === null || _a === void 0 ? void 0 : _a.name) || 'a user'} and ${((_b = c.consultant) === null || _b === void 0 ? void 0 : _b.name) || 'a consultant'}`,
                timestamp: c.updatedAt,
            });
        }),
        ...cancelled.map((c) => {
            var _a, _b;
            return ({
                id: String(c._id),
                type: 'CONSULTATION_CANCELLED',
                title: `Consultation cancelled between ${((_a = c.user) === null || _a === void 0 ? void 0 : _a.name) || 'a user'} and ${((_b = c.consultant) === null || _b === void 0 ? void 0 : _b.name) || 'a consultant'}`,
                timestamp: (c.cancelledAt || c.updatedAt),
            });
        }),
        ...reviews.map((r) => {
            var _a, _b;
            return ({
                id: String(r._id),
                type: 'REVIEW_SUBMITTED',
                title: `${((_a = r.user) === null || _a === void 0 ? void 0 : _a.name) || 'A user'} submitted a review for ${((_b = r.consultant) === null || _b === void 0 ? void 0 : _b.name) || 'a consultant'}`,
                timestamp: r.createdAt,
            });
        }),
    ];
    return activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
});
const getRecentConsultations = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (limit = 5) {
    const consultations = yield consultation_model_1.Consultation.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate([
        { path: 'user', select: 'name image' },
        { path: 'consultant', select: 'name image' },
    ])
        .select('user consultant date startTime bookingType status createdAt finalSettledAmount')
        .lean();
    return consultations.map((c) => {
        var _a, _b, _c, _d;
        return ({
            consultationId: String(c._id),
            consultantName: ((_a = c.consultant) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown',
            consultantImage: ((_b = c.consultant) === null || _b === void 0 ? void 0 : _b.image) || null,
            patientName: ((_c = c.user) === null || _c === void 0 ? void 0 : _c.name) || 'Unknown',
            patientImage: ((_d = c.user) === null || _d === void 0 ? void 0 : _d.image) || null,
            scheduledAt: resolveScheduledAt(c),
            bookingType: c.bookingType,
            status: c.status,
            paymentAmount: c.finalSettledAmount || 0,
        });
    });
});
const getActiveConsultations = () => __awaiter(void 0, void 0, void 0, function* () {
    const activeSessions = yield videoSession_model_1.VideoSession.find({ status: 'ongoing' })
        .populate([
        { path: 'user', select: 'name' },
        { path: 'consultant', select: 'name' },
    ])
        .select('user consultant startedAt');
    const count = activeSessions.length;
    const sessions = activeSessions.map(session => {
        var _a, _b;
        return ({
            sessionId: session._id,
            consultantName: (_a = session.consultant) === null || _a === void 0 ? void 0 : _a.name,
            userName: (_b = session.user) === null || _b === void 0 ? void 0 : _b.name,
            startedAt: session.startedAt,
        });
    });
    return { count, sessions };
});
const getRevenueSummary = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const totalRevenueResult = yield payment_model_1.Transaction.aggregate([
        { $match: { status: 'captured' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalLifetimeRevenue = ((_a = totalRevenueResult[0]) === null || _a === void 0 ? void 0 : _a.total) || 0;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const currentMonthRevenueResult = yield payment_model_1.Transaction.aggregate([
        {
            $match: {
                status: 'captured',
                createdAt: { $gte: startOfMonth },
            },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const currentMonthRevenue = ((_b = currentMonthRevenueResult[0]) === null || _b === void 0 ? void 0 : _b.total) || 0;
    return {
        totalLifetimeRevenue,
        currentMonthRevenue,
    };
});
const getAllTransactions = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const transactionQuery = new QueryBuilder_1.default(payment_model_1.Transaction.find().populate([
        { path: 'user', select: 'name email' },
        { path: 'consultant', select: 'name email' },
        { path: 'consultation' },
    ]), query)
        .filter()
        .sort()
        .paginate()
        .fields();
    const result = yield transactionQuery.modelQuery.lean();
    const meta = yield transactionQuery.getPaginationInfo();
    const consultationIds = result
        .map((tx) => { var _a; return (_a = tx.consultation) === null || _a === void 0 ? void 0 : _a._id; })
        .filter(Boolean);
    const videoSessions = yield videoSession_model_1.VideoSession.find({
        consultation: { $in: consultationIds },
    }).lean();
    const videoSessionMap = new Map();
    videoSessions.forEach((session) => {
        videoSessionMap.set(String(session.consultation), session);
    });
    const mappedResult = result.map((tx) => {
        let billedDuration = 0;
        if (tx.consultation && tx.consultation.perMinuteRate > 0) {
            const consumed = tx.consultation.consumedAmount || 0;
            const fee = tx.consultation.platformFee || 0;
            if (consumed >= fee) {
                billedDuration = Math.round((consumed - fee) / tx.consultation.perMinuteRate);
            }
        }
        const session = tx.consultation ? videoSessionMap.get(String(tx.consultation._id)) : null;
        let actualDuration = 0;
        if (session) {
            actualDuration = session.duration || 0;
        }
        return Object.assign(Object.assign({}, tx), { billedDuration,
            actualDuration });
    });
    return {
        meta,
        result: mappedResult,
    };
});
const getRevenueTrend = () => __awaiter(void 0, void 0, void 0, function* () {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);
    const revenueData = yield payment_model_1.Transaction.aggregate([
        {
            $match: {
                status: 'captured',
                createdAt: { $gte: twelveMonthsAgo },
            },
        },
        {
            $group: {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                },
                revenue: { $sum: '$amount' },
            },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);
    const monthNames = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
    ];
    const trend = [];
    for (let i = 0; i < 12; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() - (11 - i));
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const match = revenueData.find(item => item._id.year === year && item._id.month === month);
        trend.push({
            month: monthNames[month - 1],
            revenue: match ? match.revenue : 0,
        });
    }
    return trend;
});
exports.AdminService = {
    getDashboardSummary,
    getConsultationTrend,
    getUserGrowth,
    getConsultationStatusDistribution,
    getTopConsultants,
    getRecentActivities,
    getRecentConsultations,
    getActiveConsultations,
    getRevenueSummary,
    getAllTransactions,
    getRevenueTrend,
};
