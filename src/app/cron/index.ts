/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import cron from 'node-cron';
import { ConsultationService } from '../modules/consultation/consultation.service';
import { NotificationService } from '../modules/notification/notification.service';
import { Consultation } from '../modules/consultation/consultation.model';
import { VideoSession } from '../modules/videoSession/videoSession.model';
import { logger } from '../../shared/logger';

const cronJobs = () => {
  // Run every hour to check for consultation reminders
  cron.schedule('0 * * * *', async () => {
    logger.info('Running cron job: consultationReminders');
    try {
      const now = new Date();
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
      const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // 1. Find consultations starting in approximately 1 hour
      const oneHourReminders = await Consultation.find({
        status: { $in: ['accepted', 'confirmed'] },
        date: {
          $gte: new Date(oneHourLater.getTime() - 30 * 60 * 1000), // window of 30 mins
          $lte: new Date(oneHourLater.getTime() + 30 * 60 * 1000),
        },
        'remindersSent.oneHour': false,
      }).populate('consultant');

      for (const consultation of oneHourReminders) {
        const consultantName = (consultation.consultant as any).name;
        await NotificationService.sendNotification({
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
        consultation.remindersSent!.oneHour = true;
        await consultation.save();
      }

      // 2. Find consultations starting in approximately 24 hours
      const twentyFourHourReminders = await Consultation.find({
        status: { $in: ['accepted', 'confirmed'] },
        date: {
          $gte: new Date(twentyFourHoursLater.getTime() - 30 * 60 * 1000),
          $lte: new Date(twentyFourHoursLater.getTime() + 30 * 60 * 1000),
        },
        'remindersSent.twentyFourHour': false,
      }).populate('consultant');

      for (const consultation of twentyFourHourReminders) {
        const consultantName = (consultation.consultant as any).name;
        await NotificationService.sendNotification({
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
        consultation.remindersSent!.twentyFourHour = true;
        await consultation.save();
      }

      logger.info('Cron job completed: consultationReminders');
    } catch (error) {
      logger.error('Cron job failed: consultationReminders', error);
    }
  });

  // Run every minute to check for expired instant consultations
  cron.schedule('* * * * *', async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      const result = await Consultation.updateMany(
        { 
          bookingType: 'instant', 
          status: 'pending', 
          createdAt: { $lt: fiveMinutesAgo } 
        },
        { $set: { status: 'expired' } }
      );
      
      if (result.modifiedCount > 0) {
        logger.info(`Expired ${result.modifiedCount} pending instant consultations.`);
      }
    } catch (error) {
      logger.error('Cron job failed: expireInstantConsultations', error);
    }
  });

  // Run every 5 minutes: expire scheduled consultations 15 minutes past their start time
  cron.schedule('*/5 * * * *', async () => {
    try {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

      // Find confirmed/accepted consultations where the scheduled time was > 15 minutes ago
      // and no VideoSession exists (i.e., nobody joined)
      const expiredCandidates = await Consultation.find({
        bookingType: 'scheduled',
        status: { $in: ['confirmed', 'accepted'] },
        date: { $lt: fifteenMinutesAgo },
      });

      for (const consultation of expiredCandidates) {
        // Only expire if no session has been created (or no ongoing session exists)
        const session = await VideoSession.findOne({
          consultation: consultation._id,
          status: { $in: ['pending', 'ongoing'] },
        });

        if (!session) {
          await Consultation.findByIdAndUpdate(consultation._id, {
            status: 'expired',
          });
          // Notify both parties
          await NotificationService.sendNotification({
            user: consultation.user.toString(),
            title: 'Consultation Expired',
            message: 'Your scheduled consultation has expired because it was not started within the grace period.',
            type: 'CONSULTATION_EXPIRED',
            relatedBooking: consultation._id.toString(),
          });
          logger.info(`Expired scheduled consultation: ${consultation._id}`);
        }
      }
    } catch (error) {
      logger.error('Cron job failed: expireScheduledConsultations', error);
    }
  });
};

export default cronJobs;
