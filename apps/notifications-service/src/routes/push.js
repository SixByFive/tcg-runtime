import { Router } from 'express';
import webpush from 'web-push';
import { requireAuth } from '@sbf/auth';
import { PushToken, WebPushSubscription } from '../models/index.js';

// ─── VAPID setup ─────────────────────────────────────────────────────────────
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:no-reply@sixbyfive.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

const router = Router();
router.use(requireAuth);

// POST /push/register — register an Expo push token
router.post('/register', async (req, res) => {
  const { expoPushToken, platform, deviceName, appVersion } = req.body;
  if (!expoPushToken) return res.status(400).json({ error: 'expoPushToken is required' });

  try {
    const [record, created] = await PushToken.findOrCreate({
      where: { token: expoPushToken },
      defaults: {
        userId:     req.user.sub,
        token:      expoPushToken,
        platform:   platform   || null,
        deviceName: deviceName || null,
        appVersion: appVersion || null,
        isActive:   true,
      },
    });
    if (!created) {
      await record.update({ userId: req.user.sub, isActive: true, platform, deviceName, appVersion });
    }
    res.status(created ? 201 : 200).json({ ok: true, registered: true, tokenCount: 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /push/unregister — remove an Expo push token
router.post('/unregister', async (req, res) => {
  const { expoPushToken } = req.body;
  if (!expoPushToken) return res.status(400).json({ error: 'expoPushToken is required' });

  try {
    const deleted = await PushToken.destroy({
      where: { token: expoPushToken, userId: req.user.sub },
    });
    res.json({ ok: true, removed: deleted > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /push/test — send a test push to all user's tokens
router.post('/test', async (req, res) => {
  const { title, body } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'title and body are required' });

  try {
    const tokens = await PushToken.findAll({
      where: { userId: req.user.sub, isActive: true },
      limit: 25,
    });

    if (!tokens.length) {
      return res.json({ ok: true, sent: 0, message: 'No registered push tokens' });
    }

    // Send via Expo Push API if configured, otherwise log
    const EXPO_URL = 'https://exp.host/--/api/v2/push/send';
    const messages = tokens.map(t => ({
      to:    t.token,
      title,
      body,
      data:  { test: true },
    }));

    try {
      await fetch(EXPO_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(messages),
      });
    } catch {
      // Best-effort — don't fail the request if Expo is unreachable
    }

    res.json({ ok: true, sent: tokens.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /push/tokens — list user's registered tokens
router.get('/tokens', async (req, res) => {
  try {
    const tokens = await PushToken.findAll({
      where: { userId: req.user.sub, isActive: true },
      attributes: ['id', 'platform', 'deviceName', 'appVersion', 'createdAt'],
    });
    res.json(tokens);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Web Push (VAPID) ────────────────────────────────────────────────────────

// GET /push/vapid-key — return the public VAPID key so the browser can subscribe
router.get('/vapid-key', (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(503).json({ error: 'Web push not configured' });
  res.json({ publicKey: key });
});

// POST /push/web/subscribe — save a PushSubscription from the browser
router.post('/web/subscribe', async (req, res) => {
  const { endpoint, keys, userAgent } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'endpoint, keys.p256dh and keys.auth are required' });
  }

  try {
    const [record, created] = await WebPushSubscription.findOrCreate({
      where: { endpoint },
      defaults: {
        userId:    req.user.sub,
        endpoint,
        p256dh:    keys.p256dh,
        auth:      keys.auth,
        userAgent: userAgent || null,
        isActive:  true,
      },
    });
    if (!created) {
      await record.update({
        userId:    req.user.sub,
        p256dh:    keys.p256dh,
        auth:      keys.auth,
        userAgent: userAgent || null,
        isActive:  true,
      });
    }
    res.status(created ? 201 : 200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /push/web/unsubscribe — remove a web push subscription by endpoint
router.post('/web/unsubscribe', async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'endpoint is required' });

  try {
    const deleted = await WebPushSubscription.destroy({
      where: { endpoint, userId: req.user.sub },
    });
    res.json({ ok: true, removed: deleted > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
