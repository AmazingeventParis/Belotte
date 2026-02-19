import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { verifyToken, JwtPayload } from '../auth/jwt.js';
import { ClientMessage } from './MessageTypes.js';
import { serializeForPlayer } from './GameStateSerializer.js';
import { roomManager, GameRoom } from '../matchmaking/RoomManager.js';
import {
  addToQueue, removeFromQueue, getQueuedPlayers, popPlayers,
  getOldestWaitTime, getQueueSize,
} from '../matchmaking/MatchmakingQueue.js';
import { GameEngine, GameEvent } from '../engine/GameEngine.js';
import { Suit, Rank, Card } from '../models/Card.js';
import { MATCHMAKING_TIMEOUT_MS } from '../config/constants.js';
import { logger } from '../utils/logger.js';

interface AuthenticatedSocket {
  ws: WebSocket;
  userId: string;
  username: string;
  gameId: string | null;
}

export class GameWebSocketServer {
  private wss: WSServer;
  private clients: Map<string, AuthenticatedSocket> = new Map(); // userId -> socket
  private matchmakingInterval: NodeJS.Timeout | null = null;

  constructor(httpServer: HttpServer) {
    this.wss = new WSServer({ server: httpServer, path: '/ws' });
    this.wss.on('connection', (ws) => this.handleConnection(ws));
    this.startMatchmakingLoop();
    logger.info('WebSocket server initialized on /ws');
  }

  private handleConnection(ws: WebSocket): void {
    let authenticated = false;
    let authTimeout: NodeJS.Timeout;

    // Auth timeout: 5 seconds
    authTimeout = setTimeout(() => {
      if (!authenticated) {
        this.send(ws, { type: 'auth_error', message: 'Authentication timeout' });
        ws.close();
      }
    }, 5000);

    ws.on('message', (data) => {
      try {
        const raw = JSON.parse(data.toString());
        const parsed = ClientMessage.safeParse(raw);
        if (!parsed.success) {
          this.send(ws, { type: 'error', code: 'INVALID_MESSAGE', message: 'Invalid message format' });
          return;
        }

        const msg = parsed.data;

        if (msg.type === 'auth') {
          const payload = verifyToken(msg.token);
          if (!payload) {
            this.send(ws, { type: 'auth_error', message: 'Invalid token' });
            ws.close();
            return;
          }

          clearTimeout(authTimeout);
          authenticated = true;

          // Close any existing connection for this user
          const existing = this.clients.get(payload.userId);
          if (existing) {
            existing.ws.close();
          }

          const client: AuthenticatedSocket = {
            ws,
            userId: payload.userId,
            username: payload.username,
            gameId: roomManager.getGameIdByPlayer(payload.userId) || null,
          };
          this.clients.set(payload.userId, client);

          this.send(ws, { type: 'auth_ok', userId: payload.userId, username: payload.username });

          // If player was in a game, auto-reconnect
          if (client.gameId) {
            this.handleReconnect(client);
          }

          ws.on('close', () => this.handleDisconnect(client));
          return;
        }

        if (!authenticated) {
          this.send(ws, { type: 'error', code: 'NOT_AUTHENTICATED', message: 'Must authenticate first' });
          return;
        }

        // Find the authenticated client
        const client = [...this.clients.values()].find(c => c.ws === ws);
        if (!client) return;

        this.handleMessage(client, msg);
      } catch (err) {
        logger.error({ err }, 'WebSocket message error');
        this.send(ws, { type: 'error', code: 'INTERNAL', message: 'Internal error' });
      }
    });

    ws.on('error', (err) => {
      logger.error({ err }, 'WebSocket error');
    });

    // Ping/pong keepalive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 15000);

    ws.on('close', () => {
      clearInterval(pingInterval);
      clearTimeout(authTimeout);
    });
  }

  private handleMessage(client: AuthenticatedSocket, msg: any): void {
    switch (msg.type) {
      case 'ping':
        this.send(client.ws, { type: 'pong' });
        break;

      case 'join_queue':
        this.handleJoinQueue(client);
        break;

      case 'cancel_queue':
        this.handleCancelQueue(client);
        break;

      case 'place_bid':
        this.handlePlaceBid(client, msg.value, msg.suit as Suit);
        break;

      case 'pass_bid':
        this.handlePassBid(client);
        break;

      case 'coinche':
        this.handleCoinche(client);
        break;

      case 'surcoinche':
        this.handleSurcoinche(client);
        break;

      case 'play_card':
        this.handlePlayCard(client, { suit: msg.suit as Suit, rank: msg.rank as Rank });
        break;

      case 'reconnect':
        client.gameId = msg.gameId;
        this.handleReconnect(client);
        break;
    }
  }

  private async handleJoinQueue(client: AuthenticatedSocket): Promise<void> {
    if (client.gameId) {
      this.send(client.ws, { type: 'error', code: 'ALREADY_IN_GAME', message: 'Already in a game' });
      return;
    }

    await addToQueue({
      userId: client.userId,
      username: client.username,
      joinedAt: Date.now(),
    });

    const size = await getQueueSize();
    this.send(client.ws, { type: 'queue_joined', position: size });
  }

  private async handleCancelQueue(client: AuthenticatedSocket): Promise<void> {
    await removeFromQueue(client.userId);
    this.send(client.ws, { type: 'queue_left' });
  }

  private handlePlaceBid(client: AuthenticatedSocket, value: number, suit: Suit): void {
    const room = this.getClientRoom(client);
    if (!room) return;
    const seat = this.getPlayerSeat(room, client.userId);
    if (seat === -1) return;

    const success = room.engine.handleBid(seat, value, suit);
    if (!success) {
      this.send(client.ws, { type: 'error', code: 'INVALID_BID', message: 'Invalid bid' });
    }
  }

  private handlePassBid(client: AuthenticatedSocket): void {
    const room = this.getClientRoom(client);
    if (!room) return;
    const seat = this.getPlayerSeat(room, client.userId);
    if (seat === -1) return;

    const success = room.engine.handleBid(seat, 'pass');
    if (!success) {
      this.send(client.ws, { type: 'error', code: 'INVALID_BID', message: 'Cannot pass now' });
    }
  }

  private handleCoinche(client: AuthenticatedSocket): void {
    const room = this.getClientRoom(client);
    if (!room) return;
    const seat = this.getPlayerSeat(room, client.userId);
    if (seat === -1) return;

    const success = room.engine.handleBid(seat, 'coinche');
    if (!success) {
      this.send(client.ws, { type: 'error', code: 'INVALID_BID', message: 'Cannot coinche now' });
    }
  }

  private handleSurcoinche(client: AuthenticatedSocket): void {
    const room = this.getClientRoom(client);
    if (!room) return;
    const seat = this.getPlayerSeat(room, client.userId);
    if (seat === -1) return;

    const success = room.engine.handleBid(seat, 'surcoinche');
    if (!success) {
      this.send(client.ws, { type: 'error', code: 'INVALID_BID', message: 'Cannot surcoinche now' });
    }
  }

  private handlePlayCard(client: AuthenticatedSocket, card: Card): void {
    const room = this.getClientRoom(client);
    if (!room) return;
    const seat = this.getPlayerSeat(room, client.userId);
    if (seat === -1) return;

    const success = room.engine.handlePlayCard(seat, card);
    if (!success) {
      this.send(client.ws, { type: 'error', code: 'INVALID_PLAY', message: 'Invalid card play' });
    }
  }

  private handleReconnect(client: AuthenticatedSocket): void {
    if (!client.gameId) return;
    const room = roomManager.getRoom(client.gameId);
    if (!room) {
      client.gameId = null;
      this.send(client.ws, { type: 'error', code: 'GAME_NOT_FOUND', message: 'Game no longer exists' });
      return;
    }

    const seat = this.getPlayerSeat(room, client.userId);
    if (seat === -1) {
      this.send(client.ws, { type: 'error', code: 'NOT_IN_GAME', message: 'Not a player in this game' });
      return;
    }

    // Mark player as reconnected
    room.engine.gameState.players[seat].isDisconnected = false;
    room.playerConnections.set(client.userId, client.ws);

    // Send full game state
    const state = serializeForPlayer(room.engine.gameState, seat);
    this.send(client.ws, { type: 'game_state', ...state });

    // Notify others
    this.broadcastToRoom(room, { type: 'player_reconnected', seatIndex: seat }, client.userId);

    logger.info({ userId: client.userId, gameId: client.gameId }, 'Player reconnected');
  }

  private handleDisconnect(client: AuthenticatedSocket): void {
    this.clients.delete(client.userId);

    // Remove from matchmaking queue
    removeFromQueue(client.userId).catch(() => {});

    // Mark as disconnected in game
    if (client.gameId) {
      const room = roomManager.getRoom(client.gameId);
      if (room) {
        const seat = this.getPlayerSeat(room, client.userId);
        if (seat !== -1) {
          room.engine.gameState.players[seat].isDisconnected = true;
          room.playerConnections.delete(client.userId);
          this.broadcastToRoom(room, { type: 'player_disconnected', seatIndex: seat });

          // If it's this player's turn, schedule bot action
          if (room.engine.gameState.currentPlayerSeat === seat) {
            room.botManager.scheduleBotAction(room.engine, seat);
          }
        }
      }
    }

    logger.info({ userId: client.userId }, 'Player disconnected');
  }

  // --- Matchmaking Loop ---

  private startMatchmakingLoop(): void {
    this.matchmakingInterval = setInterval(async () => {
      try {
        await this.processMatchmaking();
      } catch (err) {
        logger.error({ err }, 'Matchmaking error');
      }
    }, 500);
  }

  private async processMatchmaking(): Promise<void> {
    const queueSize = await getQueueSize();
    if (queueSize === 0) return;

    if (queueSize >= 4) {
      // Full match
      const players = await popPlayers(4);
      if (players.length === 4) {
        this.createAndStartGame(players);
      }
      return;
    }

    // Check timeout
    const waitTime = await getOldestWaitTime();
    if (waitTime >= MATCHMAKING_TIMEOUT_MS) {
      const players = await popPlayers(queueSize);
      if (players.length > 0) {
        this.createAndStartGame(players);
      }
    }
  }

  private createAndStartGame(humanPlayers: { userId: string; username: string; joinedAt: number }[]): void {
    const room = roomManager.createRoom(humanPlayers);
    const engine = room.engine;

    // Wire up game events to broadcast
    engine.onEvent((event: GameEvent) => {
      this.broadcastGameEvent(room, event);
    });

    // Notify all human players
    for (const player of engine.gameState.players) {
      if (player.isBot) continue;

      const client = this.clients.get(player.id);
      if (client) {
        client.gameId = engine.id;
        room.playerConnections.set(player.id, client.ws);

        this.send(client.ws, {
          type: 'game_start',
          gameId: engine.id,
          yourSeat: player.seatIndex,
          players: engine.gameState.players.map(p => ({
            seatIndex: p.seatIndex,
            username: p.username,
            isBot: p.isBot,
            teamIndex: p.teamIndex,
          })),
          dealerSeat: engine.gameState.dealerSeat,
        });
      }
    }

    // Start the game
    engine.startGame();
  }

  private broadcastGameEvent(room: GameRoom, event: GameEvent): void {
    const engine = room.engine;

    // For certain events, send personalized data
    if (event.type === 'deal') {
      for (const player of engine.gameState.players) {
        if (player.isBot) continue;
        const client = this.clients.get(player.id);
        if (client) {
          this.send(client.ws, {
            type: 'deal',
            cards: engine.getPlayerHand(player.seatIndex),
          });
        }
      }
      return;
    }

    if (event.type === 'play_turn') {
      // Send legal cards only to the active player
      for (const player of engine.gameState.players) {
        if (player.isBot) continue;
        const client = this.clients.get(player.id);
        if (client) {
          const isMyTurn = player.seatIndex === event.data.seatIndex;
          this.send(client.ws, {
            type: 'play_turn',
            seatIndex: event.data.seatIndex,
            legalCards: isMyTurn ? engine.getLegalCardsForPlayer(player.seatIndex) : undefined,
          });
        }
      }
      return;
    }

    if (event.type === 'bidding_turn') {
      for (const player of engine.gameState.players) {
        if (player.isBot) continue;
        const client = this.clients.get(player.id);
        if (client) {
          this.send(client.ws, {
            type: 'bidding_turn',
            seatIndex: event.data.seatIndex,
          });
        }
      }
      return;
    }

    // Generic broadcast for other events
    this.broadcastToRoom(room, { type: event.type, ...event.data });
  }

  private broadcastToRoom(room: GameRoom, message: any, excludeUserId?: string): void {
    for (const player of room.engine.gameState.players) {
      if (player.isBot) continue;
      if (excludeUserId && player.id === excludeUserId) continue;
      const client = this.clients.get(player.id);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        this.send(client.ws, message);
      }
    }
  }

  private getClientRoom(client: AuthenticatedSocket): GameRoom | undefined {
    if (!client.gameId) {
      this.send(client.ws, { type: 'error', code: 'NOT_IN_GAME', message: 'Not in a game' });
      return undefined;
    }
    const room = roomManager.getRoom(client.gameId);
    if (!room) {
      this.send(client.ws, { type: 'error', code: 'GAME_NOT_FOUND', message: 'Game not found' });
      return undefined;
    }
    return room;
  }

  private getPlayerSeat(room: GameRoom, userId: string): number {
    const player = room.engine.gameState.players.find(p => p.id === userId);
    return player ? player.seatIndex : -1;
  }

  private send(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  close(): void {
    if (this.matchmakingInterval) {
      clearInterval(this.matchmakingInterval);
    }
    this.wss.close();
  }
}
