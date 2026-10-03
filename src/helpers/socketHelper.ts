/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import colors from 'colors';
import { Server } from 'socket.io';
import { logger } from '../shared/logger';
import { jwtHelper } from './jwtHelper';
import config from '../config';
import { Secret } from 'jsonwebtoken';
import { VideoSession } from '../app/modules/videoSession/videoSession.model';
import { User } from '../app/modules/user/user.model';
import { Consultation } from '../app/modules/consultation/consultation.model';
import { cacheHelper } from '../app/utils/cache';

const userSocketMap = new Map<string, Set<string>>();
const disconnectTimers = new Map<string, NodeJS.Timeout>();

const socket = (io: Server) => {
  // Middleware for authentication
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token || socket.handshake.headers?.authorization;

    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    try {
      // Remove 'Bearer ' if present
      const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
      const decoded = jwtHelper.verifyToken(
        cleanToken,
        config.jwt.jwt_secret as Secret,
      );

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
    } catch (error) {
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
        userSocketMap.set(userId, new Set<string>());
      }
      userSocketMap.get(userId)!.add(socket.id);

      logger.info(
        colors.blue(`User connected: ${userId} (Socket: ${socket.id})`),
      );
      
      // Clear disconnect timer if user reconnects
      if (disconnectTimers.has(userId)) {
        clearTimeout(disconnectTimers.get(userId));
        disconnectTimers.delete(userId);
      }
    }

    // Join a consultation room so transcript:new events reach both participants
    // regardless of socket reconnections (room-based, not socket-ID-based).
    socket.on('join-consultation', (consultationId: string) => {
      socket.join(`consultation:${consultationId}`);
      logger.info(
        `Socket ${socket.id} joined room consultation:${consultationId}`,
      );
    });

    // --- Live Transcription Relay (Option B) ---
    socket.on(
      'send-speech',
      async (data: { sessionId: string; text: string }) => {
        try {
          const { sessionId, text } = data;
          const session = await VideoSession.findById(sessionId);
          if (!session) return;

          // Determine recipient (the opposite person in the session)
          const recipientId =
            userId === session.user.toString()
              ? session.consultant.toString()
              : session.user.toString();

          const sender = await User.findById(userId);

          // Relay to the other person
          emitToUser(recipientId, 'receive-speech', {
            speaker: sender?.name || 'User',
            text,
            sessionId,
          });
        } catch (error) {
          logger.error('Transcription relay error:', error);
        }
      },
    );

    //disconnect
    socket.on('disconnect', () => {
      if (userId) {
        const userSockets = userSocketMap.get(userId);
        if (userSockets) {
          userSockets.delete(socket.id);
          if (userSockets.size === 0) {
            userSocketMap.delete(userId);
          }
        }
        logger.info(colors.red(`User disconnected: ${userId} (Socket: ${socket.id})`));

        // Start a 1-minute grace period before cleaning up active sessions and setting offline
        if (!userSocketMap.has(userId)) {
          const timer = setTimeout(async () => {
            try {
              // Check if user is still disconnected
              if (!userSocketMap.has(userId)) {
                logger.info(`Cleaning up stale sessions for disconnected user: ${userId}`);

                // If user is a CONSULTANT, mark offline in DB and broadcast presence update
                if (userRole === 'CONSULTANT') {
                  const consultant = await User.findById(userId);
                  if (consultant && consultant.activeStatus) {
                    await User.findByIdAndUpdate(userId, { activeStatus: false });
                    cacheHelper.clearByPrefix('consultants:recommended');
                    cacheHelper.clearByPrefix('consultants:list');
                    broadcastAll('consultant:status-changed', {
                      consultantId: userId,
                      activeStatus: false,
                    });
                    logger.info(`Consultant ${userId} set to offline after disconnect grace period`);
                  }
                }
              
                // 1. Find ongoing sessions where this user is either user or consultant
                const ongoingSessions = await VideoSession.find({
                  status: 'ongoing',
                  $or: [{ user: userId }, { consultant: userId }]
                });

                for (const session of ongoingSessions) {
                  const endedAt = new Date();
                  const duration = session.startedAt ? Math.floor((endedAt.getTime() - session.startedAt.getTime()) / 1000) : 0;
                  
                  // End the video session
                  await VideoSession.findByIdAndUpdate(session._id, {
                    status: 'cancelled',
                    endedAt,
                    duration,
                    terminationReason: 'abnormal_disconnect'
                  });

                  // Cancel the consultation
                  await Consultation.findByIdAndUpdate(session.consultation, {
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
                const pendingConsultations = await Consultation.find({
                  status: 'pending',
                  bookingType: 'instant',
                  $or: [{ user: userId }, { consultant: userId }],
                });

                for (const pc of pendingConsultations) {
                  await Consultation.findByIdAndUpdate(pc._id, {
                    status: 'cancelled',
                    cancelledAt: new Date(),
                    terminationReason: 'abnormal_disconnect',
                  });
                  await VideoSession.updateMany(
                    { consultation: pc._id, status: 'pending' },
                    { status: 'cancelled', endedAt: new Date(), terminationReason: 'abnormal_disconnect' }
                  );
                }
              }
            } catch (error) {
              logger.error(`Error during socket disconnect cleanup for user ${userId}:`, error);
            } finally {
              disconnectTimers.delete(userId);
            }
          }, config.socket?.disconnectGracePeriodMs ?? 60 * 1000);

          disconnectTimers.set(userId, timer);
        }
      }
    });
  });
};

const emitToUser = (userId: string, event: string, data: any) => {
  //@ts-ignore
  const io = global.io as Server;
  const socketIds = userSocketMap.get(userId);
  if (io && socketIds && socketIds.size > 0) {
    socketIds.forEach(socketId => {
      io.to(socketId).emit(event, data);
    });
  }
};

const emitToRoom = (room: string, event: string, data: any) => {
  //@ts-ignore
  const io = global.io as Server;
  if (io) {
    io.to(room).emit(event, data);
  }
};

const broadcastToAdmins = (event: string, data: any) => {
  //@ts-ignore
  const io = global.io as Server;
  if (io) {
    io.to('admin_room').emit(event, data);
  }
};

const broadcastAll = (event: string, data: any) => {
  //@ts-ignore
  const io = global.io as Server;
  if (io) {
    io.emit(event, data);
  }
};

const disconnectUser = (userId: string) => {
  //@ts-ignore
  const io = global.io as Server;
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

export const socketHelper = {
  socket,
  emitToUser,
  emitToRoom,
  broadcastToAdmins,
  broadcastAll,
  disconnectUser,
};
