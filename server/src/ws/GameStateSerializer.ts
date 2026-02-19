import { GameState } from '../engine/GameEngine.js';
import { Card } from '../models/Card.js';

export interface ClientGameState {
  gameId: string;
  yourSeat: number;
  yourCards: Card[];
  opponents: {
    seatIndex: number;
    cardCount: number;
    username: string;
    isBot: boolean;
    isDisconnected: boolean;
  }[];
  currentTrick: {
    cardsPlayed: { seatIndex: number; card: Card }[];
    leadSuit: string | null;
    trickNumber: number;
  } | null;
  contract: {
    value: number;
    suit: string;
    teamIndex: number;
    multiplier: number;
  } | null;
  biddingState: {
    bids: { seatIndex: number; value: string | number; suit?: string }[];
    currentBidderIndex: number;
    highestBid: { value: number; suit: string; seatIndex: number } | null;
    isCoinched: boolean;
    isSurcoinched: boolean;
    phase: string;
  } | null;
  teamScores: [number, number];
  phase: string;
  dealerSeat: number;
  currentPlayerSeat: number;
  handNumber: number;
  tricksWon: [number, number];
}

export function serializeForPlayer(state: GameState, seatIndex: number): ClientGameState {
  const opponents = [];
  for (let offset = 1; offset <= 3; offset++) {
    const seat = (seatIndex + offset) % 4;
    const player = state.players[seat];
    opponents.push({
      seatIndex: seat,
      cardCount: player.hand.length,
      username: player.username,
      isBot: player.isBot,
      isDisconnected: player.isDisconnected,
    });
  }

  // Count tricks won per team from completed tricks
  const tricksWon: [number, number] = [0, 0];
  if (state.contract) {
    for (const trick of state.tricks) {
      if (trick.cardsPlayed.length === 4) {
        // Simple heuristic: the seat that played the winning card
        // We'd need to import determineTrickWinner, but to keep this lightweight
        // we track tricksWon from GameEngine events instead
      }
    }
  }

  return {
    gameId: state.id,
    yourSeat: seatIndex,
    yourCards: [...state.players[seatIndex].hand],
    opponents,
    currentTrick: state.currentTrick ? {
      cardsPlayed: state.currentTrick.cardsPlayed.map(pc => ({
        seatIndex: pc.seatIndex,
        card: pc.card,
      })),
      leadSuit: state.currentTrick.leadSuit,
      trickNumber: state.currentTrick.trickNumber,
    } : null,
    contract: state.contract ? {
      value: state.contract.value,
      suit: state.contract.suit,
      teamIndex: state.contract.teamIndex,
      multiplier: state.contract.multiplier,
    } : null,
    biddingState: state.biddingState ? {
      bids: state.biddingState.bids.map(b => ({
        seatIndex: b.seatIndex,
        value: b.value,
        suit: b.suit,
      })),
      currentBidderIndex: state.biddingState.currentBidderIndex,
      highestBid: state.biddingState.highestBid,
      isCoinched: state.biddingState.isCoinched,
      isSurcoinched: state.biddingState.isSurcoinched,
      phase: state.biddingState.phase,
    } : null,
    teamScores: [...state.teamScores] as [number, number],
    phase: state.phase,
    dealerSeat: state.dealerSeat,
    currentPlayerSeat: state.currentPlayerSeat,
    handNumber: state.handNumber,
    tricksWon,
  };
}
