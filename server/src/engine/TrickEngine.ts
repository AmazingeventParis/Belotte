import { Card, Suit, Rank, cardEquals } from '../models/Card.js';
import { TRUMP_ORDER, NON_TRUMP_ORDER, TRUMP_POINTS, NON_TRUMP_POINTS } from '../config/constants.js';
import { getTeamIndex } from '../models/Player.js';

export interface PlayedCard {
  seatIndex: number;
  card: Card;
}

export interface TrickState {
  cardsPlayed: PlayedCard[];
  leadSuit: Suit | null;
  trickNumber: number;
}

export function createTrickState(trickNumber: number): TrickState {
  return {
    cardsPlayed: [],
    leadSuit: null,
    trickNumber,
  };
}

function getCardStrength(card: Card, trumpSuit: Suit): number {
  const order = card.suit === trumpSuit ? TRUMP_ORDER : NON_TRUMP_ORDER;
  return order.indexOf(card.rank);
}

export function getCardPoints(card: Card, trumpSuit: Suit): number {
  return card.suit === trumpSuit
    ? TRUMP_POINTS[card.rank]
    : NON_TRUMP_POINTS[card.rank];
}

export function getTrickPoints(trick: TrickState, trumpSuit: Suit): number {
  return trick.cardsPlayed.reduce((sum, pc) => sum + getCardPoints(pc.card, trumpSuit), 0);
}

export function determineTrickWinner(trick: TrickState, trumpSuit: Suit): number {
  if (trick.cardsPlayed.length !== 4) {
    throw new Error('Trick must have exactly 4 cards');
  }

  const leadSuit = trick.cardsPlayed[0].card.suit;
  let winnerIndex = 0;
  let winnerCard = trick.cardsPlayed[0].card;
  let winnerIsTrump = winnerCard.suit === trumpSuit;

  for (let i = 1; i < 4; i++) {
    const current = trick.cardsPlayed[i].card;
    const currentIsTrump = current.suit === trumpSuit;

    if (currentIsTrump && !winnerIsTrump) {
      // Trump beats non-trump
      winnerIndex = i;
      winnerCard = current;
      winnerIsTrump = true;
    } else if (currentIsTrump && winnerIsTrump) {
      // Both trump: compare strength
      if (getCardStrength(current, trumpSuit) > getCardStrength(winnerCard, trumpSuit)) {
        winnerIndex = i;
        winnerCard = current;
      }
    } else if (!currentIsTrump && !winnerIsTrump && current.suit === leadSuit) {
      // Both non-trump, same lead suit: compare strength
      if (winnerCard.suit !== leadSuit || getCardStrength(current, trumpSuit) > getCardStrength(winnerCard, trumpSuit)) {
        winnerIndex = i;
        winnerCard = current;
      }
    }
    // Cards that are neither trump nor lead suit cannot win
  }

  return trick.cardsPlayed[winnerIndex].seatIndex;
}

function getCurrentTrickWinner(trick: TrickState, trumpSuit: Suit): number | null {
  if (trick.cardsPlayed.length === 0) return null;

  const leadSuit = trick.cardsPlayed[0].card.suit;
  let winnerIdx = 0;
  let winnerCard = trick.cardsPlayed[0].card;
  let winnerIsTrump = winnerCard.suit === trumpSuit;

  for (let i = 1; i < trick.cardsPlayed.length; i++) {
    const current = trick.cardsPlayed[i].card;
    const currentIsTrump = current.suit === trumpSuit;

    if (currentIsTrump && !winnerIsTrump) {
      winnerIdx = i;
      winnerCard = current;
      winnerIsTrump = true;
    } else if (currentIsTrump && winnerIsTrump) {
      if (getCardStrength(current, trumpSuit) > getCardStrength(winnerCard, trumpSuit)) {
        winnerIdx = i;
        winnerCard = current;
      }
    } else if (!currentIsTrump && !winnerIsTrump && current.suit === leadSuit) {
      if (winnerCard.suit !== leadSuit || getCardStrength(current, trumpSuit) > getCardStrength(winnerCard, trumpSuit)) {
        winnerIdx = i;
        winnerCard = current;
      }
    }
  }

  return trick.cardsPlayed[winnerIdx].seatIndex;
}

function getHighestTrumpStrengthInTrick(trick: TrickState, trumpSuit: Suit): number {
  let highest = -1;
  for (const pc of trick.cardsPlayed) {
    if (pc.card.suit === trumpSuit) {
      const strength = getCardStrength(pc.card, trumpSuit);
      if (strength > highest) highest = strength;
    }
  }
  return highest;
}

export function getLegalCards(
  hand: Card[],
  trick: TrickState,
  trumpSuit: Suit,
  playerSeat: number,
): Card[] {
  // Leading: any card is legal
  if (trick.cardsPlayed.length === 0) {
    return [...hand];
  }

  const leadSuit = trick.cardsPlayed[0].card.suit;
  const cardsOfLeadSuit = hand.filter(c => c.suit === leadSuit);
  const trumpCards = hand.filter(c => c.suit === trumpSuit);
  const currentWinnerSeat = getCurrentTrickWinner(trick, trumpSuit);
  const partnerIsWinning = currentWinnerSeat !== null && getTeamIndex(currentWinnerSeat) === getTeamIndex(playerSeat);

  if (leadSuit === trumpSuit) {
    // Lead suit is trump
    if (trumpCards.length > 0) {
      // Must play trump, must play higher if possible
      const highestTrumpInTrick = getHighestTrumpStrengthInTrick(trick, trumpSuit);
      const higherTrumps = trumpCards.filter(c => getCardStrength(c, trumpSuit) > highestTrumpInTrick);
      if (higherTrumps.length > 0) return higherTrumps;
      return trumpCards; // Must play trump even if can't go higher
    }
    // No trump: play anything
    return [...hand];
  }

  // Lead suit is not trump
  if (cardsOfLeadSuit.length > 0) {
    // Must follow suit
    return cardsOfLeadSuit;
  }

  // Cannot follow suit
  if (partnerIsWinning) {
    // Partner is winning: no obligation to trump, play anything
    return [...hand];
  }

  // Partner is NOT winning: must trump if possible
  if (trumpCards.length > 0) {
    const highestTrumpInTrick = getHighestTrumpStrengthInTrick(trick, trumpSuit);
    if (highestTrumpInTrick >= 0) {
      // A trump has already been played: must play higher trump if possible
      const higherTrumps = trumpCards.filter(c => getCardStrength(c, trumpSuit) > highestTrumpInTrick);
      if (higherTrumps.length > 0) return higherTrumps;
      // Can't play higher trump, but must still play a trump
      return trumpCards;
    }
    // No trump played yet in trick: play any trump
    return trumpCards;
  }

  // No trump cards either: play anything
  return [...hand];
}

export function playCard(trick: TrickState, seatIndex: number, card: Card): TrickState {
  const newTrick: TrickState = {
    ...trick,
    cardsPlayed: [...trick.cardsPlayed, { seatIndex, card }],
    leadSuit: trick.cardsPlayed.length === 0 ? card.suit : trick.leadSuit,
  };
  return newTrick;
}

export function isTrickComplete(trick: TrickState): boolean {
  return trick.cardsPlayed.length === 4;
}
