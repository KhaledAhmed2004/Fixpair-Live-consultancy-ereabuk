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
/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
const node_cron_1 = __importDefault(require("node-cron"));
const notification_service_1 = require("../modules/notification/notification.service");
const consultation_model_1 = require("../modules/consultation/consultation.model");
const videoSession_model_1 = require("../modules/videoSession/videoSession.model");
const logger_1 = require("../../shared/logger");
const cronJobs = () => {
    // Run every hour to check for consultation reminders
    node_cron_1.default.schedule('0 * * * *', () => __awaiter(void 0, void 0, void 0, function* () {
        logger_1.logger.info('Running cron job: consultationReminders');
        try {
            const now = new Date();
            const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
            const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            // 1. Find consultations starting in approximately 1 hour
            const oneHourReminders = yield consultation_model_1.Consultation.find({
                status: { $in: ['accepted', 'confirmed'] },
                date: {
                    $gte: new Date(oneHourLater.getTime() - 30 * 60 * 1000), // window of 30 mins
                    $lte: new Date(oneHourLater.getTime() + 30 * 60 * 1000),
                },
                'remindersSent.oneHour': false,
            }).populate('consultant');
            for (const consultation of oneHourReminders) {
                const consultantName = consultation.consultant.name;
                yield notification_service_1.NotificationService.sendNotification({
                    user: consultation.user.toString(),
                    title: 'Consultation Reminder',
                    message: `Reminder: Your consultation with ${consultantName} starts in 1 hour.`,
                    type: 'CONSULTATION_REMINDER',
                    relatedBooking: consultation._id.toString(),
                    metadata: {
                        consultantName,
                        reminderType: '1_hour_reminder',
                        startTime: consultation.startTime,
                    },
                });
                consultation.remindersSent.oneHour = true;
                yield consultation.save();
            }
            // 2. Find consultations starting in approximately 24 hours
            const twentyFourHourReminders = yield consultation_model_1.Consultation.find({
                status: { $in: ['accepted', 'confirmed'] },
                date: {
                    $gte: new Date(twentyFourHoursLater.getTime() - 30 * 60 * 1000),
                    $lte: new Date(twentyFourHoursLater.getTime() + 30 * 60 * 1000),
                },
                'remindersSent.twentyFourHour': false,
            }).populate('consultant');
            for (const consultation of twentyFourHourReminders) {
                const consultantName = consultation.consultant.name;
                yield notification_service_1.NotificationService.sendNotification({
                    user: consultation.user.toString(),
                    title: 'Consultation Reminder',
                    message: `Reminder: Your consultation with ${consultantName} starts in 24 hours.`,
                    type: 'CONSULTATION_REMINDER',
                    relatedBooking: consultation._id.toString(),
                    metadata: {
                        consultantName,
                        reminderType: '24_hour_reminder',
                        startTime: consultation.startTime,
                    },
                });
                consultation.remindersSent.twentyFourHour = true;
                yield consultation.save();
            }
            logger_1.logger.info('Cron job completed: consultationReminders');
        }
        catch (error) {
            logger_1.logger.error('Cron job failed: consultationReminders', error);
        }
    }));
    // Run every minute to check for expired instant consultations (older than 1 minute)
    node_cron_1.default.schedule('* * * * *', () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
            const staleConsultations = yield consultation_model_1.Consultation.find({
                bookingType: 'instant',
                status: 'pending',
                createdAt: { $lt: oneMinuteAgo },
            });
            if (staleConsultations.length > 0) {
                const staleIds = staleConsultations.map((c) => c._id);
                const result = yield consultation_model_1.Consultation.updateMany({ _id: { $in: staleIds } }, { $set: { status: 'expired' } });
                yield videoSession_model_1.VideoSession.updateMany({ consultation: { $in: staleIds }, status: 'pending' }, { $set: { status: 'cancelled' } });
                if (result.modifiedCount > 0) {
                    logger_1.logger.info(`Expired ${result.modifiedCount} pending instant consultations.`);
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Cron job failed: expireInstantConsultations', error);
        }
    }));
    // Run every 5 minutes: expire scheduled consultations 15 minutes past their start time
    node_cron_1.default.schedule('*/5 * * * *', () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
            // Find confirmed/accepted consultations where the scheduled time was > 15 minutes ago
            // and no VideoSession exists (i.e., nobody joined)
            const expiredCandidates = yield consultation_model_1.Consultation.find({
                bookingType: 'scheduled',
                status: { $in: ['confirmed', 'accepted'] },
                date: { $lt: fifteenMinutesAgo },
            });
            for (const consultation of expiredCandidates) {
                // Only expire if no session has been created (or no ongoing session exists)
                const session = yield videoSession_model_1.VideoSession.findOne({
                    consultation: consultation._id,
                    status: { $in: ['pending', 'ongoing'] },
                });
                if (!session) {
                    yield consultation_model_1.Consultation.findByIdAndUpdate(consultation._id, {
                        status: 'expired',
                    });
                    // Notify both parties
                    yield notification_service_1.NotificationService.sendNotification({
                        user: consultation.user.toString(),
                        title: 'Consultation Expired',
                        message: 'Your scheduled consultation has expired because it was not started within the grace period.',
                        type: 'CONSULTATION_EXPIRED',
                        relatedBooking: consultation._id.toString(),
                    });
                    logger_1.logger.info(`Expired scheduled consultation: ${consultation._id}`);
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Cron job failed: expireScheduledConsultations', error);
        }
    }));
};
exports.default = cronJobs;
