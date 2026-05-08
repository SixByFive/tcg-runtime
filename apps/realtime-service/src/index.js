import http from 'node:http';
import express from 'express';
import { WebSocketServer } from 'ws';
import { Server as SocketIO } from 'socket.io';
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

// ─── Socket.IO ────────────────────────────────────────────────────────────────
// The frontend connects Socket.IO to /realtime/socket.io.

const allowedSioOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ...(process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : []),
];

const io = new SocketIO(server, {
  path: '/realtime/socket.io',
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedSioOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  },
  // Allow token via query param, cookie, or Authorization header
  allowRequest: (req, callback) => callback(null, true),
});

/**
 * Extract JWT from a Socket.IO handshake.
 * Priority: handshake.auth.token → query.token → cookie → Authorization header
 */
function extractSioToken(socket) {
  const { auth, headers, query } = socket.handshake;
  if (auth?.token) return auth.token;
  if (query?.token) return query.token;
  const cookies = cookie.parse(headers.cookie || '');
  if (cookies.sbf_access) return cookies.sbf_access;
  const authHeader = headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7);
  return null;
}

io.use((socket, next) => {
  const token = extractSioToken(socket);
  if (!token) {
    return next(new Error('Authentication required'));
  }
  try {
    const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    socket.userId = payload.sub;
    socket.userRole = payload.role ?? null;
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
});

io.on('connection', (socket) => {
  const conn = {
    type: 'sio',
    send(payload) {
      try {
        const { event, data } = JSON.parse(payload);
        socket.emit(event, data);
      } catch {
        socket.emit('message', payload);
      }
    },
    close() {
      socket.disconnect(true);
    },
  };

  register(socket.userId, conn);
  logger.info(`Socket.IO connected: ${socket.userId} (users online: ${connectedUserCount()})`);

  socket.emit('connected', { userId: socket.userId });

  socket.on('disconnect', () => {
    unregister(socket.userId, conn);
    logger.info(`Socket.IO disconnected: ${socket.userId}`);
  });

  socket.on('error', (err) => {
    unregister(socket.userId, conn);
    logger.error(`Socket.IO error for ${socket.userId}: ${err.message}`);
  });
});

// ─── Raw WebSocket ────────────────────────────────────────────────────────────
// Kept for backwards compatibility / SSE fallback clients.

const wss = new WebSocketServer({ noServer: true });

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
  // Socket.IO manages its own upgrade for /realtime/socket.io paths
  if (req.url.startsWith('/realtime/socket.io')) return;

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

  conn.send(JSON.stringify({ event: 'connected', data: { userId: ws.userId }, ts: Date.now() }));

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
