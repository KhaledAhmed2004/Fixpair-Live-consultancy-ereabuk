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

const userSocketMap = new Map<string, string>();
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

    if (userId) {
      userSocketMap.set(userId, socket.id);
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
        userSocketMap.delete(userId);
        logger.info(colors.red(`User disconnected: ${userId}`));

        // Start a 3-minute grace period before cleaning up active sessions
        const timer = setTimeout(async () => {
          try {
            // Check if user is still disconnected
            if (!userSocketMap.has(userId)) {
              logger.info(`Cleaning up stale sessions for disconnected user: ${userId}`);
              
              // Find ongoing sessions where this user is either user or consultant
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
            }
          } catch (error) {
            logger.error(`Error during socket disconnect cleanup for user ${userId}:`, error);
          } finally {
            disconnectTimers.delete(userId);
          }
        }, 3 * 60 * 1000); // 3 minutes

        disconnectTimers.set(userId, timer);
      }
    });
  });
};

const emitToUser = (userId: string, event: string, data: any) => {
  //@ts-ignore
  const io = global.io as Server;
  const socketId = userSocketMap.get(userId);
  if (io && socketId) {
    io.to(socketId).emit(event, data);
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

export const socketHelper = { socket, emitToUser, emitToRoom, broadcastToAdmins };
