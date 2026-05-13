import { db } from './db.js';
import type { GameModel, Permissions } from './types.js';

// ── Game codes ────────────────────────────────────────────────────────────────

export function getGameIdByCode(code: string): number | null {
  const row = db
    .prepare<[string], { game_id: number }>('SELECT game_id FROM game_codes WHERE code = ?')
    .get(code);
  return row?.game_id ?? null;
}

/**
 * Returns:
 *   null        → code exists, root access (DB permissions IS NULL)
 *   Permissions → code exists, restricted access
 *   undefined   → code does not exist in DB
 */
export function getPermissionsByCode(code: string): Permissions | null | undefined {
  const row = db
    .prepare<[string], { permissions: string | null }>('SELECT permissions FROM game_codes WHERE code = ?')
    .get(code);
  if (row === undefined) return undefined;
  return row.permissions ? (JSON.parse(row.permissions) as Permissions) : null;
}

export function saveCode(code: string, gameId: number, permissions: Permissions | null): void {
  db
    .prepare('INSERT OR REPLACE INTO game_codes (code, game_id, permissions) VALUES (?, ?, ?)')
    .run(code, gameId, permissions !== null ? JSON.stringify(permissions) : null);
}

// ── Games ─────────────────────────────────────────────────────────────────────

export function getGame(id: number): GameModel | null {
  const row = db
    .prepare<[number], { game: string }>('SELECT game FROM games WHERE id = ?')
    .get(id);
  return row ? (JSON.parse(row.game) as GameModel) : null;
}

export function createGame(gameModel: GameModel): number {
  const result = db.prepare('INSERT INTO games (game) VALUES (?)').run(JSON.stringify(gameModel));
  return Number(result.lastInsertRowid);
}

export function setGame(id: number, gameModel: GameModel): void {
  db.prepare('UPDATE games SET game = ? WHERE id = ?').run(JSON.stringify(gameModel), id);
}

// ── Settings ──────────────────────────────────────────────────────────────────

export function getSettings(gameId: number): unknown | null {
  const row = db
    .prepare<[number], { settings: string }>('SELECT settings FROM settings WHERE game_id = ?')
    .get(gameId);
  return row ? JSON.parse(row.settings) : null;
}

export function setSettings(gameId: number, settings: unknown): void {
  db
    .prepare('INSERT OR REPLACE INTO settings (game_id, settings) VALUES (?, ?)')
    .run(gameId, JSON.stringify(settings));
}

// ── UI helpers ────────────────────────────────────────────────────────────────

export interface GameSummary {
  id: number;
  revision: number;
  codes: string[];
}

export function listGames(): GameSummary[] {
  const games = db
    .prepare<[], { id: number; game: string }>('SELECT id, game FROM games ORDER BY id')
    .all();
  const codesStmt = db.prepare<[number], { code: string }>('SELECT code FROM game_codes WHERE game_id = ?');
  return games.map((row) => {
    const model = JSON.parse(row.game) as GameModel;
    const codes = codesStmt.all(row.id).map((c) => c.code);
    return { id: row.id, revision: model.revision, codes };
  });
}
