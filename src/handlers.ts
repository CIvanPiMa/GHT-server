import type WebSocket from 'ws';
import * as store from './store.js';
import * as sessions from './sessions.js';
import type { GhtMessage, GameModel, PermissionsPayload, Permissions } from './types.js';

export const SERVER_VERSION = '1.0.0';

const PUBLIC_MODE = process.env['PUBLIC']?.toLowerCase() === 'true';

function send(ws: WebSocket, msg: Record<string, unknown>): void {
  ws.send(JSON.stringify({ serverVersion: SERVER_VERSION, ...msg }));
}

function sendError(ws: WebSocket, message: string): void {
  ws.send(JSON.stringify({ type: 'error', message, serverVersion: SERVER_VERSION }));
}

interface Resolved {
  gameId: number;
  permissions: Permissions | null;
}

/**
 * Resolves the gameId + permissions for a given WebSocket + code.
 * Uses the session's cached gameId when available, falls back to DB lookup.
 * Returns null if the code is not in the DB.
 */
function resolve(ws: WebSocket, code: string): Resolved | null {
  const session = sessions.getSession(ws);

  let gameId: number | null = session?.gameId ?? null;
  if (gameId === null) {
    gameId = store.getGameIdByCode(code);
    if (gameId !== null) {
      sessions.associateGame(ws, gameId);
    }
  }
  if (gameId === null) return null;

  const permissions = store.getPermissionsByCode(code);
  if (permissions === undefined) return null; // code not found in DB

  return { gameId, permissions };
}

export function handle(ws: WebSocket, raw: string): void {
  let msg: GhtMessage;
  try {
    msg = JSON.parse(raw) as GhtMessage;
  } catch {
    sendError(ws, 'Invalid JSON');
    return;
  }

  const code = msg.code || msg.password;

  switch (msg.type) {
    // ── request-game ───────────────────────────────────────────────────────
    case 'request-game': {
      if (!code) { sendError(ws, 'Missing code'); return; }

      let gameId = store.getGameIdByCode(code);

      if (gameId === null) {
        if (!PUBLIC_MODE) {
          sendError(ws, 'Invalid game code');
          return;
        }
        // Public mode: create a new game seeded with the client's current state
        const seed: GameModel = { ...(msg.payload as GameModel | undefined), revision: (msg.payload as GameModel | undefined)?.revision ?? 0 };
        seed.server = false;
        gameId = store.createGame(seed);
        store.saveCode(code, gameId, null); // null = root access
        console.log(`[GHT] Created game #${gameId} for code ${code.substring(0, 8)}…`);
      }

      sessions.associateGame(ws, gameId);
      const session = sessions.getSession(ws);
      if (session) session.code = code;

      const game = store.getGame(gameId);
      if (!game) { sendError(ws, 'Game not found'); return; }
      game.server = false;

      const permissions = store.getPermissionsByCode(code);
      send(ws, { type: 'game', payload: game });
      send(ws, { type: 'permissions', payload: permissions ?? null });
      break;
    }

    // ── game state updates (all behave the same server-side) ───────────────
    case 'game':
    case 'game-update':
    case 'game-undo':
    case 'game-redo': {
      if (!code) return;
      const resolved = resolve(ws, code);
      if (!resolved) { sendError(ws, 'Invalid game code'); return; }

      const gameUpdate = msg.payload as GameModel | undefined;
      if (!gameUpdate) { sendError(ws, 'Missing payload'); return; }

      gameUpdate.server = false;
      store.setGame(resolved.gameId, gameUpdate);

      sessions.broadcast(resolved.gameId, ws, JSON.stringify({
        type: msg.type,
        payload: gameUpdate,
        undoinfo: msg.undoinfo,
        revision: msg.revision,
        undolength: msg.undolength,
        serverVersion: SERVER_VERSION,
      }));
      break;
    }

    // ── settings ───────────────────────────────────────────────────────────
    case 'request-settings': {
      if (!code) return;
      const resolved = resolve(ws, code);
      if (!resolved) { sendError(ws, 'Invalid game code'); return; }

      const settings = store.getSettings(resolved.gameId);
      send(ws, { type: 'settings', payload: settings ?? null });
      break;
    }

    case 'settings': {
      if (!code) return;
      const resolved = resolve(ws, code);
      if (!resolved) { sendError(ws, 'Invalid game code'); return; }

      if (msg.payload !== undefined && msg.payload !== null) {
        store.setSettings(resolved.gameId, msg.payload);
      }
      sessions.broadcast(resolved.gameId, ws, JSON.stringify({
        type: 'settings',
        payload: msg.payload ?? null,
        serverVersion: SERVER_VERSION,
      }));
      break;
    }

    // ── permissions ────────────────────────────────────────────────────────
    case 'permissions': {
      if (!code) return;
      const resolved = resolve(ws, code);
      if (!resolved) { sendError(ws, 'Invalid game code'); return; }

      // Only root access (permissions === null) can create sub-codes
      if (resolved.permissions !== null) {
        sendError(ws, 'Cannot create permissions!');
        return;
      }

      const permPayload = msg.payload as PermissionsPayload | undefined;
      if (!permPayload) { sendError(ws, "'payload' missing"); return; }

      const newCode = permPayload.code || permPayload.password;
      if (!newCode) { sendError(ws, "invalid 'payload'"); return; }

      store.saveCode(newCode, resolved.gameId, permPayload.permissions ?? null);
      console.log(`[GHT] Sub-code created for game #${resolved.gameId}`);

      // Ask one connected client to push current state for the new sub-code client
      sessions.broadcastFirst(resolved.gameId, ws, JSON.stringify({
        type: 'requestUpdate',
        serverVersion: SERVER_VERSION,
      }));
      break;
    }

    // ── ping ───────────────────────────────────────────────────────────────
    case 'ping': {
      send(ws, { type: 'ping' });
      break;
    }

    // ── requestUpdate ──────────────────────────────────────────────────────
    case 'requestUpdate': {
      if (!code) return;
      const resolved = resolve(ws, code);
      if (!resolved) return;
      sessions.broadcastAll(resolved.gameId, JSON.stringify({
        type: 'requestUpdate',
        serverVersion: SERVER_VERSION,
      }));
      break;
    }

    // ── remoteCommand ──────────────────────────────────────────────────────
    case 'remoteCommand': {
      if (!code) return;
      const resolved = resolve(ws, code);
      if (!resolved) return;
      sessions.broadcast(resolved.gameId, ws, JSON.stringify({
        type: 'remoteCommand',
        payload: msg.payload,
        serverVersion: SERVER_VERSION,
      }));
      break;
    }

    default:
      console.warn(`[GHT] Unknown message type: ${msg.type}`);
  }
}
