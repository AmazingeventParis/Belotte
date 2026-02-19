import { Rank } from '../models/Card.js';

// Card point values in TRUMP suit
export const TRUMP_POINTS: Record<Rank, number> = {
  [Rank.JACK]: 20,
  [Rank.NINE]: 14,
  [Rank.ACE]: 11,
  [Rank.TEN]: 10,
  [Rank.KING]: 4,
  [Rank.QUEEN]: 3,
  [Rank.EIGHT]: 0,
  [Rank.SEVEN]: 0,
};

// Card point values in NON-TRUMP suit
export const NON_TRUMP_POINTS: Record<Rank, number> = {
  [Rank.ACE]: 11,
  [Rank.TEN]: 10,
  [Rank.KING]: 4,
  [Rank.QUEEN]: 3,
  [Rank.JACK]: 2,
  [Rank.NINE]: 0,
  [Rank.EIGHT]: 0,
  [Rank.SEVEN]: 0,
};

// Card strength ordering (index = strength, higher = stronger)
// TRUMP: 7, 8, Q, K, 10, A, 9, J
export const TRUMP_ORDER: Rank[] = [
  Rank.SEVEN, Rank.EIGHT, Rank.QUEEN, Rank.KING,
  Rank.TEN, Rank.ACE, Rank.NINE, Rank.JACK,
];

// NON-TRUMP: 7, 8, 9, J, Q, K, 10, A
export const NON_TRUMP_ORDER: Rank[] = [
  Rank.SEVEN, Rank.EIGHT, Rank.NINE, Rank.JACK,
  Rank.QUEEN, Rank.KING, Rank.TEN, Rank.ACE,
];

export const TOTAL_CARD_POINTS = 152;
export const DIX_DE_DER_BONUS = 10;
export const BELOTE_REBELOTE_BONUS = 20;
export const CAPOT_TOTAL = 250;
export const MIN_BID = 80;
export const BID_INCREMENT = 10;
export const MAX_BID = 250;
export const WINNING_SCORE = 1501;
export const MATCHMAKING_TIMEOUT_MS = 8000;
export const INACTIVITY_TIMEOUT_MS = 20000;
export const RECONNECTION_WINDOW_MS = 60000;
export const PLAYERS_PER_GAME = 4;
export const CARDS_PER_PLAYER = 8;
export const TRICKS_PER_HAND = 8;
