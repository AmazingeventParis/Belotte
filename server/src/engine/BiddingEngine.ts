import { Suit } from '../models/Card.js';
import { MIN_BID, BID_INCREMENT, MAX_BID } from '../config/constants.js';
import { getTeamIndex } from '../models/Player.js';

export type BidValue = number | 'pass' | 'coinche' | 'surcoinche';

export interface BidEntry {
  seatIndex: number;
  value: BidValue;
  suit?: Suit;
}

export interface Contract {
  value: number;
  suit: Suit;
  teamIndex: number; // attacking team
  bidderSeat: number;
  multiplier: 1 | 2 | 4; // 1=normal, 2=coinche, 4=surcoinche
}

export interface BiddingState {
  bids: BidEntry[];
  currentBidderIndex: number;
  highestBid: { value: number; suit: Suit; seatIndex: number } | null;
  consecutivePasses: number;
  isCoinched: boolean;
  isSurcoinched: boolean;
  coinchedBy: number | null;
  phase: 'bidding' | 'done';
}

export function createBiddingState(dealerSeat: number): BiddingState {
  return {
    bids: [],
    currentBidderIndex: (dealerSeat + 1) % 4,
    highestBid: null,
    consecutivePasses: 0,
    isCoinched: false,
    isSurcoinched: false,
    coinchedBy: null,
    phase: 'bidding',
  };
}

export function isValidBid(state: BiddingState, seatIndex: number, value: BidValue, suit?: Suit): boolean {
  if (state.phase !== 'bidding') return false;
  if (state.currentBidderIndex !== seatIndex) return false;

  if (value === 'pass') return true;

  if (value === 'coinche') {
    if (!state.highestBid) return false;
    if (state.isCoinched) return false;
    // Only the defending team can coinche
    const bidderTeam = getTeamIndex(seatIndex);
    const attackingTeam = getTeamIndex(state.highestBid.seatIndex);
    return bidderTeam !== attackingTeam;
  }

  if (value === 'surcoinche') {
    if (!state.isCoinched) return false;
    if (state.isSurcoinched) return false;
    // Only the attacking team can surcoinche
    const bidderTeam = getTeamIndex(seatIndex);
    const attackingTeam = getTeamIndex(state.highestBid!.seatIndex);
    return bidderTeam === attackingTeam;
  }

  // Numeric bid
  if (typeof value !== 'number') return false;
  if (!suit) return false;
  if (value < MIN_BID) return false;
  if (value > MAX_BID) return false;
  if (value % BID_INCREMENT !== 0) return false;
  if (state.highestBid && value <= state.highestBid.value) return false;
  if (state.isCoinched) return false; // Can't bid after coinche, only surcoinche

  return true;
}

export function placeBid(state: BiddingState, seatIndex: number, value: BidValue, suit?: Suit): BiddingState {
  const newState = { ...state, bids: [...state.bids] };
  newState.bids.push({ seatIndex, value, suit });

  if (value === 'pass') {
    newState.consecutivePasses++;

    // If coinched, after a pass the bidding can continue for surcoinche opportunity
    // Bidding ends after coinche + pass from all others (or surcoinche)
    if (state.isCoinched && !state.isSurcoinched) {
      // After coinche, the attacking team gets one chance to surcoinche
      // If they pass, bidding ends
      const attackingTeam = getTeamIndex(state.highestBid!.seatIndex);
      const currentTeam = getTeamIndex(seatIndex);
      if (currentTeam === attackingTeam) {
        // Attacking team passed on surcoinche -> bidding done
        newState.phase = 'done';
        return newState;
      }
    }

    // Normal case: 3 consecutive passes after a bid -> bidding done
    if (newState.consecutivePasses >= 3 && state.highestBid) {
      newState.phase = 'done';
      return newState;
    }

    // All 4 passed with no bid -> all passed (re-deal)
    if (newState.consecutivePasses >= 4 && !state.highestBid) {
      newState.phase = 'done';
      return newState;
    }
  } else if (value === 'coinche') {
    newState.isCoinched = true;
    newState.coinchedBy = seatIndex;
    newState.consecutivePasses = 0;
    // After coinche, the next bidder is from the attacking team (for surcoinche chance)
    const attackingTeam = getTeamIndex(state.highestBid!.seatIndex);
    // Find next player from attacking team
    let next = (seatIndex + 1) % 4;
    while (getTeamIndex(next) !== attackingTeam) {
      next = (next + 1) % 4;
    }
    newState.currentBidderIndex = next;
    return newState;
  } else if (value === 'surcoinche') {
    newState.isSurcoinched = true;
    newState.phase = 'done'; // Surcoinche ends bidding immediately
    return newState;
  } else {
    // Numeric bid
    newState.highestBid = { value: value as number, suit: suit!, seatIndex };
    newState.consecutivePasses = 0;
    newState.isCoinched = false;
    newState.isSurcoinched = false;
    newState.coinchedBy = null;
  }

  newState.currentBidderIndex = (seatIndex + 1) % 4;
  return newState;
}

export function getContract(state: BiddingState): Contract | null {
  if (state.phase !== 'done') return null;
  if (!state.highestBid) return null; // All passed

  let multiplier: 1 | 2 | 4 = 1;
  if (state.isSurcoinched) multiplier = 4;
  else if (state.isCoinched) multiplier = 2;

  return {
    value: state.highestBid.value,
    suit: state.highestBid.suit,
    teamIndex: getTeamIndex(state.highestBid.seatIndex),
    bidderSeat: state.highestBid.seatIndex,
    multiplier,
  };
}

export function allPassed(state: BiddingState): boolean {
  return state.phase === 'done' && !state.highestBid;
}
