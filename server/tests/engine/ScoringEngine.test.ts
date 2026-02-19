import { describe, it, expect } from 'vitest';
import { Suit, Rank, Card } from '../../src/models/Card.js';
import { Contract } from '../../src/engine/BiddingEngine.js';
import { TrickState, createTrickState, playCard } from '../../src/engine/TrickEngine.js';
import { computeHandResult, hasBeloteRebelote } from '../../src/engine/ScoringEngine.js';

const card = (rank: Rank, suit: Suit): Card => ({ rank, suit });

function makeTrick(trickNumber: number, cards: [number, Card][]): TrickState {
  let trick = createTrickState(trickNumber);
  for (const [seat, c] of cards) {
    trick = playCard(trick, seat, c);
  }
  return trick;
}

describe('ScoringEngine', () => {
  describe('hasBeloteRebelote', () => {
    it('should detect King + Queen of trump', () => {
      const hand: Card[] = [
        card(Rank.KING, Suit.HEARTS),
        card(Rank.QUEEN, Suit.HEARTS),
        card(Rank.ACE, Suit.SPADES),
      ];
      expect(hasBeloteRebelote(hand, Suit.HEARTS)).toBe(true);
    });

    it('should not detect if only King of trump', () => {
      const hand: Card[] = [
        card(Rank.KING, Suit.HEARTS),
        card(Rank.ACE, Suit.SPADES),
      ];
      expect(hasBeloteRebelote(hand, Suit.HEARTS)).toBe(false);
    });

    it('should not detect King + Queen of different suit', () => {
      const hand: Card[] = [
        card(Rank.KING, Suit.SPADES),
        card(Rank.QUEEN, Suit.SPADES),
      ];
      expect(hasBeloteRebelote(hand, Suit.HEARTS)).toBe(false);
    });
  });

  describe('computeHandResult', () => {
    // Build a simplified set of 8 tricks for testing
    // Team 0 = seats 0, 2; Team 1 = seats 1, 3

    it('should compute basic contract made scoring', () => {
      const trumpSuit = Suit.HEARTS;
      const contract: Contract = {
        value: 80,
        suit: trumpSuit,
        teamIndex: 0, // team 0 attacking
        bidderSeat: 0,
        multiplier: 1,
      };

      // Create 8 tricks where team 0 wins most points
      // Simplified: team 0 wins 6 tricks with high cards, team 1 wins 2
      const tricks: TrickState[] = [];

      // Trick 1: Team 0 wins with ace of trump (seat 0)
      tricks.push(makeTrick(1, [
        [0, card(Rank.ACE, Suit.HEARTS)],   // 11 pts (trump)
        [1, card(Rank.SEVEN, Suit.HEARTS)], // 0
        [2, card(Rank.EIGHT, Suit.HEARTS)], // 0
        [3, card(Rank.SEVEN, Suit.SPADES)], // 0
      ]));

      // Trick 2: Team 0 wins (seat 2)
      tricks.push(makeTrick(2, [
        [0, card(Rank.TEN, Suit.SPADES)],   // 10 pts
        [1, card(Rank.NINE, Suit.SPADES)],  // 0
        [2, card(Rank.ACE, Suit.SPADES)],   // 11 pts
        [3, card(Rank.EIGHT, Suit.SPADES)], // 0
      ]));

      // Trick 3: Team 0 wins (seat 0)
      tricks.push(makeTrick(3, [
        [0, card(Rank.ACE, Suit.DIAMONDS)],  // 11
        [1, card(Rank.SEVEN, Suit.DIAMONDS)], // 0
        [2, card(Rank.TEN, Suit.DIAMONDS)],  // 10
        [3, card(Rank.EIGHT, Suit.DIAMONDS)], // 0
      ]));

      // Trick 4: Team 1 wins (seat 1)
      tricks.push(makeTrick(4, [
        [0, card(Rank.SEVEN, Suit.CLUBS)],   // 0
        [1, card(Rank.ACE, Suit.CLUBS)],     // 11
        [2, card(Rank.EIGHT, Suit.CLUBS)],   // 0
        [3, card(Rank.TEN, Suit.CLUBS)],     // 10
      ]));

      // Trick 5: Team 0 wins (seat 0 with trump jack)
      tricks.push(makeTrick(5, [
        [0, card(Rank.JACK, Suit.HEARTS)],   // 20 (trump)
        [1, card(Rank.QUEEN, Suit.HEARTS)],  // 3
        [2, card(Rank.KING, Suit.DIAMONDS)], // 4
        [3, card(Rank.QUEEN, Suit.DIAMONDS)], // 3
      ]));

      // Trick 6: Team 1 wins (seat 3)
      tricks.push(makeTrick(6, [
        [0, card(Rank.EIGHT, Suit.DIAMONDS)], // 0
        [1, card(Rank.KING, Suit.CLUBS)],     // 4
        [2, card(Rank.NINE, Suit.DIAMONDS)],  // 0
        [3, card(Rank.NINE, Suit.HEARTS)],    // 14 (trump)
      ]));

      // Trick 7: Team 0 wins (seat 2)
      tricks.push(makeTrick(7, [
        [0, card(Rank.KING, Suit.SPADES)],    // 4
        [1, card(Rank.JACK, Suit.SPADES)],    // 2
        [2, card(Rank.TEN, Suit.HEARTS)],     // 10 (trump)
        [3, card(Rank.QUEEN, Suit.SPADES)],   // 3
      ]));

      // Trick 8 (last): Team 0 wins dix de der (seat 0)
      tricks.push(makeTrick(8, [
        [0, card(Rank.KING, Suit.HEARTS)],    // 4 (trump)
        [1, card(Rank.JACK, Suit.DIAMONDS)],  // 2
        [2, card(Rank.QUEEN, Suit.CLUBS)],    // 3
        [3, card(Rank.NINE, Suit.CLUBS)],     // 0
      ]));

      const result = computeHandResult(tricks, contract, trumpSuit, null);

      expect(result.tricksWon[0]).toBe(6);
      expect(result.tricksWon[1]).toBe(2);
      expect(result.contractMade).toBe(true);
      expect(result.scoreDeltas[0]).toBeGreaterThan(0);
      expect(result.scoreDeltas[1]).toBeGreaterThan(0); // both keep points when no coinche
    });

    it('should handle chute (contract failed)', () => {
      const trumpSuit = Suit.HEARTS;
      const contract: Contract = {
        value: 150,
        suit: trumpSuit,
        teamIndex: 0,
        bidderSeat: 0,
        multiplier: 1,
      };

      // Team 0 only wins 1 trick with few points
      const tricks: TrickState[] = [];

      // Trick 1: Team 0 wins small
      tricks.push(makeTrick(1, [
        [0, card(Rank.ACE, Suit.SPADES)],    // 11
        [1, card(Rank.SEVEN, Suit.SPADES)],  // 0
        [2, card(Rank.EIGHT, Suit.SPADES)],  // 0
        [3, card(Rank.NINE, Suit.SPADES)],   // 0
      ]));

      // Tricks 2-8: Team 1 wins
      for (let i = 2; i <= 8; i++) {
        tricks.push(makeTrick(i, [
          [0, card(Rank.SEVEN, Suit.DIAMONDS)], // 0
          [1, card(Rank.JACK, Suit.HEARTS)],    // 20 (reusing for simplicity)
          [2, card(Rank.EIGHT, Suit.DIAMONDS)], // 0
          [3, card(Rank.SEVEN, Suit.CLUBS)],    // 0
        ]));
      }

      const result = computeHandResult(tricks, contract, trumpSuit, null);

      expect(result.contractMade).toBe(false);
      expect(result.scoreDeltas[0]).toBe(0); // Attacker gets 0
      // Defender gets 162 (all points) + 150 (contract) = 312
      expect(result.scoreDeltas[1]).toBe(162 + 150);
    });

    it('should add belote-rebelote bonus even on chute', () => {
      const trumpSuit = Suit.HEARTS;
      const contract: Contract = {
        value: 150,
        suit: trumpSuit,
        teamIndex: 0,
        bidderSeat: 0,
        multiplier: 1,
      };

      const tricks: TrickState[] = [];
      // Team 0 barely plays, team 1 wins everything
      tricks.push(makeTrick(1, [
        [0, card(Rank.ACE, Suit.SPADES)],    // 11
        [1, card(Rank.SEVEN, Suit.SPADES)],  // 0
        [2, card(Rank.EIGHT, Suit.SPADES)],  // 0
        [3, card(Rank.NINE, Suit.SPADES)],   // 0
      ]));
      for (let i = 2; i <= 8; i++) {
        tricks.push(makeTrick(i, [
          [0, card(Rank.SEVEN, Suit.DIAMONDS)],
          [1, card(Rank.JACK, Suit.HEARTS)],
          [2, card(Rank.EIGHT, Suit.DIAMONDS)],
          [3, card(Rank.SEVEN, Suit.CLUBS)],
        ]));
      }

      // Team 0 has belote-rebelote
      const result = computeHandResult(tricks, contract, trumpSuit, 0);

      expect(result.contractMade).toBe(false);
      expect(result.beloteRebeloteTeam).toBe(0);
      // Team 0 gets 0 + 20 (belote) = 20
      expect(result.scoreDeltas[0]).toBe(20);
    });

    it('should apply coinche multiplier on chute', () => {
      const trumpSuit = Suit.HEARTS;
      const contract: Contract = {
        value: 80,
        suit: trumpSuit,
        teamIndex: 0,
        bidderSeat: 0,
        multiplier: 2, // coinche
      };

      const tricks: TrickState[] = [];
      tricks.push(makeTrick(1, [
        [0, card(Rank.ACE, Suit.SPADES)],
        [1, card(Rank.SEVEN, Suit.SPADES)],
        [2, card(Rank.EIGHT, Suit.SPADES)],
        [3, card(Rank.NINE, Suit.SPADES)],
      ]));
      for (let i = 2; i <= 8; i++) {
        tricks.push(makeTrick(i, [
          [0, card(Rank.SEVEN, Suit.DIAMONDS)],
          [1, card(Rank.JACK, Suit.HEARTS)],
          [2, card(Rank.EIGHT, Suit.DIAMONDS)],
          [3, card(Rank.SEVEN, Suit.CLUBS)],
        ]));
      }

      const result = computeHandResult(tricks, contract, trumpSuit, null);

      expect(result.contractMade).toBe(false);
      // Coinche chute: (162 + 80) * 2 = 484
      expect(result.scoreDeltas[1]).toBe((162 + 80) * 2);
      expect(result.scoreDeltas[0]).toBe(0);
    });
  });
});
