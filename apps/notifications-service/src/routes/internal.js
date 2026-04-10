/**
 * Internal service-to-service endpoints.
 * Protected by INTERNAL_API_KEY header — not exposed through the gateway.
 */
import { Router } from 'express';
import { Notification } from '../models/index.js';
import { notifyUser } from '../services/notify.service.js';

const router = Router();

function requireInternal(req, res, next) {
  const key = process.env.INTERNAL_API_KEY;
  if (!key) return res.status(503).json({ error: 'Internal API not configured' });
  if (req.headers['x-internal-key'] !== key) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.use(requireInternal);

// POST /internal/notify — send a notification to one user
router.post('/notify', async (req, res) => {
  const { userId, type, title, body, iconUrl, linkUrl, meta, isSilent, expiresAt, userEmail } = req.body;

  if (!userId || !type || !title || !body) {
    return res.status(400).json({ error: 'userId, type, title and body are required' });
  }

  try {
    const notification = await notifyUser({
      userId, type, title, body, iconUrl, linkUrl, meta,
      isSilent: !!isSilent,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      userEmail,
    });
    res.status(201).json(notification);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /internal/broadcast — send to all users (stored as isBroadcast, no per-user rows)
router.post('/broadcast', async (req, res) => {
  const { type, title, body, iconUrl, linkUrl, meta, expiresAt } = req.body;

  if (!type || !title || !body) {
    return res.status(400).json({ error: 'type, title and body are required' });
  }

  try {
    const notification = await Notification.create({
      userId: null,
      type, title, body, iconUrl, linkUrl, meta,
      isBroadcast: true,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });
    res.status(201).json(notification);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
