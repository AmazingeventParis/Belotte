import { Card } from './Card.js';

export interface Player {
  id: string;
  username: string;
  seatIndex: number;
  teamIndex: number; // 0 or 1 (seats 0,2 = team 0; seats 1,3 = team 1)
  isBot: boolean;
  isDisconnected: boolean;
  hand: Card[];
}

export function getTeamIndex(seatIndex: number): number {
  return seatIndex % 2; // 0,2 -> team 0; 1,3 -> team 1
}

export function getPartnerSeat(seatIndex: number): number {
  return (seatIndex + 2) % 4;
}

export function isPartner(seat1: number, seat2: number): boolean {
  return getTeamIndex(seat1) === getTeamIndex(seat2);
}
