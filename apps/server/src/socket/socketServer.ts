import { Server, Socket } from 'socket.io';
import http from 'http';
import { handleMatchmaking } from './matchmaking.socket';

export let io: Server;

export const userSocketMap = new Map<string, string>();
export const socketUserMap = new Map<string, string>();

export function initSocketServer(server: http.Server) {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.handshake.auth.userId || socket.handshake.query.userId;
    const username = socket.handshake.auth.username || socket.handshake.query.username;

    if (!userId) {
      console.log(`Connection rejected: Missing userId`);
      socket.disconnect();
      return;
    }

    console.log(`User connected: ${username || 'Anonymous'} (${userId}) on socket ${socket.id}`);
    
    userSocketMap.set(userId, socket.id);
    socketUserMap.set(socket.id, userId);

    // Initialize matchmaking listener for this user
    handleMatchmaking(io, socket, userId, username || 'Anonymous');

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${userId}`);
      userSocketMap.delete(userId);
      socketUserMap.delete(socket.id);
    });
  });

  return io;
}
