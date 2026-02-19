import { z } from 'zod';

// --- Client -> Server Messages ---

export const AuthMessage = z.object({
  type: z.literal('auth'),
  token: z.string(),
});

export const JoinQueueMessage = z.object({
  type: z.literal('join_queue'),
});

export const CancelQueueMessage = z.object({
  type: z.literal('cancel_queue'),
});

export const PlaceBidMessage = z.object({
  type: z.literal('place_bid'),
  value: z.number(),
  suit: z.enum(['hearts', 'diamonds', 'clubs', 'spades']),
});

export const PassBidMessage = z.object({
  type: z.literal('pass_bid'),
});

export const CoincheMessage = z.object({
  type: z.literal('coinche'),
});

export const SurcoincheMessage = z.object({
  type: z.literal('surcoinche'),
});

export const PlayCardMessage = z.object({
  type: z.literal('play_card'),
  suit: z.enum(['hearts', 'diamonds', 'clubs', 'spades']),
  rank: z.enum(['7', '8', '9', '10', 'jack', 'queen', 'king', 'ace']),
});

export const ReconnectMessage = z.object({
  type: z.literal('reconnect'),
  gameId: z.string(),
  token: z.string(),
});

export const PingMessage = z.object({
  type: z.literal('ping'),
});

export const LeaveGameMessage = z.object({
  type: z.literal('leave_game'),
});

export const ClientMessage = z.discriminatedUnion('type', [
  AuthMessage,
  JoinQueueMessage,
  CancelQueueMessage,
  PlaceBidMessage,
  PassBidMessage,
  CoincheMessage,
  SurcoincheMessage,
  PlayCardMessage,
  ReconnectMessage,
  PingMessage,
  LeaveGameMessage,
]);

export type ClientMessageType = z.infer<typeof ClientMessage>;

// --- Server -> Client Messages (types only, not validated) ---

export interface ServerMessage {
  type: string;
  [key: string]: unknown;
}
