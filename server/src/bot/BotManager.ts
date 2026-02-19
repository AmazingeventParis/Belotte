import { Card, Suit } from '../models/Card.js';
import { GameEngine, GameState } from '../engine/GameEngine.js';
import { BidValue } from '../engine/BiddingEngine.js';
import { botDecideBid } from './BotBidding.js';
import { botDecideCard } from './BotPlay.js';
import { logger } from '../utils/logger.js';

const BOT_DELAY_MIN = 800;
const BOT_DELAY_MAX = 2000;

function randomDelay(): number {
  return BOT_DELAY_MIN + Math.random() * (BOT_DELAY_MAX - BOT_DELAY_MIN);
}

export class BotManager {
  private timers: Map<string, NodeJS.Timeout> = new Map();

  scheduleBotAction(engine: GameEngine, seatIndex: number): void {
    const state = engine.gameState;
    const player = state.players[seatIndex];
    if (!player.isBot && !player.isDisconnected) return;

    const timerKey = `${state.id}-${seatIndex}`;
    // Clear any existing timer
    const existing = this.timers.get(timerKey);
    if (existing) clearTimeout(existing);

    const delay = randomDelay();
    const timer = setTimeout(() => {
      this.timers.delete(timerKey);
      this.executeBotAction(engine, seatIndex);
    }, delay);

    this.timers.set(timerKey, timer);
  }

  private executeBotAction(engine: GameEngine, seatIndex: number): void {
    const state = engine.gameState;
    if (state.currentPlayerSeat !== seatIndex) return;

    if (state.phase === 'bidding' && state.biddingState) {
      const hand = engine.getPlayerHand(seatIndex);
      const decision = botDecideBid(hand, state.biddingState, seatIndex);
      engine.handleBid(seatIndex, decision.value, decision.suit);
      logger.debug({ seatIndex, bid: decision }, 'Bot placed bid');
    } else if (state.phase === 'playing' && state.currentTrick && state.contract) {
      const hand = engine.getPlayerHand(seatIndex);
      const card = botDecideCard(hand, state.currentTrick, state.contract.suit, seatIndex);
      engine.handlePlayCard(seatIndex, card);
      logger.debug({ seatIndex, card }, 'Bot played card');
    }
  }

  clearAllTimers(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  clearTimersForGame(gameId: string): void {
    for (const [key, timer] of this.timers.entries()) {
      if (key.startsWith(gameId)) {
        clearTimeout(timer);
        this.timers.delete(key);
      }
    }
  }
}
