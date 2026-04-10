import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { register, unregister } from '../connections.js';

const router = Router();

/**
 * GET /realtime/events
 *
 * Server-Sent Events stream. Requires a valid access token delivered via:
 *   1. ?token=<jwt>  (EventSource in the browser can't set headers)
 *   2. Cookie sbf_access
 *   3. Authorization: Bearer <jwt>
 *
 * Client receives newline-delimited JSON in the `data` field:
 *   data: {"event":"notification","data":{...},"ts":1234567890}\n\n
 *
 * A comment `: ping` is sent every 30 s to keep proxies from closing the connection.
 */
router.get('/events', (req, res) => {
  const token =
    req.query.token ||
    req.cookies?.sbf_access ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

  if (!token) return res.status(401).json({ error: 'Authentication required' });

  let payload;
  try {
    payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // prevent nginx from buffering the stream
  res.flushHeaders();

  const conn = {
    type: 'sse',
    send(data) {
      res.write(`data: ${data}\n\n`);
    },
    close() {
      res.end();
    },
  };

  register(payload.sub, conn);

  // Immediately confirm the connection
  res.write(
    `data: ${JSON.stringify({ event: 'connected', data: { userId: payload.sub }, ts: Date.now() })}\n\n`,
  );

  // Keepalive comment every 30 s
  const ping = setInterval(() => res.write(': ping\n\n'), 30_000);

  req.on('close', () => {
    clearInterval(ping);
    unregister(payload.sub, conn);
  });
});

export default router;
