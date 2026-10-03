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
exports.socketHelper = void 0;
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
const colors_1 = __importDefault(require("colors"));
const logger_1 = require("../shared/logger");
const jwtHelper_1 = require("./jwtHelper");
const config_1 = __importDefault(require("../config"));
const videoSession_model_1 = require("../app/modules/videoSession/videoSession.model");
const user_model_1 = require("../app/modules/user/user.model");
const consultation_model_1 = require("../app/modules/consultation/consultation.model");
const cache_1 = require("../app/utils/cache");
const userSocketMap = new Map();
const disconnectTimers = new Map();
const socket = (io) => {
    // Middleware for authentication
    io.use((socket, next) => {
        var _a, _b;
        const token = ((_a = socket.handshake.auth) === null || _a === void 0 ? void 0 : _a.token) || ((_b = socket.handshake.headers) === null || _b === void 0 ? void 0 : _b.authorization);
        if (!token) {
            return next(new Error('Authentication error: Token missing'));
        }
        try {
            // Remove 'Bearer ' if present
            const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
            const decoded = jwtHelper_1.jwtHelper.verifyToken(cleanToken, config_1.default.jwt.jwt_secret);
            if (!decoded || !decoded.id) {
                return next(new Error('Authentication error: Invalid token'));
            }
            // @ts-ignore
            socket.userId = decoded.id;
            // @ts-ignore
            socket.userRole = decoded.role;
            if (decoded.role === 'ADMIN' || decoded.role === 'SUPER_ADMIN') {
                socket.join('admin_room');
            }
            next();
        }
        catch (error) {
            return next(new Error('Authentication error: Invalid token'));
        }
    });
    io.on('connection', socket => {
        // @ts-ignore
        const userId = socket.userId;
        // @ts-ignore
        const userRole = socket.userRole;
        if (userId) {
            if (!userSocketMap.has(userId)) {
                userSocketMap.set(userId, new Set());
            }
            userSocketMap.get(userId).add(socket.id);
            logger_1.logger.info(colors_1.default.blue(`User connected: ${userId} (Socket: ${socket.id})`));
            // Clear disconnect timer if user reconnects
            if (disconnectTimers.has(userId)) {
                clearTimeout(disconnectTimers.get(userId));
                disconnectTimers.delete(userId);
            }
        }
        // Join a consultation room so transcript:new events reach both participants
        // regardless of socket reconnections (room-based, not socket-ID-based).
        socket.on('join-consultation', (consultationId) => {
            socket.join(`consultation:${consultationId}`);
            logger_1.logger.info(`Socket ${socket.id} joined room consultation:${consultationId}`);
        });
        // --- Live Transcription Relay (Option B) ---
        socket.on('send-speech', (data) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const { sessionId, text } = data;
                const session = yield videoSession_model_1.VideoSession.findById(sessionId);
                if (!session)
                    return;
                // Determine recipient (the opposite person in the session)
                const recipientId = userId === session.user.toString()
                    ? session.consultant.toString()
                    : session.user.toString();
                const sender = yield user_model_1.User.findById(userId);
                // Relay to the other person
                emitToUser(recipientId, 'receive-speech', {
                    speaker: (sender === null || sender === void 0 ? void 0 : sender.name) || 'User',
                    text,
                    sessionId,
                });
            }
            catch (error) {
                logger_1.logger.error('Transcription relay error:', error);
            }
        }));
        //disconnect
        socket.on('disconnect', () => {
            var _a, _b;
            if (userId) {
                const userSockets = userSocketMap.get(userId);
                if (userSockets) {
                    userSockets.delete(socket.id);
                    if (userSockets.size === 0) {
                        userSocketMap.delete(userId);
                    }
                }
                logger_1.logger.info(colors_1.default.red(`User disconnected: ${userId} (Socket: ${socket.id})`));
                // Start a 1-minute grace period before cleaning up active sessions and setting offline
                if (!userSocketMap.has(userId)) {
                    const timer = setTimeout(() => __awaiter(void 0, void 0, void 0, function* () {
                        try {
                            // Check if user is still disconnected
                            if (!userSocketMap.has(userId)) {
                                logger_1.logger.info(`Cleaning up stale sessions for disconnected user: ${userId}`);
                                // If user is a CONSULTANT, mark offline in DB and broadcast presence update
                                if (userRole === 'CONSULTANT') {
                                    const consultant = yield user_model_1.User.findById(userId);
                                    if (consultant && consultant.activeStatus) {
                                        yield user_model_1.User.findByIdAndUpdate(userId, { activeStatus: false });
                                        cache_1.cacheHelper.clearByPrefix('consultants:recommended');
                                        cache_1.cacheHelper.clearByPrefix('consultants:list');
                                        broadcastAll('consultant:status-changed', {
                                            consultantId: userId,
                                            activeStatus: false,
                                        });
                                        logger_1.logger.info(`Consultant ${userId} set to offline after disconnect grace period`);
                                    }
                                }
                                // 1. Find ongoing sessions where this user is either user or consultant
                                const ongoingSessions = yield videoSession_model_1.VideoSession.find({
                                    status: 'ongoing',
                                    $or: [{ user: userId }, { consultant: userId }]
                                });
                                for (const session of ongoingSessions) {
                                    const endedAt = new Date();
                                    const duration = session.startedAt ? Math.floor((endedAt.getTime() - session.startedAt.getTime()) / 1000) : 0;
                                    // End the video session
                                    yield videoSession_model_1.VideoSession.findByIdAndUpdate(session._id, {
                                        status: 'cancelled',
                                        endedAt,
                                        duration,
                                        terminationReason: 'abnormal_disconnect'
                                    });
                                    // Cancel the consultation
                                    yield consultation_model_1.Consultation.findByIdAndUpdate(session.consultation, {
                                        status: 'cancelled',
                                        cancelledAt: endedAt,
                                        terminationReason: 'abnormal_disconnect'
                                    });
                                    // Emit to room that session was force ended
                                    emitToRoom(`consultation:${session.consultation}`, 'consultation-auto-ended', {
                                        reason: 'abnormal_disconnect',
                                        message: 'Session ended automatically due to participant disconnection.'
                                    });
                                }
                                // 2. Clean up unstarted pending instant consultations
                                const pendingConsultations = yield consultation_model_1.Consultation.find({
                                    status: 'pending',
                                    bookingType: 'instant',
                                    $or: [{ user: userId }, { consultant: userId }],
                                });
                                for (const pc of pendingConsultations) {
                                    yield consultation_model_1.Consultation.findByIdAndUpdate(pc._id, {
                                        status: 'cancelled',
                                        cancelledAt: new Date(),
                                        terminationReason: 'abnormal_disconnect',
                                    });
                                    yield videoSession_model_1.VideoSession.updateMany({ consultation: pc._id, status: 'pending' }, { status: 'cancelled', endedAt: new Date(), terminationReason: 'abnormal_disconnect' });
                                }
                            }
                        }
                        catch (error) {
                            logger_1.logger.error(`Error during socket disconnect cleanup for user ${userId}:`, error);
                        }
                        finally {
                            disconnectTimers.delete(userId);
                        }
                    }), (_b = (_a = config_1.default.socket) === null || _a === void 0 ? void 0 : _a.disconnectGracePeriodMs) !== null && _b !== void 0 ? _b : 60 * 1000);
                    disconnectTimers.set(userId, timer);
                }
            }
        });
    });
};
const emitToUser = (userId, event, data) => {
    //@ts-ignore
    const io = global.io;
    const socketIds = userSocketMap.get(userId);
    if (io && socketIds && socketIds.size > 0) {
        socketIds.forEach(socketId => {
            io.to(socketId).emit(event, data);
        });
    }
};
const emitToRoom = (room, event, data) => {
    //@ts-ignore
    const io = global.io;
    if (io) {
        io.to(room).emit(event, data);
    }
};
const broadcastToAdmins = (event, data) => {
    //@ts-ignore
    const io = global.io;
    if (io) {
        io.to('admin_room').emit(event, data);
    }
};
const broadcastAll = (event, data) => {
    //@ts-ignore
    const io = global.io;
    if (io) {
        io.emit(event, data);
    }
};
const disconnectUser = (userId) => {
    //@ts-ignore
    const io = global.io;
    const socketIds = userSocketMap.get(userId);
    if (io && socketIds && socketIds.size > 0) {
        socketIds.forEach(socketId => {
            const socketObj = io.sockets.sockets.get(socketId);
            if (socketObj) {
                socketObj.disconnect(true);
            }
        });
        userSocketMap.delete(userId);
    }
    if (disconnectTimers.has(userId)) {
        clearTimeout(disconnectTimers.get(userId));
        disconnectTimers.delete(userId);
    }
};
exports.socketHelper = {
    socket,
    emitToUser,
    emitToRoom,
    broadcastToAdmins,
    broadcastAll,
    disconnectUser,
};
