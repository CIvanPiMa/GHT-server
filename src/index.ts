import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { WebSocketServer } from 'ws';
import './db.js'; // initialize DB on startup
import { handle } from './handlers.js';
import { initSession, removeSession } from './sessions.js';
import { listGames, createGame, saveCode } from './store.js';
import { UI_HTML, LOGIN_HTML } from './ui.js';
import { verifyPassword, createSession, validateSession, deleteSession, parseCookies } from './auth.js';

const PORT = parseInt(process.env['PORT'] ?? '8080', 10);
const SESSION_COOKIE = 'ght_session';

function isAuthenticated(req: IncomingMessage): boolean {
  const cookies = parseCookies(req.headers['cookie']);
  return validateSession(cookies[SESSION_COOKIE]);
}

function redirectToLogin(res: ServerResponse): void {
  res.writeHead(302, { Location: '/login' });
  res.end();
}

const httpServer = createServer((req, res) => {
  console.log(`[GHT] HTTP ${req.method} ${req.url}`);

  if (req.method === 'GET' && req.url === '/login') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(LOGIN_HTML);
    return;
  }

  if (req.method === 'POST' && req.url === '/login') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const { password } = JSON.parse(body) as { password?: string };
        if (!password || !verifyPassword(password)) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid password' }));
          return;
        }
        const token = createSession();
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/`,
        });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/logout') {
    const cookies = parseCookies(req.headers['cookie']);
    deleteSession(cookies[SESSION_COOKIE]);
    res.writeHead(302, {
      Location: '/login',
      'Set-Cookie': `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
    });
    res.end();
    return;
  }

  if (!isAuthenticated(req)) {
    redirectToLogin(res);
    return;
  }

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
