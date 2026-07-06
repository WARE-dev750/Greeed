import { Server, Socket } from 'socket.io';
import { prisma } from '@greeed/database';
import { 
  SOCKET_EVENTS, 
  calculatePayout, 
  calculateEloChange, 
  getRankFromElo, 
  GameChoice, 
  MatchPlayer, 
  MatchState,
  SIGNAL_ACCURACY,
  CHAT_DURATION_SECONDS,
  DECISION_DURATION_SECONDS,
  MATCH_STAKE,
  WIN_BONUS
} from '@greeed/shared';

interface InMemoryMatch {
  state: MatchState;
  player1Tentative?: GameChoice;
  player2Tentative?: GameChoice;
  player1Final?: GameChoice;
  player2Final?: GameChoice;
  intervalId?: NodeJS.Timeout;
}

export const activeMatches = new Map<string, InMemoryMatch>();

export function startMatch(io: Server, matchId: string, p1Profile: any, p2Profile: any) {
  const initialState: MatchState = {
    matchId,
    status: 'CHAT',
    player1: { ...p1Profile, choiceLocked: false },
    player2: { ...p2Profile, choiceLocked: false },
    timerRemaining: CHAT_DURATION_SECONDS,
    messages: [],
    stake: MATCH_STAKE,
  };

  const inMemory: InMemoryMatch = {
    state: initialState,
  };

  activeMatches.set(matchId, inMemory);

  const roomName = `match:${matchId}`;

  // Start the timer loop
  const intervalId = setInterval(async () => {
    const match = activeMatches.get(matchId);
    if (!match) {
      clearInterval(intervalId);
      return;
    }

    match.state.timerRemaining--;

    if (match.state.timerRemaining <= 0) {
      if (match.state.status === 'CHAT') {
        // Transition to decision phase
        match.state.status = 'DECISION';
        match.state.timerRemaining = DECISION_DURATION_SECONDS;
        io.to(roomName).emit(SOCKET_EVENTS.ROOM_STATE, match.state);
        console.log(`Match ${matchId} transitioned to DECISION phase`);
      } else if (match.state.status === 'DECISION') {
        // Time is up in decision phase, resolve the match
        clearInterval(intervalId);
        await resolveMatch(io, matchId);
      }
    } else {
      io.to(roomName).emit(SOCKET_EVENTS.TIMER_TICK, { timerRemaining: match.state.timerRemaining });
    }
  }, 1000);

  inMemory.intervalId = intervalId;
}

export function handleMatch(io: Server, socket: Socket, userId: string) {
  
  socket.on(SOCKET_EVENTS.JOIN_ROOM, ({ matchId }: { matchId: string }) => {
    const match = activeMatches.get(matchId);
    if (!match) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Match not found' });
      return;
    }

    const roomName = `match:${matchId}`;
    socket.join(roomName);

    // Send latest state back to the user
    socket.emit(SOCKET_EVENTS.ROOM_STATE, match.state);
  });

  socket.on(SOCKET_EVENTS.SEND_MESSAGE, async ({ matchId, text }: { matchId: string; text: string }) => {
    const match = activeMatches.get(matchId);
    if (!match) return;

    try {
      const dbMsg = await prisma.chatMessage.create({
        data: {
          matchId,
          senderId: userId,
          text,
        },
      });

      const senderName = userId === match.state.player1.id ? match.state.player1.username : match.state.player2.username;

      const chatMsg = {
        id: dbMsg.id,
        senderId: userId,
        senderName,
        text,
        timestamp: dbMsg.createdAt.getTime(),
      };

      match.state.messages.push(chatMsg);

      io.to(`match:${matchId}`).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, chatMsg);
    } catch (err) {
      console.error('Error saving chat message:', err);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to send message' });
    }
  });

  socket.on(SOCKET_EVENTS.SELECT_TENTATIVE, ({ matchId, choice }: { matchId: string; choice: GameChoice }) => {
    const match = activeMatches.get(matchId);
    if (!match || match.state.status !== 'DECISION') return;

    const isPlayer1 = userId === match.state.player1.id;
    const isPlayer2 = userId === match.state.player2.id;

    if (!isPlayer1 && !isPlayer2) return;

    // Check if player is already locked in
    if (isPlayer1 && match.state.player1.choiceLocked) return;
    if (isPlayer2 && match.state.player2.choiceLocked) return;

    // Save selection
    if (isPlayer1) {
      match.player1Tentative = choice;
    } else {
      match.player2Tentative = choice;
    }

    // Roll 65% accuracy signal light
    const rollTruth = Math.random() < SIGNAL_ACCURACY;
    const signal: 'GREEN' | 'RED' = rollTruth 
      ? (choice === 'SPLIT' ? 'GREEN' : 'RED') 
      : (choice === 'SPLIT' ? 'RED' : 'GREEN');

    // Show signal light to opponent
    if (isPlayer1) {
      match.state.player1.signalLight = signal;
    } else {
      match.state.player2.signalLight = signal;
    }

    // Broadcast signal update to room
    io.to(`match:${matchId}`).emit(SOCKET_EVENTS.SIGNAL_UPDATE, {
      player1Signal: match.state.player1.signalLight,
      player2Signal: match.state.player2.signalLight,
    });
  });

  socket.on(SOCKET_EVENTS.SUBMIT_CHOICE, async ({ matchId, choice }: { matchId: string; choice: GameChoice }) => {
    const match = activeMatches.get(matchId);
    if (!match || match.state.status !== 'DECISION') return;

    const isPlayer1 = userId === match.state.player1.id;
    const isPlayer2 = userId === match.state.player2.id;

    if (!isPlayer1 && !isPlayer2) return;

    // Save final choice
    if (isPlayer1) {
      if (match.state.player1.choiceLocked) return;
      match.player1Final = choice;
      match.state.player1.choiceLocked = true;
    } else {
      if (match.state.player2.choiceLocked) return;
      match.player2Final = choice;
      match.state.player2.choiceLocked = true;
    }

    socket.emit(SOCKET_EVENTS.CHOICE_LOCKED, { choiceLocked: true });

    // Notify the room that a player has locked in (choices remain hidden!)
    io.to(`match:${matchId}`).emit(SOCKET_EVENTS.ROOM_STATE, match.state);

    // If both are locked in, resolve immediately
    if (match.state.player1.choiceLocked && match.state.player2.choiceLocked) {
      if (match.intervalId) {
        clearInterval(match.intervalId);
      }
      await resolveMatch(io, matchId);
    }
  });
}

async function resolveMatch(io: Server, matchId: string) {
  const match = activeMatches.get(matchId);
  if (!match) return;

  const roomName = `match:${matchId}`;
  
  // Clean up cache entry
  activeMatches.delete(matchId);

  const choice1 = match.player1Final || 'STEAL'; // Defaults to STEAL on timeout
  const choice2 = match.player2Final || 'STEAL';

  const p1Id = match.state.player1.id;
  const p2Id = match.state.player2.id;

  try {
    // 1. Fetch current users from database
    const [u1, u2] = await Promise.all([
      prisma.user.findUnique({ where: { id: p1Id } }),
      prisma.user.findUnique({ where: { id: p2Id } }),
    ]);

    if (!u1 || !u2) {
      throw new Error(`One or more match players not found in database`);
    }

    // 2. Calculate payouts & Elo changes
    const payoutResult = calculatePayout(choice1, choice2, MATCH_STAKE, WIN_BONUS);
    const eloChange1 = calculateEloChange(u1.elo, u2.elo, choice1, choice2);
    const eloChange2 = calculateEloChange(u2.elo, u1.elo, choice2, choice1);

    const coins1_new = Math.max(0, u1.coins - MATCH_STAKE + payoutResult.player1CoinsChange);
    const coins2_new = Math.max(0, u2.coins - MATCH_STAKE + payoutResult.player2CoinsChange);

    const elo1_new = Math.max(0, u1.elo + eloChange1);
    const elo2_new = Math.max(0, u2.elo + eloChange2);

    // 3. Compute trust streaks
    const currentStreak1 = choice1 === 'SPLIT' ? u1.currentTrustStreak + 1 : 0;
    const longestStreak1 = Math.max(u1.longestTrustStreak, currentStreak1);

    const currentStreak2 = choice2 === 'SPLIT' ? u2.currentTrustStreak + 1 : 0;
    const longestStreak2 = Math.max(u2.longestTrustStreak, currentStreak2);

    // 4. Update database in transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: p1Id },
        data: {
          coins: coins1_new,
          elo: elo1_new,
          splitCount: u1.splitCount + (choice1 === 'SPLIT' ? 1 : 0),
          stealCount: u1.stealCount + (choice1 === 'STEAL' ? 1 : 0),
          mutualTrustCount: u1.mutualTrustCount + (choice1 === 'SPLIT' && choice2 === 'SPLIT' ? 1 : 0),
          mutualGreedCount: u1.mutualGreedCount + (choice1 === 'STEAL' && choice2 === 'STEAL' ? 1 : 0),
          betrayedOthersCount: u1.betrayedOthersCount + (choice1 === 'STEAL' && choice2 === 'SPLIT' ? 1 : 0),
          beenBetrayedCount: u1.beenBetrayedCount + (choice1 === 'SPLIT' && choice2 === 'STEAL' ? 1 : 0),
          currentTrustStreak: currentStreak1,
          longestTrustStreak: longestStreak1,
          biggestSteal: choice1 === 'STEAL' && choice2 === 'SPLIT' ? Math.max(u1.biggestSteal, MATCH_STAKE) : u1.biggestSteal,
          biggestLoss: choice1 === 'SPLIT' && choice2 === 'STEAL' ? Math.max(u1.biggestLoss, MATCH_STAKE) : u1.biggestLoss,
        },
      }),
      prisma.user.update({
        where: { id: p2Id },
        data: {
          coins: coins2_new,
          elo: elo2_new,
          splitCount: u2.splitCount + (choice2 === 'SPLIT' ? 1 : 0),
          stealCount: u2.stealCount + (choice2 === 'STEAL' ? 1 : 0),
          mutualTrustCount: u2.mutualTrustCount + (choice1 === 'SPLIT' && choice2 === 'SPLIT' ? 1 : 0),
          mutualGreedCount: u2.mutualGreedCount + (choice1 === 'STEAL' && choice2 === 'STEAL' ? 1 : 0),
          betrayedOthersCount: u2.betrayedOthersCount + (choice2 === 'STEAL' && choice1 === 'SPLIT' ? 1 : 0),
          beenBetrayedCount: u2.beenBetrayedCount + (choice2 === 'SPLIT' && choice1 === 'STEAL' ? 1 : 0),
          currentTrustStreak: currentStreak2,
          longestTrustStreak: longestStreak2,
          biggestSteal: choice2 === 'STEAL' && choice1 === 'SPLIT' ? Math.max(u2.biggestSteal, MATCH_STAKE) : u2.biggestSteal,
          biggestLoss: choice2 === 'SPLIT' && choice1 === 'STEAL' ? Math.max(u2.biggestLoss, MATCH_STAKE) : u2.biggestLoss,
        },
      }),
      prisma.match.update({
        where: { id: matchId },
        data: {
          status: 'REVEALED',
          player1Choice: choice1,
          player2Choice: choice2,
          payout1: payoutResult.player1CoinsChange,
          payout2: payoutResult.player2CoinsChange,
          eloChange1: eloChange1,
          eloChange2: eloChange2,
          vaultContribution: payoutResult.vaultContribution,
        },
      }),
    ]);

    // 5. Broadcast final result reveal
    const finalResult = {
      matchId,
      player1Choice: choice1,
      player2Choice: choice2,
      player1CoinsChange: payoutResult.player1CoinsChange - MATCH_STAKE, // Net change
      player2CoinsChange: payoutResult.player2CoinsChange - MATCH_STAKE,
      player1EloChange: eloChange1,
      player2EloChange: eloChange2,
      player1NewElo: elo1_new,
      player2NewElo: elo2_new,
      player1NewRank: getRankFromElo(elo1_new),
      player2NewRank: getRankFromElo(elo2_new),
      vaultContribution: payoutResult.vaultContribution,
    };

    io.to(roomName).emit(SOCKET_EVENTS.MATCH_RESULT, finalResult);
    console.log(`Match ${matchId} resolved. Choices: P1=${choice1}, P2=${choice2}.`);

  } catch (err) {
    console.error(`Failed to resolve match ${matchId}:`, err);
    io.to(roomName).emit(SOCKET_EVENTS.ERROR, { message: 'Database failure during match resolution' });
  }
}
