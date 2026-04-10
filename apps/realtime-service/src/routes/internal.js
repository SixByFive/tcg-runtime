import { Router } from 'express';
import { push, broadcast } from '../connections.js';

const router = Router();

function requireInternal(req, res, next) {
  const key = req.headers['x-internal-key'];
  if (!key || key !== process.env.INTERNAL_API_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

router.use(requireInternal);

/**
 * POST /internal/push
 *
 * Push an event to one or more connected users.
 * Body: { userId?: string, userIds?: string[], event: string, data?: any }
 */
router.post('/push', (req, res) => {
  const { userId, userIds, event, data } = req.body;
  if (!event) return res.status(400).json({ error: 'event is required' });

  const targets = userIds?.length ? userIds : userId ? [userId] : [];
  if (!targets.length) return res.status(400).json({ error: 'userId or userIds required' });

  let sent = 0;
  for (const uid of targets) {
    sent += push(uid, event, data);
  }
  res.json({ ok: true, sent });
});

/**
 * POST /internal/broadcast
 *
 * Broadcast an event to every currently connected user.
 * Body: { event: string, data?: any }
 */
router.post('/broadcast', (req, res) => {
  const { event, data } = req.body;
  if (!event) return res.status(400).json({ error: 'event is required' });
  const sent = broadcast(event, data);
  res.json({ ok: true, sent });
});

export default router;
