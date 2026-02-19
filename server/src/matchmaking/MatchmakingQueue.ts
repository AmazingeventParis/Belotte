import { getRedis } from '../db/redis.js';
import { logger } from '../utils/logger.js';
import { MATCHMAKING_TIMEOUT_MS } from '../config/constants.js';

const QUEUE_KEY = 'belotte:matchmaking:queue';
const PLAYER_PREFIX = 'belotte:matchmaking:player:';

export interface QueuedPlayer {
  userId: string;
  username: string;
  joinedAt: number;
}

export async function addToQueue(player: QueuedPlayer): Promise<void> {
  const redis = getRedis();
  const now = Date.now();

  await redis.zadd(QUEUE_KEY, now, player.userId);
  await redis.set(
    `${PLAYER_PREFIX}${player.userId}`,
    JSON.stringify(player),
    'EX',
    30,
  );
  logger.info({ userId: player.userId }, 'Player joined matchmaking queue');
}

export async function removeFromQueue(userId: string): Promise<void> {
  const redis = getRedis();
  await redis.zrem(QUEUE_KEY, userId);
  await redis.del(`${PLAYER_PREFIX}${userId}`);
  logger.info({ userId }, 'Player left matchmaking queue');
}

export async function getQueuedPlayers(): Promise<QueuedPlayer[]> {
  const redis = getRedis();
  const members = await redis.zrange(QUEUE_KEY, 0, -1);

  const players: QueuedPlayer[] = [];
  for (const userId of members) {
    const data = await redis.get(`${PLAYER_PREFIX}${userId}`);
    if (data) {
      players.push(JSON.parse(data));
    } else {
      // Stale entry, remove it
      await redis.zrem(QUEUE_KEY, userId);
    }
  }

  return players;
}

export async function getOldestWaitTime(): Promise<number> {
  const redis = getRedis();
  const oldest = await redis.zrange(QUEUE_KEY, 0, 0, 'WITHSCORES');
  if (oldest.length < 2) return 0;
  return Date.now() - parseInt(oldest[1], 10);
}

export async function popPlayers(count: number): Promise<QueuedPlayer[]> {
  const redis = getRedis();
  const members = await redis.zrange(QUEUE_KEY, 0, count - 1);
  const players: QueuedPlayer[] = [];

  for (const userId of members) {
    const data = await redis.get(`${PLAYER_PREFIX}${userId}`);
    if (data) {
      players.push(JSON.parse(data));
    }
    await redis.zrem(QUEUE_KEY, userId);
    await redis.del(`${PLAYER_PREFIX}${userId}`);
  }

  return players;
}

export async function getQueueSize(): Promise<number> {
  const redis = getRedis();
  return redis.zcard(QUEUE_KEY);
}
