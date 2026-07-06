import { RankTier } from './ranks';
import { GameChoice } from './gameRules';

export interface UserStats {
  splitCount: number;
  stealCount: number;
  betrayedOthersCount: number; // Chose STEAL while opponent chose SPLIT
  beenBetrayedCount: number;    // Chose SPLIT while opponent chose STEAL
  mutualTrustCount: number;     // Both SPLIT
  mutualGreedCount: number;     // Both STEAL
  longestTrustStreak: number;
  currentTrustStreak: number;
  biggestSteal: number;
  biggestLoss: number;
}

export interface UserProfile {
  id: string;
  username: string;
  elo: number;
  rank: RankTier;
  coins: number;
  stats: UserStats;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export type MatchStatus = 'CHAT' | 'DECISION' | 'REVEALED';

export interface MatchPlayer {
  id: string;
  username: string;
  elo: number;
  rank: RankTier;
  coins: number;
  splitRate: number;
  stealRate: number;
  choiceLocked: boolean;
  signalLight?: 'GREEN' | 'RED';
}

export interface MatchState {
  matchId: string;
  status: MatchStatus;
  player1: MatchPlayer;
  player2: MatchPlayer;
  timerRemaining: number;
  messages: ChatMessage[];
  stake: number;
  payoutResult?: {
    player1Choice: GameChoice;
    player2Choice: GameChoice;
    player1CoinsChange: number;
    player2CoinsChange: number;
    player1EloChange: number;
    player2EloChange: number;
    vaultContribution: number;
  };
}
