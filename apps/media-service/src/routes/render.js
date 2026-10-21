import { Router } from 'express';
import { createLogger } from '@sbf/logger';
import { renderShareImage, SHARE_KINDS } from '../share/render.js';

const logger = createLogger('media-service:render');
const router = Router();

// ─── Internal auth (DEC-0004) ────────────────────────────────────────────────
// Only the gateway renders share images; it assembles the data, we just draw it.
router.use((req, res, next) => {
  const key = process.env.INTERNAL_API_KEY;
  if (key && req.headers['x-internal-key'] !== key) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// ─── Concurrency cap ─────────────────────────────────────────────────────────
// satori + resvg are CPU/memory heavy and the container is small (see compose
// mem_limit), so queue renders instead of running them all at once.
const MAX_CONCURRENT = Number(process.env.RENDER_CONCURRENCY || 2);
const MAX_QUEUED = 20;
let active = 0;
const waiting = [];

function acquire() {
  if (active < MAX_CONCURRENT) {
    active += 1;
    return Promise.resolve();
  }
  if (waiting.length >= MAX_QUEUED) return Promise.reject(Object.assign(new Error('Renderer busy'), { status: 503 }));
  return new Promise((resolve) => waiting.push(resolve));
}

function release() {
  const next = waiting.shift();
  if (next) next();
  else active -= 1;
}

// POST /render/share  { kind: 'wishlist' | 'listing', data: {...} }  → image/png
router.post('/share', async (req, res) => {
  const { kind, data } = req.body || {};
  if (!SHARE_KINDS.includes(kind)) {
    return res.status(400).json({ error: `kind must be one of: ${SHARE_KINDS.join(', ')}` });
  }
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'data is required' });
  }

  try {
    await acquire();
  } catch (err) {
    return res.status(err.status || 503).json({ error: err.message });
  }

  try {
    const png = await renderShareImage(kind, data);
    res.setHeader('content-type', 'image/png');
    res.setHeader('content-length', png.length);
    res.send(png);
  } catch (err) {
    logger.error(`render ${kind} failed: ${err.message}`);
    res.status(err.status || 500).json({ error: 'Render failed' });
  } finally {
    release();
  }
});

export default router;
