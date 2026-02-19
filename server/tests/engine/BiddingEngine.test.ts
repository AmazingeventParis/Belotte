import { describe, it, expect } from 'vitest';
import { Suit } from '../../src/models/Card.js';
import {
  createBiddingState, placeBid, isValidBid, getContract, allPassed,
} from '../../src/engine/BiddingEngine.js';

describe('BiddingEngine', () => {
  describe('createBiddingState', () => {
    it('should start bidding with player left of dealer', () => {
      const state = createBiddingState(0);
      expect(state.currentBidderIndex).toBe(1);
      expect(state.phase).toBe('bidding');
      expect(state.highestBid).toBeNull();
    });
  });

  describe('isValidBid', () => {
    it('should allow pass', () => {
      const state = createBiddingState(0);
      expect(isValidBid(state, 1, 'pass')).toBe(true);
    });

    it('should allow a valid opening bid of 80', () => {
      const state = createBiddingState(0);
      expect(isValidBid(state, 1, 80, Suit.HEARTS)).toBe(true);
    });

    it('should reject bid below 80', () => {
      const state = createBiddingState(0);
      expect(isValidBid(state, 1, 70, Suit.HEARTS)).toBe(false);
    });

    it('should reject bid not in increments of 10', () => {
      const state = createBiddingState(0);
      expect(isValidBid(state, 1, 85, Suit.HEARTS)).toBe(false);
    });

    it('should reject bid from wrong player', () => {
      const state = createBiddingState(0);
      expect(isValidBid(state, 2, 80, Suit.HEARTS)).toBe(false);
    });

    it('should reject bid lower than highest', () => {
      let state = createBiddingState(0);
      state = placeBid(state, 1, 90, Suit.HEARTS);
      expect(isValidBid(state, 2, 80, Suit.SPADES)).toBe(false);
    });

    it('should allow higher bid than current', () => {
      let state = createBiddingState(0);
      state = placeBid(state, 1, 80, Suit.HEARTS);
      expect(isValidBid(state, 2, 90, Suit.SPADES)).toBe(true);
    });

    it('should reject bid without suit', () => {
      const state = createBiddingState(0);
      expect(isValidBid(state, 1, 80)).toBe(false);
    });
  });

  describe('coinche / surcoinche', () => {
    it('should allow defending team to coinche', () => {
      let state = createBiddingState(0);
      // Seat 1 bids (team 1), seat 2 should be able to coinche (team 0 = defending)
      state = placeBid(state, 1, 80, Suit.HEARTS);
      expect(isValidBid(state, 2, 'coinche')).toBe(true);
    });

    it('should not allow attacking team to coinche their own bid', () => {
      let state = createBiddingState(0);
      state = placeBid(state, 1, 80, Suit.HEARTS);
      // Seat 3 is team 1 = same team as bidder
      expect(isValidBid(state, 3, 'coinche')).toBe(false);
    });

    it('should allow surcoinche after coinche by attacking team', () => {
      let state = createBiddingState(0);
      state = placeBid(state, 1, 80, Suit.HEARTS); // team 1 bids
      state = placeBid(state, 2, 'coinche');        // team 0 coinche
      // After coinche, next bidder should be from attacking team (team 1)
      expect(isValidBid(state, state.currentBidderIndex, 'surcoinche')).toBe(true);
    });

    it('should end bidding after surcoinche', () => {
      let state = createBiddingState(0);
      state = placeBid(state, 1, 80, Suit.HEARTS);
      state = placeBid(state, 2, 'coinche');
      state = placeBid(state, state.currentBidderIndex, 'surcoinche');
      expect(state.phase).toBe('done');
    });
  });

  describe('bidding flow', () => {
    it('should end after 3 consecutive passes following a bid', () => {
      let state = createBiddingState(0);
      state = placeBid(state, 1, 80, Suit.HEARTS);
      state = placeBid(state, 2, 'pass');
      state = placeBid(state, 3, 'pass');
      state = placeBid(state, 0, 'pass');
      expect(state.phase).toBe('done');
    });

    it('should detect all passed', () => {
      let state = createBiddingState(0);
      state = placeBid(state, 1, 'pass');
      state = placeBid(state, 2, 'pass');
      state = placeBid(state, 3, 'pass');
      state = placeBid(state, 0, 'pass');
      expect(state.phase).toBe('done');
      expect(allPassed(state)).toBe(true);
    });

    it('should produce correct contract', () => {
      let state = createBiddingState(0);
      state = placeBid(state, 1, 80, Suit.HEARTS);
      state = placeBid(state, 2, 'pass');
      state = placeBid(state, 3, 'pass');
      state = placeBid(state, 0, 'pass');

      const contract = getContract(state);
      expect(contract).not.toBeNull();
      expect(contract!.value).toBe(80);
      expect(contract!.suit).toBe(Suit.HEARTS);
      expect(contract!.teamIndex).toBe(1); // seat 1 = team 1
      expect(contract!.multiplier).toBe(1);
    });

    it('should produce coinche contract with x2 multiplier', () => {
      let state = createBiddingState(0);
      state = placeBid(state, 1, 80, Suit.HEARTS);
      state = placeBid(state, 2, 'coinche');
      // After coinche, attacking team (seat 1 or 3) gets surcoinche chance
      state = placeBid(state, state.currentBidderIndex, 'pass');
      expect(state.phase).toBe('done');

      const contract = getContract(state);
      expect(contract!.multiplier).toBe(2);
    });
  });
});
