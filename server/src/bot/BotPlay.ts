import { Card, Suit, Rank } from '../models/Card.js';
import { TrickState, getLegalCards, getCardPoints } from '../engine/TrickEngine.js';
import { TRUMP_ORDER, NON_TRUMP_ORDER } from '../config/constants.js';
import { getTeamIndex } from '../models/Player.js';

function getCardStrength(card: Card, trumpSuit: Suit): number {
  const order = card.suit === trumpSuit ? TRUMP_ORDER : NON_TRUMP_ORDER;
  return order.indexOf(card.rank);
}

function sortByPoints(cards: Card[], trumpSuit: Suit, ascending: boolean): Card[] {
  return [...cards].sort((a, b) => {
    const diff = getCardPoints(a, trumpSuit) - getCardPoints(b, trumpSuit);
    return ascending ? diff : -diff;
  });
}

function sortByStrength(cards: Card[], trumpSuit: Suit, ascending: boolean): Card[] {
  return [...cards].sort((a, b) => {
    const diff = getCardStrength(a, trumpSuit) - getCardStrength(b, trumpSuit);
    return ascending ? diff : -diff;
  });
}

export function botDecideCard(
  hand: Card[],
  trick: TrickState,
  trumpSuit: Suit,
  seatIndex: number,
): Card {
  const legalCards = getLegalCards(hand, trick, trumpSuit, seatIndex);

  if (legalCards.length === 1) {
    return legalCards[0];
  }

  // Leading (first to play)
  if (trick.cardsPlayed.length === 0) {
    return decideLead(legalCards, hand, trumpSuit);
  }

  // Following
  return decideFollow(legalCards, trick, trumpSuit, seatIndex);
}

function decideLead(legalCards: Card[], hand: Card[], trumpSuit: Suit): Card {
  const trumpCards = legalCards.filter(c => c.suit === trumpSuit);
  const nonTrumpCards = legalCards.filter(c => c.suit !== trumpSuit);

  // Lead with Jack of trump if we have it (draw out enemy trump)
  const jackOfTrump = trumpCards.find(c => c.rank === Rank.JACK);
  if (jackOfTrump && trumpCards.length >= 3) {
    return jackOfTrump;
  }

  // Lead with a side Ace
  const aces = nonTrumpCards.filter(c => c.rank === Rank.ACE);
  if (aces.length > 0) {
    return aces[0];
  }

  // Lead with lowest non-trump card
  if (nonTrumpCards.length > 0) {
    return sortByPoints(nonTrumpCards, trumpSuit, true)[0];
  }

  // Only trump left: lead lowest
  return sortByStrength(trumpCards, trumpSuit, true)[0];
}

function decideFollow(
  legalCards: Card[],
  trick: TrickState,
  trumpSuit: Suit,
  seatIndex: number,
): Card {
  const leadSuit = trick.cardsPlayed[0].card.suit;
  const partnerSeat = (seatIndex + 2) % 4;

  // Check if partner is currently winning
  let currentWinnerSeat = 0;
  let currentWinnerStrength = -1;
  let currentWinnerIsTrump = false;

  for (let i = 0; i < trick.cardsPlayed.length; i++) {
    const pc = trick.cardsPlayed[i];
    const isTrump = pc.card.suit === trumpSuit;
    const strength = getCardStrength(pc.card, trumpSuit);

    if (isTrump && !currentWinnerIsTrump) {
      currentWinnerSeat = pc.seatIndex;
      currentWinnerStrength = strength;
      currentWinnerIsTrump = true;
    } else if (isTrump && currentWinnerIsTrump && strength > currentWinnerStrength) {
      currentWinnerSeat = pc.seatIndex;
      currentWinnerStrength = strength;
    } else if (!isTrump && !currentWinnerIsTrump && pc.card.suit === leadSuit) {
      if (strength > currentWinnerStrength || i === 0) {
        currentWinnerSeat = pc.seatIndex;
        currentWinnerStrength = strength;
      }
    }
  }

  const partnerIsWinning = getTeamIndex(currentWinnerSeat) === getTeamIndex(seatIndex);

  if (partnerIsWinning) {
    // Partner winning: play lowest card (save points for later, or give points to partner)
    // If following suit, play highest point card to feed partner
    const followSuitCards = legalCards.filter(c => c.suit === leadSuit);
    if (followSuitCards.length > 0) {
      // Give partner points: play highest point card
      return sortByPoints(followSuitCards, trumpSuit, false)[0];
    }
    // Not following suit: discard lowest card
    return sortByPoints(legalCards, trumpSuit, true)[0];
  }

  // Opponent winning: try to win the trick
  const followSuitCards = legalCards.filter(c => c.suit === leadSuit);
  if (followSuitCards.length > 0) {
    // Try to play a card that wins
    const winningCards = followSuitCards.filter(c =>
      getCardStrength(c, trumpSuit) > currentWinnerStrength || currentWinnerIsTrump
    );
    if (winningCards.length > 0 && !currentWinnerIsTrump) {
      // Play the lowest winning card
      return sortByStrength(winningCards, trumpSuit, true)[0];
    }
    // Can't win: play lowest
    return sortByPoints(followSuitCards, trumpSuit, true)[0];
  }

  // Trumping
  const trumpCards = legalCards.filter(c => c.suit === trumpSuit);
  if (trumpCards.length > 0) {
    // Play lowest trump that wins
    return sortByStrength(trumpCards, trumpSuit, true)[0];
  }

  // Discarding: play lowest point card
  return sortByPoints(legalCards, trumpSuit, true)[0];
}
