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
import { BillingService } from '../payment/billing.service';
import { InvoiceService } from '../payment/invoice.service';
import { NotificationHelper } from '../../../helpers/notification/notificationHelper';
import { socketHelper } from '../../../helpers/socketHelper';
import { User } from '../user/user.model';
import { TranscriptionService } from '../transcription/transcription.service';
import { ReportService } from '../report/report.service';

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

  const channelName = `consultation_${consultationId}`;
  // User UID: 1001, Consultant UID: 2001 as per requirement
  const uid = user.role === 'USER' ? 1001 : 2001;
  const token = generateAgoraToken(channelName, uid);

  // Check if a session already exists for this consultation
  let result = await VideoSession.findOne({
    consultation: consultationId,
  });

  if (result) {
    if (result.status === 'ongoing') {
      return { ...result.toObject(), uid };
    }
    if (result.status === 'ended' && consultation.status === 'completed') {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'This consultation session has already ended',
      );
    }
    // Re-use and reset session state for a fresh ringing call
    result.status = 'pending';
    result.startedAt = undefined;
    result.endedAt = undefined;
    result.duration = undefined;
    result.joinedParticipants = [new mongoose.Types.ObjectId(user.id)];
    result.token = token;
    result.channelName = channelName;
    await result.save();
  } else {
    const sessionData: Partial<IVideoSession> = {
      consultation: new mongoose.Types.ObjectId(consultationId),
      user: consultation.user,
      consultant: consultation.consultant,
      channelName,
      token,
      status: 'pending',
      joinedParticipants: [new mongoose.Types.ObjectId(user.id)],
    };
    result = await VideoSession.create(sessionData);
  }

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
    // Convert relative path to full URL using config
    const baseUrl = process.env.BASE_URL || config.ip_address || '';
    consultantAvatar = baseUrl
      ? `${baseUrl}${consultantAvatar.startsWith('/') ? '' : '/'}${consultantAvatar}`
      : consultantAvatar;
  }

  // Fetch caller details from DB (JwtPayload only contains id, role, email)
  const callerUser = await User.findById(user.id);
  const callerName =
    callerUser?.name ||
    (user.role === 'CONSULTANT' ? consultantName : 'Fixpair User');

  let callerAvatar = callerUser?.image || callerUser?.avatar || '';
  if (callerAvatar && !callerAvatar.startsWith('http')) {
    const baseUrl = process.env.BASE_URL || config.ip_address || '';
    callerAvatar = baseUrl
      ? `${baseUrl}${callerAvatar.startsWith('/') ? '' : '/'}${callerAvatar}`
      : callerAvatar;
  }

  // Generate a token specifically for the recipient
  const recipientUid = recipient.role === 'USER' ? 1001 : 2001;
  const recipientToken = generateAgoraToken(channelName, recipientUid);

  const signalingData = {
    sessionId: result._id.toString(),
    callerName,
    callerAvatar,
    appId: config.agora.appId,
    token: recipientToken, // Send the recipient's specific token
    channelName: result.channelName,
    bookingId: consultationId,
    consultantName: consultantName,
    consultantAvatar: consultantAvatar,
  };

  // 1. Real-time signaling via Socket.io (for Desktop Web / Active clients)
  socketHelper.emitToUser(recipientId, 'incoming-call', {
    ...signalingData,
    uid: recipientUid,
  });

  // 2. Incoming Call Push Notification (APNs VoIP for iOS & High-Priority Data for Android)
  await NotificationHelper.sendIncomingCallNotification({
    recipient: {
      userId: recipient._id.toString(),
      deviceType: recipient.deviceType,
      fcmTokens: recipient.fcmTokens,
      voipToken: recipient.voipToken,
    },
    sessionData: {
      sessionId: result._id.toString(),
      agoraToken: recipientToken,
      channelName: result.channelName,
      callerName: signalingData.callerName,
      callerAvatar: signalingData.callerAvatar,
      bookingId: consultationId,
      consultantName: signalingData.consultantName,
      consultantAvatar: signalingData.consultantAvatar,
    },
  }).catch(err => console.error('Error in sendIncomingCallNotification:', err));

  return { ...result.toObject(), uid };
};



const joinSession = async (user: JwtPayload, sessionId: string) => {
  let session = await VideoSession.findById(sessionId);
  if (!session) {
    session = await VideoSession.findOne({ consultation: sessionId });
  }
  if (!session) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Video session not found');
  }

  const actualSessionId = session._id.toString();

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

  // Track joined participants atomically
  const updatedSession = await VideoSession.findByIdAndUpdate(
    actualSessionId,
    {
      $addToSet: { joinedParticipants: new mongoose.Types.ObjectId(user.id) },
    },
    { new: true },
  );

  const participantIds = (updatedSession?.joinedParticipants || []).map(id =>
    id.toString(),
  );
  const hasUserJoined = participantIds.includes(session.user.toString());
  const hasConsultantJoined = participantIds.includes(
    session.consultant.toString(),
  );
  const bothParticipantsJoined = hasUserJoined && hasConsultantJoined;

  // Only transition to 'ongoing' and start billing when BOTH parties have joined the session
  if (bothParticipantsJoined) {
    const consultationDoc = await Consultation.findById(session.consultation);
    const isBillingPending = !consultationDoc || consultationDoc.billingStatus === 'pending';

    const startedSession = isBillingPending
      ? await VideoSession.findOneAndUpdate(
          { _id: actualSessionId, status: { $in: ['pending', 'ongoing'] } },
          { status: 'ongoing', startedAt: session.startedAt || new Date() },
          { new: true },
        )
      : null;

    if (startedSession) {
      // 1. Trigger billing only now that both parties are connected
      try {
        await BillingService.startBilling(session.consultation.toString());
        await mongoose.model('Consultation').updateOne(
          { _id: session.consultation },
          { status: 'ongoing' },
        );
      } catch (error) {
        // If billing fails, revert status so it can be retried
        await VideoSession.updateOne(
          { _id: actualSessionId },
          { status: 'pending', startedAt: null },
        );
        throw error;
      }

      // 2. Start Transcription
      TranscriptionService.startTranscription(session.consultation.toString())
        .catch(async (sttError) => {
          console.error('STT startup failed:', sttError);
          await VideoSession.findByIdAndUpdate(actualSessionId, {
            $set: { transcriptionStatus: 'failed' },
          });
          socketHelper.emitToUser(user.id, 'transcription-failed', {
            sessionId: actualSessionId,
            consultationId: session.consultation.toString(),
            message:
              'Transcription could not be started. Billing continues normally.',
          });
        });

      // 3. Notify consultation room that call is now active and ongoing
      socketHelper.emitToRoom(
        `consultation:${session.consultation}`,
        'call-accepted',
        {
          sessionId: actualSessionId,
          consultationId: session.consultation.toString(),
        },
      );
    }
  }

  // Generate a fresh token for this specific user/UID
  const token = generateAgoraToken(session.channelName, uid);

  const freshSession = await VideoSession.findById(actualSessionId);

  return {
    ...freshSession!.toObject(),
    token, // Return the fresh token instead of the one in DB
    uid,
    appId: config.agora.appId,
  };
};

const endSession = async (user: JwtPayload, sessionId: string) => {
  let session = await VideoSession.findById(sessionId);
  if (!session) {
    session = await VideoSession.findOne({ consultation: sessionId });
  }
  if (!session) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Video session not found');
  }

  const actualSessionId = session._id.toString();

  if (session.status === 'ended') {
    return await VideoSession.findById(actualSessionId);
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

  await VideoSession.findByIdAndUpdate(actualSessionId, {
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
  await Consultation.findByIdAndUpdate(session.consultation, { status: 'completed' });
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

  // 4. Asynchronously generate AI consultation summary with Gemini
  ReportService.generateOrGetAiSummary(session.consultation.toString()).catch(
    (err) => {
      console.error(
        `Failed to generate AI summary for consultation ${session.consultation}:`,
        err,
      );
    },
  );

  // Notify the other participant and the room that the session has ended
  const recipientId =
    user.id === session.user.toString()
      ? session.consultant.toString()
      : session.user.toString();

  const emitFinalAmount = updatedConsultation?.consumedAmount || 0;
  const emitBillableMins = duration > 0 ? Math.max(1, Math.ceil(duration / 60)) : 1;

  socketHelper.emitToUser(recipientId, 'call-ended', {
    duration,
    billableMinutes: emitBillableMins,
    totalAmount: emitFinalAmount,
    consumedAmount: emitFinalAmount,
    sessionId: actualSessionId,
    consultationId: session.consultation.toString(),
    bookingId: session.consultation.toString(),
    endedBy: user.id,
  });

  socketHelper.emitToRoom(
    `consultation:${session.consultation}`,
    'call-ended',
    {
      duration,
      billableMinutes: emitBillableMins,
      totalAmount: emitFinalAmount,
      consumedAmount: emitFinalAmount,
      sessionId: actualSessionId,
      consultationId: session.consultation.toString(),
      bookingId: session.consultation.toString(),
      endedBy: user.id,
    },
  );

  return await VideoSession.findById(actualSessionId);
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
  action: 'REJECT' | 'CANCEL' | 'END',
) => {
  if (action === 'END') {
    return await endSession(user, sessionId);
  }

  let session = await VideoSession.findById(sessionId);
  if (!session) {
    session = await VideoSession.findOne({ consultation: sessionId });
  }
  if (!session) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Session not found');
  }

  const actualSessionId = session._id.toString();

  const recipientId =
    user.id === session.user.toString()
      ? session.consultant.toString()
      : session.user.toString();

  const recipient = await User.findById(recipientId);

  if (action === 'REJECT') {
    // Recipient rejected the call
    const endedAt = new Date();
    await VideoSession.findByIdAndUpdate(actualSessionId, {
      status: 'ended',
      endedAt,
      duration: 0,
    });
    
    await Consultation.findByIdAndUpdate(session.consultation, {
      status: 'cancelled',
      terminationReason: 'manual',
      cancelledAt: endedAt,
    });

    // Stop any billing timers immediately if call is rejected
    await BillingService.stopBilling(session.consultation.toString()).catch(() => null);

    // Notify the caller via user socket & room
    socketHelper.emitToUser(recipientId, 'call-rejected', {
      sessionId: actualSessionId,
      consultationId: session.consultation.toString(),
      bookingId: session.consultation.toString(),
    });
    socketHelper.emitToRoom(
      `consultation:${session.consultation}`,
      'call-rejected',
      {
        sessionId: actualSessionId,
        consultationId: session.consultation.toString(),
        bookingId: session.consultation.toString(),
      },
    );

    if (recipient) {
      await NotificationHelper.sendCallCancellationNotification({
        recipient: {
          userId: recipient._id.toString(),
          deviceType: recipient.deviceType,
          fcmTokens: recipient.fcmTokens,
          voipToken: recipient.voipToken,
        },
        sessionId: actualSessionId,
        status: 'rejected',
      }).catch((err) => console.error('Error in sendCallCancellationNotification (REJECT):', err));
    }
  } else if (action === 'CANCEL') {
    // Caller cancelled the call
    const endedAt = new Date();
    await VideoSession.findByIdAndUpdate(actualSessionId, {
      status: 'ended',
      endedAt,
      duration: 0,
    });

    await Consultation.findByIdAndUpdate(session.consultation, {
      status: 'cancelled',
      terminationReason: 'manual',
      cancelledAt: endedAt,
    });

    // Stop any billing timers immediately if call is cancelled
    await BillingService.stopBilling(session.consultation.toString()).catch(() => null);

    // Notify the recipient via user socket & room
    socketHelper.emitToUser(recipientId, 'call-cancelled', {
      sessionId: actualSessionId,
      consultationId: session.consultation.toString(),
      bookingId: session.consultation.toString(),
    });
    socketHelper.emitToRoom(
      `consultation:${session.consultation}`,
      'call-cancelled',
      {
        sessionId: actualSessionId,
        consultationId: session.consultation.toString(),
        bookingId: session.consultation.toString(),
      },
    );

    if (recipient) {
      await NotificationHelper.sendCallCancellationNotification({
        recipient: {
          userId: recipient._id.toString(),
          deviceType: recipient.deviceType,
          fcmTokens: recipient.fcmTokens,
          voipToken: recipient.voipToken,
        },
        sessionId: actualSessionId,
        status: 'cancelled',
      }).catch((err) => console.error('Error in sendCallCancellationNotification (CANCEL):', err));
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
