import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import './db.js'; // initialize DB on startup
import { handle } from './handlers.js';
import { initSession, removeSession } from './sessions.js';

const PORT = parseInt(process.env['PORT'] ?? '8080', 10);

const httpServer = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', version: '1.0.0' }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  initSession(ws);

  ws.on('message', (data) => {
    handle(ws, data.toString());
  });

  ws.on('close', () => {
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
