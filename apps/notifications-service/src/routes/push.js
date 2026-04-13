import { Router } from 'express';
import { requireAuth } from '@sbf/auth';
import { PushToken } from '../models/index.js';

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

export default router;
