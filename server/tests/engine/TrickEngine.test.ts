import { describe, it, expect } from 'vitest';
import { Suit, Rank, Card } from '../../src/models/Card.js';
import {
  createTrickState, playCard, determineTrickWinner,
  getLegalCards, isTrickComplete, getCardPoints,
} from '../../src/engine/TrickEngine.js';

const card = (rank: Rank, suit: Suit): Card => ({ rank, suit });

describe('TrickEngine', () => {
  describe('getCardPoints', () => {
    it('should return trump points for trump cards', () => {
      expect(getCardPoints(card(Rank.JACK, Suit.HEARTS), Suit.HEARTS)).toBe(20);
      expect(getCardPoints(card(Rank.NINE, Suit.HEARTS), Suit.HEARTS)).toBe(14);
      expect(getCardPoints(card(Rank.ACE, Suit.HEARTS), Suit.HEARTS)).toBe(11);
    });

    it('should return non-trump points for non-trump cards', () => {
      expect(getCardPoints(card(Rank.JACK, Suit.SPADES), Suit.HEARTS)).toBe(2);
      expect(getCardPoints(card(Rank.NINE, Suit.SPADES), Suit.HEARTS)).toBe(0);
      expect(getCardPoints(card(Rank.ACE, Suit.SPADES), Suit.HEARTS)).toBe(11);
    });
  });

  describe('determineTrickWinner', () => {
    it('should win with highest card of lead suit when no trump', () => {
      let trick = createTrickState(1);
      trick = playCard(trick, 0, card(Rank.KING, Suit.SPADES));
      trick = playCard(trick, 1, card(Rank.ACE, Suit.SPADES));
      trick = playCard(trick, 2, card(Rank.QUEEN, Suit.SPADES));
      trick = playCard(trick, 3, card(Rank.TEN, Suit.SPADES));

      expect(determineTrickWinner(trick, Suit.HEARTS)).toBe(1); // Ace wins
    });

    it('should win with trump over non-trump', () => {
      let trick = createTrickState(1);
      trick = playCard(trick, 0, card(Rank.ACE, Suit.SPADES));
      trick = playCard(trick, 1, card(Rank.SEVEN, Suit.HEARTS)); // trump!
      trick = playCard(trick, 2, card(Rank.KING, Suit.SPADES));
      trick = playCard(trick, 3, card(Rank.TEN, Suit.SPADES));

      expect(determineTrickWinner(trick, Suit.HEARTS)).toBe(1); // lowest trump beats Ace
    });

    it('should win with highest trump when multiple trumps', () => {
      let trick = createTrickState(1);
      trick = playCard(trick, 0, card(Rank.ACE, Suit.SPADES));
      trick = playCard(trick, 1, card(Rank.NINE, Suit.HEARTS)); // trump 9 (14pts)
      trick = playCard(trick, 2, card(Rank.JACK, Suit.HEARTS)); // trump Jack (20pts, highest)
      trick = playCard(trick, 3, card(Rank.TEN, Suit.SPADES));

      expect(determineTrickWinner(trick, Suit.HEARTS)).toBe(2); // Jack of trump wins
    });

    it('should ignore cards not of lead suit and not trump', () => {
      let trick = createTrickState(1);
      trick = playCard(trick, 0, card(Rank.KING, Suit.SPADES));
      trick = playCard(trick, 1, card(Rank.ACE, Suit.DIAMONDS)); // not lead suit, not trump
      trick = playCard(trick, 2, card(Rank.SEVEN, Suit.SPADES));
      trick = playCard(trick, 3, card(Rank.EIGHT, Suit.SPADES));

      expect(determineTrickWinner(trick, Suit.HEARTS)).toBe(0); // King wins (ace is diamonds)
    });

    it('should respect trump order: Jack > 9 > Ace', () => {
      let trick = createTrickState(1);
      trick = playCard(trick, 0, card(Rank.JACK, Suit.HEARTS));
      trick = playCard(trick, 1, card(Rank.NINE, Suit.HEARTS));
      trick = playCard(trick, 2, card(Rank.ACE, Suit.HEARTS));
      trick = playCard(trick, 3, card(Rank.TEN, Suit.HEARTS));

      expect(determineTrickWinner(trick, Suit.HEARTS)).toBe(0); // Jack is highest trump
    });
  });

  describe('getLegalCards', () => {
    const trumpSuit = Suit.HEARTS;

    it('should allow any card when leading', () => {
      const hand: Card[] = [
        card(Rank.ACE, Suit.SPADES),
        card(Rank.KING, Suit.HEARTS),
        card(Rank.SEVEN, Suit.DIAMONDS),
      ];
      const trick = createTrickState(1);
      const legal = getLegalCards(hand, trick, trumpSuit, 0);
      expect(legal).toHaveLength(3);
    });

    it('should require following lead suit', () => {
      const hand: Card[] = [
        card(Rank.ACE, Suit.SPADES),
        card(Rank.KING, Suit.SPADES),
        card(Rank.SEVEN, Suit.DIAMONDS),
        card(Rank.JACK, Suit.HEARTS),
      ];
      let trick = createTrickState(1);
      trick = playCard(trick, 0, card(Rank.TEN, Suit.SPADES));

      const legal = getLegalCards(hand, trick, trumpSuit, 1);
      expect(legal).toHaveLength(2); // Only spades
      expect(legal.every(c => c.suit === Suit.SPADES)).toBe(true);
    });

    it('should require trumping when cannot follow suit and partner not winning', () => {
      const hand: Card[] = [
        card(Rank.SEVEN, Suit.DIAMONDS),
        card(Rank.NINE, Suit.HEARTS), // trump
        card(Rank.EIGHT, Suit.CLUBS),
      ];
      let trick = createTrickState(1);
      trick = playCard(trick, 0, card(Rank.ACE, Suit.SPADES)); // opponent leads

      const legal = getLegalCards(hand, trick, trumpSuit, 1);
      // Must trump: only hearts
      expect(legal).toHaveLength(1);
      expect(legal[0].suit).toBe(Suit.HEARTS);
    });

    it('should allow any card when cannot follow suit and partner IS winning', () => {
      const hand: Card[] = [
        card(Rank.SEVEN, Suit.DIAMONDS),
        card(Rank.NINE, Suit.HEARTS),
        card(Rank.EIGHT, Suit.CLUBS),
      ];
      let trick = createTrickState(1);
      // Seat 0 leads spades, seat 0 is partner of seat 2
      trick = playCard(trick, 0, card(Rank.ACE, Suit.SPADES));
      trick = playCard(trick, 1, card(Rank.SEVEN, Suit.SPADES));

      // Seat 2 (partner of seat 0) has no spades - partner IS winning
      const legal = getLegalCards(hand, trick, trumpSuit, 2);
      expect(legal).toHaveLength(3); // Can play anything
    });

    it('should require playing higher trump (monter) when cutting', () => {
      const hand: Card[] = [
        card(Rank.SEVEN, Suit.DIAMONDS),
        card(Rank.NINE, Suit.HEARTS), // higher trump
        card(Rank.EIGHT, Suit.HEARTS), // lower trump
      ];
      let trick = createTrickState(1);
      trick = playCard(trick, 0, card(Rank.ACE, Suit.SPADES));
      trick = playCard(trick, 1, card(Rank.SEVEN, Suit.HEARTS)); // trump already played

      // Seat 2 (opponent) must play higher trump than 7 if possible
      // Both 8 and 9 of hearts are higher than 7, so both are legal
      const legal = getLegalCards(hand, trick, trumpSuit, 2);
      expect(legal).toHaveLength(2);
      expect(legal.every(c => c.suit === Suit.HEARTS)).toBe(true);
    });

    it('should allow any trump when must cut but cannot play higher', () => {
      const hand: Card[] = [
        card(Rank.SEVEN, Suit.DIAMONDS),
        card(Rank.SEVEN, Suit.HEARTS), // only trump, lower than Jack
        card(Rank.EIGHT, Suit.HEARTS), // still lower than Jack
      ];
      let trick = createTrickState(1);
      trick = playCard(trick, 0, card(Rank.ACE, Suit.SPADES));
      trick = playCard(trick, 1, card(Rank.JACK, Suit.HEARTS)); // Jack of trump (highest)

      // Seat 2 cannot beat Jack of trump, but must still play trump
      const legal = getLegalCards(hand, trick, trumpSuit, 2);
      expect(legal).toHaveLength(2); // Both trumps are legal
      expect(legal.every(c => c.suit === Suit.HEARTS)).toBe(true);
    });

    it('should require following trump lead and playing higher if possible', () => {
      const hand: Card[] = [
        card(Rank.JACK, Suit.HEARTS), // highest trump
        card(Rank.SEVEN, Suit.HEARTS), // lowest trump
        card(Rank.ACE, Suit.SPADES),
      ];
      let trick = createTrickState(1);
      trick = playCard(trick, 0, card(Rank.NINE, Suit.HEARTS)); // trump lead

      const legal = getLegalCards(hand, trick, trumpSuit, 1);
      // Must play trump, must play higher than 9 if possible -> only Jack
      expect(legal).toHaveLength(1);
      expect(legal[0].rank).toBe(Rank.JACK);
    });

    it('should allow any card when no lead suit and no trump in hand', () => {
      const hand: Card[] = [
        card(Rank.SEVEN, Suit.DIAMONDS),
        card(Rank.ACE, Suit.CLUBS),
      ];
      let trick = createTrickState(1);
      trick = playCard(trick, 0, card(Rank.ACE, Suit.SPADES));

      // No spades, no trump -> play anything
      const legal = getLegalCards(hand, trick, trumpSuit, 1);
      expect(legal).toHaveLength(2);
    });
  });
});
