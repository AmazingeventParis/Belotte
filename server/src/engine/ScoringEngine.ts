import { Card, Suit, Rank } from '../models/Card.js';
import { Contract } from './BiddingEngine.js';
import { TrickState, getTrickPoints, determineTrickWinner } from './TrickEngine.js';
import { getTeamIndex } from '../models/Player.js';
import {
  DIX_DE_DER_BONUS,
  BELOTE_REBELOTE_BONUS,
  CAPOT_TOTAL,
  TOTAL_CARD_POINTS,
} from '../config/constants.js';

export interface HandResult {
  teamPoints: [number, number]; // raw card points per team (including dix de der)
  tricksWon: [number, number]; // tricks won per team
  beloteRebeloteTeam: number | null; // team index that has belote-rebelote, or null
  isCapot: boolean;
  capotTeam: number | null; // team that achieved capot
  lastTrickWinnerTeam: number;
  contractMade: boolean;
  scoreDeltas: [number, number]; // final points added to each team's total
}

export function hasBeloteRebelote(hand: Card[], trumpSuit: Suit): boolean {
  const hasKing = hand.some(c => c.suit === trumpSuit && c.rank === Rank.KING);
  const hasQueen = hand.some(c => c.suit === trumpSuit && c.rank === Rank.QUEEN);
  return hasKing && hasQueen;
}

export function computeHandResult(
  tricks: TrickState[],
  contract: Contract,
  trumpSuit: Suit,
  beloteRebeloteTeam: number | null,
): HandResult {
  if (tricks.length !== 8) {
    throw new Error('Hand must have exactly 8 tricks');
  }

  // Compute raw points and tricks won per team
  const teamPoints: [number, number] = [0, 0];
  const tricksWon: [number, number] = [0, 0];

  for (const trick of tricks) {
    const winnerSeat = determineTrickWinner(trick, trumpSuit);
    const winnerTeam = getTeamIndex(winnerSeat);
    const points = getTrickPoints(trick, trumpSuit);
    teamPoints[winnerTeam] += points;
    tricksWon[winnerTeam]++;
  }

  // Dix de der: +10 for the team that won the last trick
  const lastTrickWinner = determineTrickWinner(tricks[7], trumpSuit);
  const lastTrickWinnerTeam = getTeamIndex(lastTrickWinner);
  teamPoints[lastTrickWinnerTeam] += DIX_DE_DER_BONUS;

  // Check for capot
  const isCapot = tricksWon[0] === 8 || tricksWon[1] === 8;
  const capotTeam = tricksWon[0] === 8 ? 0 : tricksWon[1] === 8 ? 1 : null;

  // Determine if contract is made
  const attackingTeam = contract.teamIndex;
  const defendingTeam = attackingTeam === 0 ? 1 : 0;

  let contractMade: boolean;
  if (isCapot) {
    // Capot always means the capot team made their contract (if they're attacking)
    // or the defending team broke the contract (if attacker didn't get capot)
    contractMade = capotTeam === attackingTeam;
  } else {
    contractMade = teamPoints[attackingTeam] >= contract.value;
  }

  // Compute score deltas
  const scoreDeltas: [number, number] = [0, 0];

  if (isCapot) {
    // Capot scoring: capot team gets 250 (or contract value if higher), other team gets 0
    if (contractMade) {
      // Attacking team achieved capot
      const baseScore = Math.max(CAPOT_TOTAL, contract.value);
      scoreDeltas[attackingTeam] = baseScore * contract.multiplier;
      scoreDeltas[defendingTeam] = 0;
    } else {
      // Defending team achieved capot (attacker failed spectacularly)
      scoreDeltas[defendingTeam] = (TOTAL_CARD_POINTS + DIX_DE_DER_BONUS + contract.value) * contract.multiplier;
      scoreDeltas[attackingTeam] = 0;
    }
  } else if (contractMade) {
    if (contract.multiplier === 1) {
      // Normal: each team keeps their points
      scoreDeltas[attackingTeam] = teamPoints[attackingTeam];
      scoreDeltas[defendingTeam] = teamPoints[defendingTeam];
    } else {
      // Coinche/Surcoinche made: attacking team gets contract * multiplier
      scoreDeltas[attackingTeam] = contract.value * contract.multiplier;
      scoreDeltas[defendingTeam] = 0;
    }
  } else {
    // Contract failed (chute)
    scoreDeltas[attackingTeam] = 0;
    scoreDeltas[defendingTeam] = (TOTAL_CARD_POINTS + DIX_DE_DER_BONUS + contract.value) * contract.multiplier;
  }

  // Belote-Rebelote: always added regardless of contract result
  if (beloteRebeloteTeam !== null) {
    scoreDeltas[beloteRebeloteTeam] += BELOTE_REBELOTE_BONUS;
  }

  return {
    teamPoints,
    tricksWon,
    beloteRebeloteTeam,
    isCapot,
    capotTeam,
    lastTrickWinnerTeam,
    contractMade,
    scoreDeltas,
  };
}
