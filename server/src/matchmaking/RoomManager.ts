import { v4 as uuid } from 'uuid';
import { GameEngine } from '../engine/GameEngine.js';
import { Player, getTeamIndex } from '../models/Player.js';
import { BotManager } from '../bot/BotManager.js';
import { QueuedPlayer } from './MatchmakingQueue.js';
import { logger } from '../utils/logger.js';

const BOT_NAMES = ['Bot Alice', 'Bot Bob', 'Bot Charlie', 'Bot Diana'];

export interface GameRoom {
  engine: GameEngine;
  botManager: BotManager;
  playerConnections: Map<string, unknown>; // userId -> ws connection
  createdAt: Date;
}

class RoomManagerClass {
  private rooms: Map<string, GameRoom> = new Map();
  private playerToRoom: Map<string, string> = new Map(); // userId -> gameId

  createRoom(humanPlayers: QueuedPlayer[]): GameRoom {
    const players: Player[] = [];
    const seats = [0, 1, 2, 3];

    // Shuffle seats randomly
    for (let i = seats.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [seats[i], seats[j]] = [seats[j], seats[i]];
    }

    let botIndex = 0;
    for (let i = 0; i < 4; i++) {
      const seat = seats[i];
      if (i < humanPlayers.length) {
        players.push({
          id: humanPlayers[i].userId,
          username: humanPlayers[i].username,
          seatIndex: seat,
          teamIndex: getTeamIndex(seat),
          isBot: false,
          isDisconnected: false,
          hand: [],
        });
      } else {
        players.push({
          id: `bot-${uuid()}`,
          username: BOT_NAMES[botIndex++],
          seatIndex: seat,
          teamIndex: getTeamIndex(seat),
          isBot: true,
          isDisconnected: false,
          hand: [],
        });
      }
    }

    // Sort players by seat index for the engine
    players.sort((a, b) => a.seatIndex - b.seatIndex);

    const engine = new GameEngine(players);
    const botManager = new BotManager();

    const room: GameRoom = {
      engine,
      botManager,
      playerConnections: new Map(),
      createdAt: new Date(),
    };

    this.rooms.set(engine.id, room);

    // Map human players to this room
    for (const hp of humanPlayers) {
      this.playerToRoom.set(hp.userId, engine.id);
    }

    // Set up bot action scheduling
    engine.onEvent((event) => {
      if (event.type === 'bidding_turn' || event.type === 'play_turn') {
        const seat = event.data.seatIndex as number;
        const player = engine.gameState.players[seat];
        if (player.isBot || player.isDisconnected) {
          botManager.scheduleBotAction(engine, seat);
        }
      }

      if (event.type === 'game_over') {
        botManager.clearTimersForGame(engine.id);
      }
    });

    logger.info({
      gameId: engine.id,
      humans: humanPlayers.length,
      bots: 4 - humanPlayers.length,
    }, 'Game room created');

    return room;
  }

  getRoom(gameId: string): GameRoom | undefined {
    return this.rooms.get(gameId);
  }

  getRoomByPlayer(userId: string): GameRoom | undefined {
    const gameId = this.playerToRoom.get(userId);
    if (!gameId) return undefined;
    return this.rooms.get(gameId);
  }

  getGameIdByPlayer(userId: string): string | undefined {
    return this.playerToRoom.get(userId);
  }

  destroyRoom(gameId: string): void {
    const room = this.rooms.get(gameId);
    if (!room) return;

    room.botManager.clearAllTimers();

    // Remove player mappings
    for (const player of room.engine.gameState.players) {
      if (!player.isBot) {
        this.playerToRoom.delete(player.id);
      }
    }

    this.rooms.delete(gameId);
    logger.info({ gameId }, 'Game room destroyed');
  }

  get activeRoomCount(): number {
    return this.rooms.size;
  }
}

export const roomManager = new RoomManagerClass();
