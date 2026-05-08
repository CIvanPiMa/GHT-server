# GHT Server

WebSocket sync server for [GH Tracker](https://github.com/CIvanPiMa/GHT). Persists game state in SQLite and broadcasts changes to all connected clients in real time.

## Stack

Node.js · TypeScript · [`ws`](https://github.com/websockets/ws) · [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3)

## Quickstart (Docker Compose)

The easiest way to run both the app and the server together. Docker builds both images directly from GitHub — no local clone of either repo required:

```bash
curl -O https://raw.githubusercontent.com/CIvanPiMa/GHT/main/docker-compose.yml
docker compose up --build
```

- Angular app → `http://localhost:8081`
- Sync server → `ws://localhost:8082`
- Game state is persisted in a named Docker volume (`ght-server-data`)

## Standalone

```bash
npm install
npm run dev          # development (ts-node-dev, live reload)
npm run build && npm start   # production
```

## Environment Variables

| Variable   | Default  | Description                                                   |
| ---------- | -------- | ------------------------------------------------------------- |
| `PORT`     | `8080`   | WebSocket + HTTP port                                         |
| `DATA_DIR` | `~/.ght` | Directory where `ght-server.sqlite` is stored                 |
| `PUBLIC`   | `false`  | If `true`, any new room code automatically creates a new game |

## Connecting the App

1. Open GH Tracker → hamburger menu → **Server**
2. **Host**: your server IP or hostname
3. **Port**: `8082`
4. **Room Code**: any UUID (e.g. from [uuidgenerator.net](https://www.uuidgenerator.net))
5. Share the same room code with other players to sync

## Protocol

The server implements the GHT WebSocket protocol (reverse-engineered from [`StateManager.ts`](https://github.com/CIvanPiMa/GHT/blob/main/src/app/game/businesslogic/StateManager.ts)):

| Message type                       | Behaviour                                                       |
| ---------------------------------- | --------------------------------------------------------------- |
| `request-game`                     | Send stored `GameModel` to client; create game if `PUBLIC=true` |
| `game` / `game-undo` / `game-redo` | Persist state; broadcast to other clients                       |
| `settings` / `request-settings`    | Persist and broadcast settings                                  |
| `permissions`                      | Root-only; register a new sub-code with restricted access       |
| `ping`                             | No-op keep-alive                                                |
| `remoteCommand` / `requestUpdate`  | Broadcast to all room clients                                   |

Room auth: the room code (UUID) is the only credential. `NULL` DB permissions = root access; a JSON `Permissions` object = restricted access.
