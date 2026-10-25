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
exports.VideoSessionService = void 0;
/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
/* eslint-disable no-undef */
const http_status_codes_1 = require("http-status-codes");
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../../../config"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const consultation_model_1 = require("../consultation/consultation.model");
const videoSession_model_1 = require("./videoSession.model");
const agoraTokenHelper_1 = require("../../../helpers/agoraTokenHelper");
const notification_service_1 = require("../notification/notification.service");
const billing_service_1 = require("../payment/billing.service");
const invoice_service_1 = require("../payment/invoice.service");
const notificationHelper_1 = require("../../../helpers/notification/notificationHelper");
const socketHelper_1 = require("../../../helpers/socketHelper");
const user_model_1 = require("../user/user.model");
const transcription_service_1 = require("../transcription/transcription.service");
const report_service_1 = require("../report/report.service");
const createSession = (user, consultationId) => __awaiter(void 0, void 0, void 0, function* () {
    const consultation = yield consultation_model_1.Consultation.findById(consultationId);
    if (!consultation) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Consultation not found');
    }
    // Verify that the user is part of the consultation
    if (consultation.user.toString() !== user.id &&
        consultation.consultant.toString() !== user.id) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You are not part of this consultation');
    }
    const ALLOWED_STATUSES = ['pending', 'confirmed', 'accepted', 'ongoing'];
    if (!ALLOWED_STATUSES.includes(consultation.status)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Cannot create a video session for a consultation with status: ${consultation.status}`);
    }
    const channelName = `consultation_${consultationId}`;
    // User UID: 1001, Consultant UID: 2001 as per requirement
    const uid = user.role === 'USER' ? 1001 : 2001;
    const token = (0, agoraTokenHelper_1.generateAgoraToken)(channelName, uid);
    // Check if a session already exists for this consultation
    let result = yield videoSession_model_1.VideoSession.findOne({
        consultation: consultationId,
    });
    if (result) {
        if (result.status === 'ongoing') {
            return Object.assign(Object.assign({}, result.toObject()), { token, uid });
        }
        if (result.status === 'ended' && consultation.status === 'completed') {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'This consultation session has already ended');
        }
        // Re-use and reset session state for a fresh ringing call
        const restarting = result.status === 'ended';
        result.status = 'pending';
        result.startedAt = undefined;
        result.endedAt = undefined;
        result.duration = undefined;
        if (restarting)
            result.joinedParticipants = [];
        result.token = token;
        result.channelName = channelName;
        yield result.save();
    }
    else {
        const sessionData = {
            consultation: new mongoose_1.default.Types.ObjectId(consultationId),
            user: consultation.user,
            consultant: consultation.consultant,
            channelName,
            token,
            status: 'pending',
            joinedParticipants: [],
        };
        result = yield videoSession_model_1.VideoSession.create(sessionData);
    }
    // --- Real-time Signaling ---
    const recipientId = user.role === 'USER'
        ? consultation.consultant.toString()
        : consultation.user.toString();
    const recipient = yield user_model_1.User.findById(recipientId);
    if (!recipient)
        return Object.assign(Object.assign({}, result.toObject()), { uid });
    // Fetch consultant details for the FCM payload
    const consultantDetails = yield user_model_1.User.findById(consultation.consultant);
    const consultantName = (consultantDetails === null || consultantDetails === void 0 ? void 0 : consultantDetails.name) || 'Consultant';
    let consultantAvatar = (consultantDetails === null || consultantDetails === void 0 ? void 0 : consultantDetails.image) || (consultantDetails === null || consultantDetails === void 0 ? void 0 : consultantDetails.avatar) || '';
    if (consultantAvatar && !consultantAvatar.startsWith('http')) {
        // Convert relative path to full URL using config
        const baseUrl = process.env.BASE_URL || 'https://nayem5000.binarybards.online';
        consultantAvatar = baseUrl
            ? `${baseUrl}${consultantAvatar.startsWith('/') ? '' : '/'}${consultantAvatar}`
            : consultantAvatar;
    }
    // Fetch caller details from DB (JwtPayload only contains id, role, email)
    const callerUser = yield user_model_1.User.findById(user.id);
    const callerName = (callerUser === null || callerUser === void 0 ? void 0 : callerUser.name) ||
        (user.role === 'CONSULTANT' ? consultantName : 'Fixpair User');
    let callerAvatar = (callerUser === null || callerUser === void 0 ? void 0 : callerUser.image) || (callerUser === null || callerUser === void 0 ? void 0 : callerUser.avatar) || '';
    if (callerAvatar && !callerAvatar.startsWith('http')) {
        const baseUrl = process.env.BASE_URL || 'https://nayem5000.binarybards.online';
        callerAvatar = baseUrl
            ? `${baseUrl}${callerAvatar.startsWith('/') ? '' : '/'}${callerAvatar}`
            : callerAvatar;
    }
    // Generate a token specifically for the recipient
    const recipientUid = recipient.role === 'USER' ? 1001 : 2001;
    const recipientToken = (0, agoraTokenHelper_1.generateAgoraToken)(channelName, recipientUid);
    const signalingData = {
        sessionId: result._id.toString(),
        callerName,
        callerAvatar,
        appId: config_1.default.agora.appId,
        token: recipientToken, // Send the recipient's specific token
        channelName: result.channelName,
        bookingId: consultationId,
        consultantName: consultantName,
        consultantAvatar: consultantAvatar,
    };
    // 1. Real-time signaling via Socket.io (for Desktop Web / Active clients)
    socketHelper_1.socketHelper.emitToUser(recipientId, 'incoming-call', Object.assign(Object.assign({}, signalingData), { uid: recipientUid }));
    // 2. Incoming Call Push Notification (APNs VoIP for iOS & High-Priority Data for Android)
    yield notificationHelper_1.NotificationHelper.sendIncomingCallNotification({
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
    return Object.assign(Object.assign({}, result.toObject()), { uid });
});
const joinSession = (user, sessionId) => __awaiter(void 0, void 0, void 0, function* () {
    let session = yield videoSession_model_1.VideoSession.findById(sessionId);
    if (!session) {
        session = yield videoSession_model_1.VideoSession.findOne({ consultation: sessionId });
    }
    if (!session) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Video session not found');
    }
    const actualSessionId = session._id.toString();
    if (session.status === 'ended') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'This session has already ended');
    }
    const consultation = yield consultation_model_1.Consultation.findById(session.consultation);
    // Verify that the user is part of the session
    if (session.user.toString() !== user.id &&
        session.consultant.toString() !== user.id) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You are not part of this session');
    }
    const uid = user.role === 'USER' ? 1001 : 2001;
    // Track joined participants atomically
    const updatedSession = yield videoSession_model_1.VideoSession.findByIdAndUpdate(actualSessionId, {
        $addToSet: { joinedParticipants: new mongoose_1.default.Types.ObjectId(user.id) },
    }, { new: true });
    const participantIds = ((updatedSession === null || updatedSession === void 0 ? void 0 : updatedSession.joinedParticipants) || []).map(id => id.toString());
    const hasUserJoined = participantIds.includes(session.user.toString());
    const hasConsultantJoined = participantIds.includes(session.consultant.toString());
    const bothParticipantsJoined = hasUserJoined && hasConsultantJoined;
    // Only transition to 'ongoing' and start billing when BOTH parties have joined the session
    if (bothParticipantsJoined) {
        const consultationDoc = yield consultation_model_1.Consultation.findById(session.consultation);
        const isBillingPending = !consultationDoc || consultationDoc.billingStatus === 'pending';
        const startedSession = isBillingPending
            ? yield videoSession_model_1.VideoSession.findOneAndUpdate({ _id: actualSessionId, status: 'pending' }, { status: 'ongoing', startedAt: session.startedAt || new Date() }, { new: true })
            : null;
        if (startedSession) {
            // 1. Trigger billing only now that both parties are connected
            try {
                yield billing_service_1.BillingService.startBilling(session.consultation.toString());
                yield mongoose_1.default.model('Consultation').updateOne({ _id: session.consultation }, { status: 'ongoing' });
            }
            catch (error) {
                // If billing fails, revert status so it can be retried
                yield videoSession_model_1.VideoSession.updateOne({ _id: actualSessionId }, { status: 'pending', startedAt: null });
                throw error;
            }
            // 2. Start Transcription
            transcription_service_1.TranscriptionService.startTranscription(session.consultation.toString())
                .catch((sttError) => __awaiter(void 0, void 0, void 0, function* () {
                console.error('STT startup failed:', sttError);
                const endedSession = yield videoSession_model_1.VideoSession.findOneAndUpdate({
                    _id: actualSessionId,
                    status: { $ne: 'ended' },
                }, {
                    $set: { transcriptionStatus: 'failed' },
                });
                socketHelper_1.socketHelper.emitToUser(user.id, 'transcription-failed', {
                    sessionId: actualSessionId,
                    consultationId: session.consultation.toString(),
                    message: 'Transcription could not be started. Billing continues normally.',
                });
            }));
            // 3. Notify consultation room that call is now active and ongoing
            socketHelper_1.socketHelper.emitToRoom(`consultation:${session.consultation}`, 'call-accepted', {
                sessionId: actualSessionId,
                consultationId: session.consultation.toString(),
            });
        }
    }
    // Generate a fresh token for this specific user/UID
    const token = (0, agoraTokenHelper_1.generateAgoraToken)(session.channelName, uid);
    const freshSession = yield videoSession_model_1.VideoSession.findById(actualSessionId);
    return Object.assign(Object.assign({}, freshSession.toObject()), { token, // Return the fresh token instead of the one in DB
        uid, appId: config_1.default.agora.appId });
});
const endSession = (user, sessionId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    let session = yield videoSession_model_1.VideoSession.findById(sessionId);
    if (!session) {
        session = yield videoSession_model_1.VideoSession.findOne({ consultation: sessionId });
    }
    if (!session) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Video session not found');
    }
    const actualSessionId = session._id.toString();
    if (session.status === 'ended') {
        return yield videoSession_model_1.VideoSession.findById(actualSessionId);
    }
    // Verify that the user is part of the session
    if (session.user.toString() !== user.id &&
        session.consultant.toString() !== user.id) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You are not authorized to end this session');
    }
    const endedAt = new Date();
    const duration = session.startedAt
        ? Math.floor((endedAt.getTime() - session.startedAt.getTime()) / 1000)
        : 0;
    const endedSession = yield videoSession_model_1.VideoSession.findOneAndUpdate({
        _id: actualSessionId,
        status: { $ne: 'ended' },
    }, {
        status: 'ended',
        endedAt,
        duration,
        transcriptionStatus: 'stopping',
    });
    if (!endedSession)
        return yield videoSession_model_1.VideoSession.findById(actualSessionId);
    if (!endedSession)
        return yield videoSession_model_1.VideoSession.findById(actualSessionId);
    // Stop transcription
    try {
        yield transcription_service_1.TranscriptionService.stopTranscription(session.consultation.toString());
    }
    catch (err) {
        console.error('Failed to stop transcription:', err);
    }
    // Stop billing and generate invoice
    yield billing_service_1.BillingService.stopBilling(session.consultation.toString());
    yield consultation_model_1.Consultation.findByIdAndUpdate(session.consultation, {
        status: session.startedAt ? 'completed' : 'cancelled',
    });
    if (session.startedAt) {
        yield invoice_service_1.InvoiceService.finalizeInvoice(session.consultation.toString());
    }
    const updatedConsultation = yield consultation_model_1.Consultation.findById(session.consultation).populate('user consultant');
    if (updatedConsultation) {
        const client = ((_a = updatedConsultation.user) === null || _a === void 0 ? void 0 : _a.name) || 'Client';
        const consultant = ((_b = updatedConsultation.consultant) === null || _b === void 0 ? void 0 : _b.name) || 'Consultant';
        const finalAmount = updatedConsultation.consumedAmount || 0;
        let finalDurationMins = 0;
        if (updatedConsultation.perMinuteRate > 0) {
            const fee = updatedConsultation.platformFee || 0;
            if (finalAmount >= fee) {
                finalDurationMins = Math.round((finalAmount - fee) / updatedConsultation.perMinuteRate);
            }
        }
        else {
            finalDurationMins = Math.max(1, Math.round(duration / 60)); // minimum 1 min if fallback
        }
        yield notification_service_1.NotificationService.notifyAdmins({
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
    report_service_1.ReportService.generateOrGetAiSummary(session.consultation.toString()).catch((err) => {
        console.error(`Failed to generate AI summary for consultation ${session.consultation}:`, err);
    });
    // Notify the other participant and the room that the session has ended
    const recipientId = user.id === session.user.toString()
        ? session.consultant.toString()
        : session.user.toString();
    const emitFinalAmount = (updatedConsultation === null || updatedConsultation === void 0 ? void 0 : updatedConsultation.consumedAmount) || 0;
    const emitBillableMins = session.startedAt ? Math.max(1, Math.ceil(duration / 60)) : 0;
    socketHelper_1.socketHelper.emitToUser(recipientId, 'call-ended', {
        duration,
        billableMinutes: emitBillableMins,
        totalAmount: emitFinalAmount,
        consumedAmount: emitFinalAmount,
        sessionId: actualSessionId,
        consultationId: session.consultation.toString(),
        bookingId: session.consultation.toString(),
        endedBy: user.id,
    });
    socketHelper_1.socketHelper.emitToRoom(`consultation:${session.consultation}`, 'call-ended', {
        duration,
        billableMinutes: emitBillableMins,
        totalAmount: emitFinalAmount,
        consumedAmount: emitFinalAmount,
        sessionId: actualSessionId,
        consultationId: session.consultation.toString(),
        bookingId: session.consultation.toString(),
        endedBy: user.id,
    });
    return yield videoSession_model_1.VideoSession.findById(actualSessionId);
});
const getMySessions = (user, query) => __awaiter(void 0, void 0, void 0, function* () {
    const filter = {};
    if (user.role === 'USER') {
        filter.user = user.id;
    }
    else if (user.role === 'CONSULTANT') {
        filter.consultant = user.id;
    }
    const sessionQuery = new QueryBuilder_1.default(videoSession_model_1.VideoSession.find(filter), query)
        .filter()
        .sort()
        .paginate()
        .fields();
    const result = yield sessionQuery.modelQuery.populate([
        { path: 'user', select: 'name image avatar' },
        { path: 'consultant', select: 'name image avatar' },
        { path: 'consultation' },
    ]);
    const meta = yield sessionQuery.getPaginationInfo();
    return { meta, result };
});
const handleCallAction = (user, sessionId, action) => __awaiter(void 0, void 0, void 0, function* () {
    if (action === 'END') {
        return yield endSession(user, sessionId);
    }
    let session = yield videoSession_model_1.VideoSession.findById(sessionId);
    if (!session) {
        session = yield videoSession_model_1.VideoSession.findOne({ consultation: sessionId });
    }
    if (!session) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Session not found');
    }
    const actualSessionId = session._id.toString();
    if (session.user.toString() !== user.id && session.consultant.toString() !== user.id) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You are not part of this session');
    }
    if (session.status === 'ended')
        return session;
    if (session.status === 'ongoing')
        return yield endSession(user, actualSessionId);
    const recipientId = user.id === session.user.toString()
        ? session.consultant.toString()
        : session.user.toString();
    const recipient = yield user_model_1.User.findById(recipientId);
    if (action === 'REJECT') {
        // Recipient rejected the call
        const endedAt = new Date();
        yield videoSession_model_1.VideoSession.findByIdAndUpdate(actualSessionId, {
            status: 'ended',
            endedAt,
            duration: 0,
        });
        yield consultation_model_1.Consultation.findByIdAndUpdate(session.consultation, {
            status: 'cancelled',
            terminationReason: 'manual',
            cancelledAt: endedAt,
        });
        // Stop any billing timers immediately if call is rejected
        yield billing_service_1.BillingService.stopBilling(session.consultation.toString()).catch(() => null);
        // Notify the caller via user socket & room
        socketHelper_1.socketHelper.emitToUser(recipientId, 'call-rejected', {
            sessionId: actualSessionId,
            consultationId: session.consultation.toString(),
            bookingId: session.consultation.toString(),
        });
        socketHelper_1.socketHelper.emitToRoom(`consultation:${session.consultation}`, 'call-rejected', {
            sessionId: actualSessionId,
            consultationId: session.consultation.toString(),
            bookingId: session.consultation.toString(),
        });
        if (recipient) {
            yield notificationHelper_1.NotificationHelper.sendCallCancellationNotification({
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
    }
    else if (action === 'CANCEL') {
        // Caller cancelled the call
        const endedAt = new Date();
        yield videoSession_model_1.VideoSession.findByIdAndUpdate(actualSessionId, {
            status: 'ended',
            endedAt,
            duration: 0,
        });
        yield consultation_model_1.Consultation.findByIdAndUpdate(session.consultation, {
            status: 'cancelled',
            terminationReason: 'manual',
            cancelledAt: endedAt,
        });
        // Stop any billing timers immediately if call is cancelled
        yield billing_service_1.BillingService.stopBilling(session.consultation.toString()).catch(() => null);
        // Notify the recipient via user socket & room
        socketHelper_1.socketHelper.emitToUser(recipientId, 'call-cancelled', {
            sessionId: actualSessionId,
            consultationId: session.consultation.toString(),
            bookingId: session.consultation.toString(),
        });
        socketHelper_1.socketHelper.emitToRoom(`consultation:${session.consultation}`, 'call-cancelled', {
            sessionId: actualSessionId,
            consultationId: session.consultation.toString(),
            bookingId: session.consultation.toString(),
        });
        if (recipient) {
            yield notificationHelper_1.NotificationHelper.sendCallCancellationNotification({
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
});
exports.VideoSessionService = {
    createSession,
    joinSession,
    endSession,
    getMySessions,
    handleCallAction,
};
