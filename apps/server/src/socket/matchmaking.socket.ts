import { Server, Socket } from 'socket.io';
import { prisma } from '@greeed/database';
import { SOCKET_EVENTS, getRankFromElo } from '@greeed/shared';
import { startMatch } from './match.socket';

interface QueuePlayer {
  userId: string;
  username: string;
  elo: number;
  socketId: string;
  joinedAt: number;
}

const matchmakingQueue: QueuePlayer[] = [];
const ELO_THRESHOLD = 200;

export function handleMatchmaking(io: Server, socket: Socket, userId: string, username: string) {
  
  socket.on(SOCKET_EVENTS.JOIN_QUEUE, async () => {
    try {
      let user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            id: userId,
            username: username,
            passwordHash: 'dummy-hash',
            elo: 1000,
            coins: 1000,
          },
        });
      }

      const alreadyInQueue = matchmakingQueue.some(p => p.userId === userId);
      if (alreadyInQueue) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Already in queue' });
        return;
      }

      const player: QueuePlayer = {
        userId,
        username: user.username,
        elo: user.elo,
        socketId: socket.id,
        joinedAt: Date.now(),
      };

      matchmakingQueue.push(player);
      console.log(`Player joined queue: ${player.username} (ELO: ${player.elo}). Queue size: ${matchmakingQueue.length}`);
      
      socket.emit(SOCKET_EVENTS.QUEUE_UPDATE, { inQueue: true, queueLength: matchmakingQueue.length });

      checkForMatches(io);
    } catch (error) {
      console.error('Error joining matchmaking queue:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to join matchmaking' });
    }
  });

  socket.on(SOCKET_EVENTS.LEAVE_QUEUE, () => {
    removeFromQueue(userId);
    socket.emit(SOCKET_EVENTS.QUEUE_UPDATE, { inQueue: false, queueLength: matchmakingQueue.length });
  });

  socket.on('disconnect', () => {
    removeFromQueue(userId);
  });
}

function removeFromQueue(userId: string) {
  const index = matchmakingQueue.findIndex(p => p.userId === userId);
  if (index !== -1) {
    const removed = matchmakingQueue.splice(index, 1)[0];
    console.log(`Player left queue: ${removed.username}. Queue size: ${matchmakingQueue.length}`);
  }
}

async function checkForMatches(io: Server) {
  if (matchmakingQueue.length < 2) return;

  matchmakingQueue.sort((a, b) => a.elo - b.elo);

  for (let i = 0; i < matchmakingQueue.length - 1; i++) {
    const playerA = matchmakingQueue[i];
    const playerB = matchmakingQueue[i + 1];

    if (Math.abs(playerA.elo - playerB.elo) <= ELO_THRESHOLD) {
      matchmakingQueue.splice(i, 2);
      
      try {
        const match = await prisma.match.create({
          data: {
            player1Id: playerA.userId,
            player2Id: playerB.userId,
            status: 'CHAT',
          },
        });

        const socketA = io.sockets.sockets.get(playerA.socketId);
        const socketB = io.sockets.sockets.get(playerB.socketId);

        const roomName = `match:${match.id}`;

        if (socketA) socketA.join(roomName);
        if (socketB) socketB.join(roomName);

        const userA = await prisma.user.findUnique({ where: { id: playerA.userId } });
        const userB = await prisma.user.findUnique({ where: { id: playerB.userId } });

        const getStats = (user: any) => {
          const totalGames = user.splitCount + user.stealCount;
          return {
            id: user.id,
            username: user.username,
            elo: user.elo,
            rank: getRankFromElo(user.elo),
            coins: user.coins,
            splitRate: totalGames > 0 ? Math.round((user.splitCount / totalGames) * 100) : 0,
            stealRate: totalGames > 0 ? Math.round((user.stealCount / totalGames) * 100) : 0,
            choiceLocked: false,
          };
        };

        const playerAProfile = getStats(userA);
        const playerBProfile = getStats(userB);

        // Start the in-memory match states and countdown timer loops
        startMatch(io, match.id, playerAProfile, playerBProfile);

        if (socketA) {
          socketA.emit(SOCKET_EVENTS.MATCH_FOUND, {
            matchId: match.id,
            role: 'player1',
            self: playerAProfile,
            opponent: playerBProfile,
            stake: 100,
          });
        }

        if (socketB) {
          socketB.emit(SOCKET_EVENTS.MATCH_FOUND, {
            matchId: match.id,
            role: 'player2',
            self: playerBProfile,
            opponent: playerAProfile,
            stake: 100,
          });
        }

        console.log(`Match created: ${match.id} between ${playerA.username} and ${playerB.username}`);
      } catch (dbErr) {
        console.error('Failed to create match in database:', dbErr);
      }

      i--;
    }
  }
}
