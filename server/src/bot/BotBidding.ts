import { Card, Suit, Rank, ALL_SUITS } from '../models/Card.js';
import { BiddingState, BidValue, isValidBid } from '../engine/BiddingEngine.js';
import { TRUMP_POINTS, TRUMP_ORDER } from '../config/constants.js';

interface HandEvaluation {
  suit: Suit;
  strength: number;
  trumpCount: number;
  hasJack: boolean;
  hasNine: boolean;
}

function evaluateHandForSuit(hand: Card[], trumpSuit: Suit): HandEvaluation {
  const trumpCards = hand.filter(c => c.suit === trumpSuit);
  const trumpCount = trumpCards.length;
  const hasJack = trumpCards.some(c => c.rank === Rank.JACK);
  const hasNine = trumpCards.some(c => c.rank === Rank.NINE);

  let strength = 0;

  // Trump card points
  for (const card of trumpCards) {
    strength += TRUMP_POINTS[card.rank];
  }

  // Side aces (non-trump)
  for (const card of hand) {
    if (card.suit !== trumpSuit && card.rank === Rank.ACE) {
      strength += 11;
    }
  }

  // Side tens with ace protection
  for (const suit of ALL_SUITS) {
    if (suit === trumpSuit) continue;
    const hasAce = hand.some(c => c.suit === suit && c.rank === Rank.ACE);
    const hasTen = hand.some(c => c.suit === suit && c.rank === Rank.TEN);
    if (hasTen && hasAce) {
      strength += 10;
    }
  }

  // Bonus for trump length
  if (trumpCount >= 4) strength += 10;
  if (trumpCount >= 5) strength += 20;

  // Bonus for Jack + 9 combo
  if (hasJack && hasNine) strength += 30;

  return { suit: trumpSuit, strength, trumpCount, hasJack, hasNine };
}

export function botDecideBid(
  hand: Card[],
  biddingState: BiddingState,
  seatIndex: number,
): { value: BidValue; suit?: Suit } {
  // Evaluate hand for each possible trump suit
  const evaluations = ALL_SUITS
    .map(suit => evaluateHandForSuit(hand, suit))
    .filter(e => e.trumpCount >= 3)
    .sort((a, b) => b.strength - a.strength);

  if (evaluations.length === 0) {
    return { value: 'pass' };
  }

  const best = evaluations[0];
  const currentHighest = biddingState.highestBid?.value ?? 0;

  // Determine bid value based on strength
  let bidValue: number;
  if (best.strength >= 140 && best.hasJack && best.hasNine && best.trumpCount >= 5) {
    bidValue = 150;
  } else if (best.strength >= 120 && best.hasJack && best.hasNine) {
    bidValue = 130;
  } else if (best.strength >= 100 && best.trumpCount >= 4) {
    bidValue = 100;
  } else if (best.strength >= 80) {
    bidValue = 80;
  } else {
    return { value: 'pass' };
  }

  // Must bid higher than current
  if (bidValue <= currentHighest) {
    // Can we still overbid?
    const nextBid = currentHighest + 10;
    if (nextBid <= bidValue + 10 && best.strength >= nextBid) {
      bidValue = nextBid;
    } else {
      return { value: 'pass' };
    }
  }

  // Validate the bid
  if (isValidBid(biddingState, seatIndex, bidValue, best.suit)) {
    return { value: bidValue, suit: best.suit };
  }

  // Check if coinche is valid and worthwhile
  if (isValidBid(biddingState, seatIndex, 'coinche')) {
    // Coinche if we have strong cards against the declared trump
    const declaredSuit = biddingState.highestBid?.suit;
    if (declaredSuit) {
      const cardsInDeclaredSuit = hand.filter(c => c.suit === declaredSuit);
      const hasJackOfDeclared = cardsInDeclaredSuit.some(c => c.rank === Rank.JACK);
      const sideAces = hand.filter(c => c.suit !== declaredSuit && c.rank === Rank.ACE).length;
      if (hasJackOfDeclared || sideAces >= 3) {
        return { value: 'coinche' };
      }
    }
  }

  return { value: 'pass' };
}
