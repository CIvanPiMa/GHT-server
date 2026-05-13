import type WebSocket from 'ws';
import type { SessionMeta } from './types.js';

const WS_OPEN = 1; // WebSocket.OPEN

const sessionMeta = new Map<WebSocket, SessionMeta>();
const gameClients = new Map<number, Set<WebSocket>>();

export function initSession(ws: WebSocket): void {
  console.log('[GHT] Initializing session for WebSocket');
  sessionMeta.set(ws, { gameId: null, code: null });
}

export function getSession(ws: WebSocket): SessionMeta | undefined {
  return sessionMeta.get(ws);
}

export function associateGame(ws: WebSocket, gameId: number): void {
  const meta = sessionMeta.get(ws);
  if (!meta) return;

  // Remove from old game bucket if re-associating
  if (meta.gameId !== null) {
    console.log(`[GHT] Session re-associated from game #${meta.gameId} to game #${gameId}`);
    gameClients.get(meta.gameId)?.delete(ws);
  } else {
    console.log(`[GHT] Session associated with game #${gameId}`);
  }

  meta.gameId = gameId;

  if (!gameClients.has(gameId)) {
    gameClients.set(gameId, new Set());
  }
  gameClients.get(gameId)!.add(ws);
  console.log(`[GHT] Game #${gameId} now has ${gameClients.get(gameId)!.size} connected client(s)`);
}

/** Send to all connected clients for a game except the sender. */
export function broadcast(gameId: number, sender: WebSocket, message: string): void {
  const clients = gameClients.get(gameId);
  if (!clients) return;
  for (const client of clients) {
    if (client !== sender && client.readyState === WS_OPEN) {
      client.send(message);
    }
  }
}

/** Send to all connected clients for a game including the sender. */
export function broadcastAll(gameId: number, message: string): void {
  const clients = gameClients.get(gameId);
  if (!clients) return;
  for (const client of clients) {
    if (client.readyState === WS_OPEN) {
      client.send(message);
    }
  }
}

/** Send to the first connected client for a game that is not the sender. */
export function broadcastFirst(gameId: number, sender: WebSocket, message: string): void {
  const clients = gameClients.get(gameId);
  if (!clients) return;
  for (const client of clients) {
    if (client !== sender && client.readyState === WS_OPEN) {
      client.send(message);
      return;
    }
  }
}

export function removeSession(ws: WebSocket): void {
  const meta = sessionMeta.get(ws);
  if (meta?.gameId !== null && meta?.gameId !== undefined) {
    const bucket = gameClients.get(meta.gameId);
    bucket?.delete(ws);
    const remaining = bucket?.size ?? 0;
    if (remaining === 0) {
      gameClients.delete(meta.gameId);
      console.log(`[GHT] Session removed — game #${meta.gameId} has no more clients`);
    } else {
      console.log(`[GHT] Session removed — game #${meta.gameId} has ${remaining} client(s) remaining`);
    }
  } else {
    console.log('[GHT] Session removed (no associated game)');
  }
  sessionMeta.delete(ws);
}
