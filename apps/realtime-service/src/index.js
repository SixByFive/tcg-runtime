import http from 'node:http';
import express from 'express';
import { WebSocketServer } from 'ws';
import cookieParser from 'cookie-parser';
import cookie from 'cookie';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import { getServicePort } from '@sbf/config';
import { createLogger } from '@sbf/logger';
import { register, unregister, push, broadcast, connectedUserCount } from './connections.js';
import { startRedisSubscriber } from './services/redis.sub.js';
import sseRouter from './routes/sse.js';
import internalRouter from './routes/internal.js';

const serviceName = 'realtime-service';
const logger = createLogger(serviceName);
const PORT = getServicePort('REALTIME_SERVICE_PORT', 4018);

// ─── Express ──────────────────────────────────────────────────────────────────

const app = express();
app.use(helmet());
app.use(cookieParser());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: serviceName, connections: connectedUserCount() });
});

app.use('/realtime', sseRouter);
app.use('/internal', internalRouter);

// ─── HTTP server ──────────────────────────────────────────────────────────────

const server = http.createServer(app);

// ─── WebSocket ────────────────────────────────────────────────────────────────

const wss = new WebSocketServer({ noServer: true });

/**
 * Extract a JWT from the WS upgrade request.
 * Checks (in order): ?token= query param → sbf_access cookie → Authorization header.
 */
function extractWsToken(req) {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.searchParams.has('token')) return url.searchParams.get('token');
  } catch {
    // malformed URL — fall through
  }
  const cookies = cookie.parse(req.headers.cookie || '');
  if (cookies.sbf_access) return cookies.sbf_access;
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

server.on('upgrade', (req, socket, head) => {
  if (!req.url.startsWith('/realtime/ws')) {
    socket.destroy();
    return;
  }

  const token = extractWsToken(req);
  if (!token) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  } catch {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.userId   = payload.sub;
    ws.userRole = payload.role;
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws) => {
  const conn = {
    type: 'ws',
    send(payload) {
      if (ws.readyState === ws.OPEN) ws.send(payload);
    },
    close() {
      ws.terminate();
    },
  };

  register(ws.userId, conn);
  logger.info(`WS connected: ${ws.userId} (users online: ${connectedUserCount()})`);

  // Send initial connected event
  conn.send(JSON.stringify({ event: 'connected', data: { userId: ws.userId }, ts: Date.now() }));

  // Keepalive ping every 30 s
  const ping = setInterval(() => {
    if (ws.readyState === ws.OPEN) ws.ping();
  }, 30_000);

  ws.on('close', () => {
    clearInterval(ping);
    unregister(ws.userId, conn);
    logger.info(`WS disconnected: ${ws.userId}`);
  });

  ws.on('error', (err) => {
    clearInterval(ping);
    unregister(ws.userId, conn);
    logger.error(`WS error for ${ws.userId}: ${err.message}`);
  });
});

// ─── Redis subscriber ─────────────────────────────────────────────────────────

startRedisSubscriber({ push, broadcast });

// ─── Start ────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  logger.info(`${serviceName} listening on port ${PORT}`);
});
