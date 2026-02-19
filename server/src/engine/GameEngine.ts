import { v4 as uuid } from 'uuid';
import { Card, Suit, Rank, cardEquals } from '../models/Card.js';
import { createAndDeal } from '../models/Deck.js';
import { Player, getTeamIndex } from '../models/Player.js';
import {
  BiddingState, Contract, BidValue,
  createBiddingState, placeBid, isValidBid, getContract, allPassed,
} from './BiddingEngine.js';
import {
  TrickState, PlayedCard,
  createTrickState, playCard, isTrickComplete, determineTrickWinner, getLegalCards,
} from './TrickEngine.js';
import { HandResult, computeHandResult, hasBeloteRebelote } from './ScoringEngine.js';
import { WINNING_SCORE, TRICKS_PER_HAND } from '../config/constants.js';

export type GamePhase = 'waiting' | 'bidding' | 'playing' | 'scoring' | 'finished';

export interface GameEvent {
  type: string;
  data: Record<string, unknown>;
}

export interface GameState {
  id: string;
  players: Player[];
  teamScores: [number, number];
  dealerSeat: number;
  phase: GamePhase;
  handNumber: number;
  // Current hand state
  biddingState: BiddingState | null;
  contract: Contract | null;
  tricks: TrickState[];
  currentTrick: TrickState | null;
  currentPlayerSeat: number;
  beloteRebeloteTeam: number | null;
  beloteDeclared: boolean;
  // History
  handResults: HandResult[];
}

export class GameEngine {
  private state: GameState;
  private eventListeners: ((event: GameEvent) => void)[] = [];

  constructor(players: Player[]) {
    if (players.length !== 4) throw new Error('Game requires exactly 4 players');

    this.state = {
      id: uuid(),
      players,
      teamScores: [0, 0],
      dealerSeat: Math.floor(Math.random() * 4),
      phase: 'waiting',
      handNumber: 0,
      biddingState: null,
      contract: null,
      tricks: [],
      currentTrick: null,
      currentPlayerSeat: 0,
      beloteRebeloteTeam: null,
      beloteDeclared: false,
      handResults: [],
    };
  }

  get gameState(): Readonly<GameState> {
    return this.state;
  }

  get id(): string {
    return this.state.id;
  }

  onEvent(listener: (event: GameEvent) => void): void {
    this.eventListeners.push(listener);
  }

  private emit(type: string, data: Record<string, unknown> = {}): void {
    for (const listener of this.eventListeners) {
      listener({ type, data });
    }
  }

  startGame(): void {
    this.state.phase = 'bidding';
    this.startNewHand();
  }

  private startNewHand(): void {
    this.state.handNumber++;
    this.state.contract = null;
    this.state.tricks = [];
    this.state.currentTrick = null;
    this.state.beloteRebeloteTeam = null;
    this.state.beloteDeclared = false;

    // Deal cards
    const hands = createAndDeal();
    for (let i = 0; i < 4; i++) {
      this.state.players[i].hand = hands[i];
    }

    // Start bidding
    this.state.phase = 'bidding';
    this.state.biddingState = createBiddingState(this.state.dealerSeat);
    this.state.currentPlayerSeat = this.state.biddingState.currentBidderIndex;

    this.emit('new_hand', {
      handNumber: this.state.handNumber,
      dealerSeat: this.state.dealerSeat,
    });

    this.emit('deal', {});

    this.emit('bidding_turn', {
      seatIndex: this.state.currentPlayerSeat,
    });
  }

  // --- BIDDING ---

  handleBid(seatIndex: number, value: BidValue, suit?: Suit): boolean {
    if (this.state.phase !== 'bidding' || !this.state.biddingState) return false;
    if (!isValidBid(this.state.biddingState, seatIndex, value, suit)) return false;

    this.state.biddingState = placeBid(this.state.biddingState, seatIndex, value, suit);

    // Emit bid event
    if (value === 'pass') {
      this.emit('bid_passed', { seatIndex });
    } else if (value === 'coinche') {
      this.emit('coinched', { seatIndex });
    } else if (value === 'surcoinche') {
      this.emit('surcoinched', { seatIndex });
    } else {
      this.emit('bid_placed', { seatIndex, value, suit });
    }

    // Check if bidding is done
    if (this.state.biddingState.phase === 'done') {
      if (allPassed(this.state.biddingState)) {
        this.emit('all_passed', {});
        // Rotate dealer and re-deal
        this.state.dealerSeat = (this.state.dealerSeat + 1) % 4;
        this.state.handNumber--; // Don't count this as a hand
        this.startNewHand();
        return true;
      }

      const contract = getContract(this.state.biddingState);
      this.state.contract = contract;
      this.emit('contract_set', {
        value: contract!.value,
        suit: contract!.suit,
        teamIndex: contract!.teamIndex,
        multiplier: contract!.multiplier,
      });

      // Check for belote-rebelote
      for (const player of this.state.players) {
        if (hasBeloteRebelote(player.hand, contract!.suit)) {
          this.state.beloteRebeloteTeam = getTeamIndex(player.seatIndex);
          break;
        }
      }

      this.startPlaying();
      return true;
    }

    // Next bidder
    this.state.currentPlayerSeat = this.state.biddingState.currentBidderIndex;
    this.emit('bidding_turn', { seatIndex: this.state.currentPlayerSeat });
    return true;
  }

  // --- PLAYING ---

  private startPlaying(): void {
    this.state.phase = 'playing';
    // First trick: player left of dealer leads
    this.state.currentPlayerSeat = (this.state.dealerSeat + 1) % 4;
    this.state.currentTrick = createTrickState(1);

    this.emit('play_turn', {
      seatIndex: this.state.currentPlayerSeat,
      legalCards: this.getLegalCardsForCurrentPlayer(),
    });
  }

  getLegalCardsForPlayer(seatIndex: number): Card[] {
    if (this.state.phase !== 'playing' || !this.state.currentTrick || !this.state.contract) return [];
    const player = this.state.players[seatIndex];
    return getLegalCards(player.hand, this.state.currentTrick, this.state.contract.suit, seatIndex);
  }

  private getLegalCardsForCurrentPlayer(): Card[] {
    return this.getLegalCardsForPlayer(this.state.currentPlayerSeat);
  }

  handlePlayCard(seatIndex: number, card: Card): boolean {
    if (this.state.phase !== 'playing') return false;
    if (this.state.currentPlayerSeat !== seatIndex) return false;
    if (!this.state.currentTrick || !this.state.contract) return false;

    // Validate the card is legal
    const legalCards = this.getLegalCardsForCurrentPlayer();
    if (!legalCards.some(c => cardEquals(c, card))) return false;

    // Remove card from player's hand
    const player = this.state.players[seatIndex];
    player.hand = player.hand.filter(c => !cardEquals(c, card));

    // Play card to trick
    this.state.currentTrick = playCard(this.state.currentTrick, seatIndex, card);

    // Check belote declaration (King or Queen of trump)
    if (this.state.beloteRebeloteTeam === getTeamIndex(seatIndex)) {
      if (card.suit === this.state.contract.suit &&
          (card.rank === Rank.KING || card.rank === Rank.QUEEN)) {
        if (!this.state.beloteDeclared) {
          this.state.beloteDeclared = true;
          this.emit('belote_declared', { seatIndex });
        } else {
          this.emit('rebelote_declared', { seatIndex });
        }
      }
    }

    this.emit('card_played', { seatIndex, card });

    // Check if trick is complete
    if (isTrickComplete(this.state.currentTrick)) {
      this.resolveTrick();
      return true;
    }

    // Next player
    this.state.currentPlayerSeat = (seatIndex + 1) % 4;
    this.emit('play_turn', {
      seatIndex: this.state.currentPlayerSeat,
      legalCards: this.getLegalCardsForCurrentPlayer(),
    });
    return true;
  }

  private resolveTrick(): void {
    const trick = this.state.currentTrick!;
    const winnerSeat = determineTrickWinner(trick, this.state.contract!.suit);
    const winnerTeam = getTeamIndex(winnerSeat);

    this.state.tricks.push(trick);

    this.emit('trick_won', {
      winningSeat: winnerSeat,
      winnerTeam,
      trickNumber: trick.trickNumber,
      cards: trick.cardsPlayed.map(pc => ({ seatIndex: pc.seatIndex, card: pc.card })),
    });

    // Check if all tricks are done
    if (this.state.tricks.length === TRICKS_PER_HAND) {
      this.resolveHand();
      return;
    }

    // Next trick: winner leads
    this.state.currentTrick = createTrickState(this.state.tricks.length + 1);
    this.state.currentPlayerSeat = winnerSeat;

    this.emit('play_turn', {
      seatIndex: this.state.currentPlayerSeat,
      legalCards: this.getLegalCardsForCurrentPlayer(),
    });
  }

  private resolveHand(): void {
    this.state.phase = 'scoring';

    const result = computeHandResult(
      this.state.tricks,
      this.state.contract!,
      this.state.contract!.suit,
      this.state.beloteRebeloteTeam,
    );

    // Update team scores
    this.state.teamScores[0] += result.scoreDeltas[0];
    this.state.teamScores[1] += result.scoreDeltas[1];

    this.state.handResults.push(result);

    this.emit('hand_result', {
      ...result,
      teamScores: [...this.state.teamScores],
      contract: this.state.contract,
    });

    // Check if game is over
    if (this.state.teamScores[0] >= WINNING_SCORE || this.state.teamScores[1] >= WINNING_SCORE) {
      this.state.phase = 'finished';
      const winningTeam = this.state.teamScores[0] > this.state.teamScores[1] ? 0 : 1;
      this.emit('game_over', {
        winningTeam,
        teamScores: [...this.state.teamScores],
        totalHands: this.state.handNumber,
      });
      return;
    }

    // Rotate dealer and start next hand
    this.state.dealerSeat = (this.state.dealerSeat + 1) % 4;
    this.startNewHand();
  }

  // --- UTILITY ---

  getPlayerHand(seatIndex: number): Card[] {
    return [...this.state.players[seatIndex].hand];
  }

  isGameOver(): boolean {
    return this.state.phase === 'finished';
  }

  getWinningTeam(): number | null {
    if (!this.isGameOver()) return null;
    return this.state.teamScores[0] > this.state.teamScores[1] ? 0 : 1;
  }
}
