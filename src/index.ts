import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import './db.js'; // initialize DB on startup
import { handle } from './handlers.js';
import { initSession, removeSession } from './sessions.js';
import { listGames, createGame, saveCode } from './store.js';
import { UI_HTML } from './ui.js';

const PORT = parseInt(process.env['PORT'] ?? '8080', 10);

const httpServer = createServer((req, res) => {
  console.log(`[GHT] HTTP ${req.method} ${req.url}`);
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(UI_HTML);
  } else if (req.method === 'GET' && req.url === '/games') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(listGames()));
  } else if (req.method === 'POST' && req.url === '/games') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const { code } = JSON.parse(body) as { code?: string };
        if (!code || typeof code !== 'string' || !code.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'code is required' }));
          return;
        }
        const trimmedCode = code.trim();
        const gameId = createGame({ revision: 0 });
        saveCode(trimmedCode, gameId, null);
        console.log(`[GHT] Created game #${gameId} via UI with code ${trimmedCode.substring(0, 8)}…`);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: gameId }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
    });
  } else {
    console.warn(`[GHT] HTTP 404 — ${req.method} ${req.url}`);
    res.writeHead(404);
    res.end();
  }
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  console.log('[GHT] WebSocket connected');
  initSession(ws);

  ws.on('message', (data) => {
    console.log('[GHT] Received message:', data.toString().slice(0, 10));
    handle(ws, data.toString());
  });

  ws.on('close', () => {
    console.log('[GHT] WebSocket disconnected');
    removeSession(ws);
  });

  ws.on('error', (err) => {
    console.error('[GHT] WebSocket error:', err.message);
    removeSession(ws);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[GHT] Server listening on port ${PORT}`);
  console.log(`[GHT] PUBLIC mode: ${process.env['PUBLIC']?.toLowerCase() === 'true'}`);
});
