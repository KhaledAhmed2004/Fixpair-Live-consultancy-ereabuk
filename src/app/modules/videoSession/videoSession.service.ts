/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
/* eslint-disable no-undef */
import { StatusCodes } from 'http-status-codes';
import QueryBuilder from '../../builder/QueryBuilder';
import { JwtPayload } from 'jsonwebtoken';
import mongoose from 'mongoose';
import { RtcTokenBuilder, RtcRole } from 'agora-token';
import config from '../../../config';
import ApiError from '../../../errors/ApiError';
import { Consultation } from '../consultation/consultation.model';
import { VideoSession } from './videoSession.model';
import { IVideoSession } from './videoSession.interface';
import { generateAgoraToken } from '../../../helpers/agoraTokenHelper';
import { NotificationService } from '../notification/notification.service';

const createSession = async (user: JwtPayload, consultationId: string) => {
  const consultation = await Consultation.findById(consultationId);
  if (!consultation) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Consultation not found');
  }



  // Verify that the user is part of the consultation
  if (
    consultation.user.toString() !== user.id &&
    consultation.consultant.toString() !== user.id
  ) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'You are not part of this consultation',
    );
  }

  const ALLOWED_STATUSES = ['pending', 'confirmed', 'accepted'];
  if (!ALLOWED_STATUSES.includes(consultation.status)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Cannot create a video session for a consultation with status: ${consultation.status}`,
    );
  }

  // Check if a session already exists for this consultation
  const existingSession = await VideoSession.findOne({
    consultation: consultationId,
  });
  if (existingSession) {
    if (existingSession.status === 'ended') {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'This consultation session has already ended',
      );
    }
    return existingSession;
  }

  const channelName = `consultation_${consultationId}`;
  // User UID: 1001, Consultant UID: 2001 as per requirement
  const uid = user.role === 'USER' ? 1001 : 2001;
  const token = generateAgoraToken(channelName, uid);

  const sessionData: Partial<IVideoSession> = {
    consultation: new mongoose.Types.ObjectId(consultationId),
    user: consultation.user,
    consultant: consultation.consultant,
    channelName,
    token,
    status: 'pending',
  };

  const result = await VideoSession.create(sessionData);

  // --- Real-time Signaling ---
  const recipientId =
    user.role === 'USER'
      ? consultation.consultant.toString()
      : consultation.user.toString();

  const recipient = await User.findById(recipientId);
  if (!recipient) return { ...result.toObject(), uid };

  // Fetch consultant details for the FCM payload
  const consultantDetails = await User.findById(consultation.consultant);
  const consultantName = consultantDetails?.name || 'Consultant';
  
  let consultantAvatar = consultantDetails?.image || consultantDetails?.avatar || '';
  if (consultantAvatar && !consultantAvatar.startsWith('http')) {
    // Convert relative path to full URL
    const baseUrl = process.env.BASE_URL || 'https://nayem5000.binarybards.online';
    consultantAvatar = `${baseUrl}${consultantAvatar.startsWith('/') ? '' : '/'}${consultantAvatar}`;
  }

  // Generate a token specifically for the recipient
  const recipientUid = recipient.role === 'USER' ? 1001 : 2001;
  const recipientToken = generateAgoraToken(channelName, recipientUid);

  const signalingData = {
    sessionId: result._id.toString(),
    callerName: user.name || 'A user',
    callerAvatar: user.image || user.avatar || '',
    appId: config.agora.appId,
    token: recipientToken, // Send the recipient's specific token
    channelName: result.channelName,
    bookingId: consultationId,
    consultantName: consultantName,
    consultantAvatar: consultantAvatar,
  };

  if (recipient.role === 'CONSULTANT') {
    // Case 1: Recipient is Web Consultant (Socket)
    socketHelper.emitToUser(recipientId, 'incoming-call', {
      ...signalingData,
      uid: 2001,
    });
  } else if (recipient.role === 'USER') {
    // Case 2: Recipient is Mobile Client (FCM)
    if (recipient.fcmTokens && recipient.fcmTokens.length > 0) {
      await NotificationHelper.sendPushNotification(recipient.fcmTokens, {
        type: 'INCOMING_CALL',
        ...signalingData,
        uid: '1001', // FCM data must be strings
      }).catch(err => console.error('FCM Error in session creation:', err));
    }
  }

  return { ...result.toObject(), uid };
};

import { BillingService } from '../payment/billing.service';
import { InvoiceService } from '../payment/invoice.service';
import { NotificationHelper } from '../../../helpers/notification/notificationHelper';
import { socketHelper } from '../../../helpers/socketHelper';
import { User } from '../user/user.model';
import { TranscriptionService } from '../transcription/transcription.service';

const joinSession = async (user: JwtPayload, sessionId: string) => {
  const session = await VideoSession.findById(sessionId);
  if (!session) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Video session not found');
  }

  if (session.status === 'ended') {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'This session has already ended',
    );
  }

  const consultation = await Consultation.findById(session.consultation);


  // Verify that the user is part of the session
  if (
    session.user.toString() !== user.id &&
    session.consultant.toString() !== user.id
  ) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'You are not part of this session',
    );
  }

  const uid = user.role === 'USER' ? 1001 : 2001;

  if (session.status === 'pending') {
    // Atomic update to prevent race conditions when both users join simultaneously
    const updatedSession = await VideoSession.findOneAndUpdate(
      { _id: sessionId, status: 'pending' },
      { status: 'ongoing', startedAt: new Date() },
      { new: true },
    );

    if (updatedSession) {
      // 1. Trigger billing first (this includes the 5-minute pre-auth check)
      try {
        await BillingService.startBilling(session.consultation.toString());
        await mongoose.model('Consultation').updateOne(
          { _id: session.consultation },
          { status: 'ongoing' }
        );
      } catch (error) {
        // If billing fails, revert status so it can be retried
        await VideoSession.updateOne({ _id: sessionId }, { status: 'pending', startedAt: null });
        throw error;
      }

      // 2. Start Transcription
      TranscriptionService.startTranscription(session.consultation.toString())
        .catch(async (sttError) => {
          console.error('STT startup failed:', sttError);
          await VideoSession.findByIdAndUpdate(sessionId, {
            $set: { transcriptionStatus: 'failed' },
          });
          socketHelper.emitToUser(user.id, 'transcription-failed', {
            sessionId,
            consultationId: session.consultation.toString(),
            message: 'Transcription could not be started. Billing continues normally.',
          });
        });
    }
  }

  // Generate a fresh token for this specific user/UID
  const token = generateAgoraToken(session.channelName, uid);

  const freshSession = await VideoSession.findById(sessionId);

  return {
    ...freshSession!.toObject(),
    token, // Return the fresh token instead of the one in DB
    uid,
    appId: config.agora.appId,
  };
};

const endSession = async (user: JwtPayload, sessionId: string) => {
  const session = await VideoSession.findById(sessionId);
  if (!session) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Video session not found');
  }

  if (session.status === 'ended') {
    return await VideoSession.findById(sessionId);
  }

  // Verify that the user is part of the session
  if (
    session.user.toString() !== user.id &&
    session.consultant.toString() !== user.id
  ) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'You are not authorized to end this session',
    );
  }

  const endedAt = new Date();
  const duration = session.startedAt
    ? Math.floor((endedAt.getTime() - session.startedAt.getTime()) / 1000)
    : 0;

  await VideoSession.findByIdAndUpdate(sessionId, {
    status: 'ended',
    endedAt,
    duration,
    transcriptionStatus: 'stopping',
  });

  // Stop transcription
  try {
    await TranscriptionService.stopTranscription(session.consultation.toString());
  } catch (err) {
    console.error('Failed to stop transcription:', err);
  }

  // Stop billing and generate invoice
  await BillingService.stopBilling(session.consultation.toString());
  await InvoiceService.finalizeInvoice(session.consultation.toString());

  const updatedConsultation = await Consultation.findById(session.consultation).populate('user consultant');
  
  if (updatedConsultation) {
    const client = (updatedConsultation.user as any)?.name || 'Client';
    const consultant = (updatedConsultation.consultant as any)?.name || 'Consultant';
    const finalAmount = updatedConsultation.consumedAmount || 0;
    
    let finalDurationMins = 0;
    if (updatedConsultation.perMinuteRate > 0) {
      const fee = updatedConsultation.platformFee || 0;
      if (finalAmount >= fee) {
        finalDurationMins = Math.round((finalAmount - fee) / updatedConsultation.perMinuteRate);
      }
    } else {
      finalDurationMins = Math.max(1, Math.round(duration / 60)); // minimum 1 min if fallback
    }

    await NotificationService.notifyAdmins({
      title: 'Consultation Completed',
      message: `Session ended between ${client} and ${consultant}. Duration: ${finalDurationMins} mins, Amount Generated: $${finalAmount}.`,
      type: 'CONSULTATION_STATUS',
      relatedBooking: updatedConsultation._id.toString(),
      metadata: {
        clientName: client,
        consultantName: consultant,
        durationMinutes: finalDurationMins,
        amount: finalAmount,
      }
    });
  }

  return await VideoSession.findById(sessionId);
};

const getMySessions = async (user: JwtPayload, query: Record<string, unknown>) => {
  const filter: any = {};
  if (user.role === 'USER') {
    filter.user = user.id;
  } else if (user.role === 'CONSULTANT') {
    filter.consultant = user.id;
  }

  const sessionQuery = new QueryBuilder(VideoSession.find(filter), query)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await sessionQuery.modelQuery.populate([
    { path: 'user', select: 'name image avatar' },
    { path: 'consultant', select: 'name image avatar' },
    { path: 'consultation' },
  ]);

  const meta = await sessionQuery.getPaginationInfo();

  return { meta, result };
};

const handleCallAction = async (
  user: JwtPayload,
  sessionId: string,
  action: 'REJECT' | 'CANCEL',
) => {
  const session = await VideoSession.findById(sessionId);
  if (!session) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Session not found');
  }

  const recipientId =
    user.id === session.user.toString()
      ? session.consultant.toString()
      : session.user.toString();

  const recipient = await User.findById(recipientId);

  if (action === 'REJECT') {
    // Recipient rejected the call
    const endedAt = new Date();
    await VideoSession.findByIdAndUpdate(sessionId, {
      status: 'ended',
      endedAt,
      duration: 0,
    });
    
    await Consultation.findByIdAndUpdate(session.consultation, {
      status: 'cancelled',
      terminationReason: 'manual',
      cancelledAt: endedAt,
    });

    // Notify the caller
    socketHelper.emitToUser(recipientId, 'call-rejected', { sessionId });
    if (recipient?.fcmTokens && recipient.fcmTokens.length > 0) {
      await NotificationHelper.sendPushNotification(recipient.fcmTokens, {
        type: 'CALL_REJECTED',
        sessionId,
      }).catch(err => console.error('FCM Error in REJECT:', err));
    }
  } else if (action === 'CANCEL') {
    // Caller cancelled the call
    const endedAt = new Date();
    await VideoSession.findByIdAndUpdate(sessionId, {
      status: 'ended',
      endedAt,
      duration: 0,
    });
    
    await Consultation.findByIdAndUpdate(session.consultation, {
      status: 'cancelled',
      terminationReason: 'manual',
      cancelledAt: endedAt,
    });

    // Notify the recipient
    socketHelper.emitToUser(recipientId, 'call-cancelled', { sessionId });
    if (recipient?.fcmTokens && recipient.fcmTokens.length > 0) {
      await NotificationHelper.sendPushNotification(recipient.fcmTokens, {
        type: 'CALL_CANCELLED',
        sessionId,
      }).catch(err => console.error('FCM Error in CANCEL:', err));
    }
  }

  return { success: true };
};

export const VideoSessionService = {
  createSession,
  joinSession,
  endSession,
  getMySessions,
  handleCallAction,
};
