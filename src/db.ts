import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const dataDir = process.env['DATA_DIR'] ?? join(homedir(), '.ght');
mkdirSync(dataDir, { recursive: true });

const dbPath = join(dataDir, 'ght-server.sqlite');
export const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    game  TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS game_codes (
    code        TEXT PRIMARY KEY,
    game_id     INTEGER NOT NULL REFERENCES games(id),
    permissions TEXT
  );
  CREATE TABLE IF NOT EXISTS settings (
    game_id   INTEGER PRIMARY KEY REFERENCES games(id),
    settings  TEXT NOT NULL
  );
`);

console.log(`[GHT] Database initialized at ${dbPath}`);
