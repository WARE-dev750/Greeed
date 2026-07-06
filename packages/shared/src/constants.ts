export const INITIAL_COINS = 1000;
export const MATCH_STAKE = 100;
export const WIN_BONUS = 20; 
export const SIGNAL_ACCURACY = 0.65; 

// Allow overrides for testing
const isTest = process.env.NODE_ENV === 'test';
export const CHAT_DURATION_SECONDS = isTest ? 3 : 180; 
export const DECISION_DURATION_SECONDS = isTest ? 3 : 15; 

export const INITIAL_ELO = 1000;
export const K_FACTOR = 32; 
