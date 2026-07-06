export type GameChoice = 'SPLIT' | 'STEAL';

export interface PayoutResult {
  player1CoinsChange: number; // Coins returned to player 1 (from pot)
  player2CoinsChange: number; // Coins returned to player 2 (from pot)
  vaultContribution: number;  // Coins lost to the public vault
}

export function calculatePayout(
  choice1: GameChoice,
  choice2: GameChoice,
  stake: number,
  bonus: number
): PayoutResult {
  if (choice1 === 'SPLIT' && choice2 === 'SPLIT') {
    return {
      player1CoinsChange: stake + bonus,
      player2CoinsChange: stake + bonus,
      vaultContribution: 0,
    };
  } else if (choice1 === 'STEAL' && choice2 === 'SPLIT') {
    return {
      player1CoinsChange: stake * 2,
      player2CoinsChange: 0,
      vaultContribution: 0,
    };
  } else if (choice1 === 'SPLIT' && choice2 === 'STEAL') {
    return {
      player1CoinsChange: 0,
      player2CoinsChange: stake * 2,
      vaultContribution: 0,
    };
  } else {
    // Both STEAL
    return {
      player1CoinsChange: 0,
      player2CoinsChange: 0,
      vaultContribution: stake * 2,
    };
  }
}

export function calculateEloChange(
  playerElo: number,
  opponentElo: number,
  playerChoice: GameChoice,
  opponentChoice: GameChoice,
  kFactor: number = 32
): number {
  let score = 0.5; // Default to draw (SPLIT/SPLIT or STEAL/STEAL)
  
  if (playerChoice === 'STEAL' && opponentChoice === 'SPLIT') {
    score = 1; // Betrayer wins ELO
  } else if (playerChoice === 'SPLIT' && opponentChoice === 'STEAL') {
    score = 0; // Betrayed loses ELO
  }

  const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  return Math.round(kFactor * (score - expectedScore));
}
