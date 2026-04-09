import { Router } from 'express';
import { Op } from 'sequelize';
import { PriceLatest, PriceObservation, PriceRollup, PriceAlert } from '../models/index.js';
import { requireUser } from '../middleware/requireUser.js';

const router = Router();

// GET /prices/latest/:cardId — latest price snapshots for all variants of a card
router.get('/latest/:cardId', async (req, res) => {
  try {
    const rows = await PriceLatest.findAll({
      where: { card_id: req.params.cardId },
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /prices/history/:cardId?variant=normal&from=2024-01-01&to=2024-12-31
router.get('/history/:cardId', async (req, res) => {
  try {
    const { variant, from, to } = req.query;
    const where = { card_id: req.params.cardId };
    if (variant) where.variant = variant;
    if (from || to) {
      where.observed_at = {};
      if (from) where.observed_at[Op.gte] = new Date(from);
      if (to) where.observed_at[Op.lte] = new Date(to);
    }
    const rows = await PriceObservation.findAll({
      where,
      order: [['observed_at', 'ASC']],
      limit: 500,
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /prices/rollups/:cardId?variant=normal
router.get('/rollups/:cardId', async (req, res) => {
  try {
    const where = { card_id: req.params.cardId };
    if (req.query.variant) where.variant = req.query.variant;
    const rows = await PriceRollup.findAll({
      where,
      order: [['days', 'ASC']],
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Price Alerts (authenticated) ────────────────────────────────────────────

// GET /prices/alerts — list my alerts
router.get('/alerts', requireUser, async (req, res) => {
  try {
    const alerts = await PriceAlert.findAll({
      where: { userId: req.user.sub },
      order: [['createdAt', 'DESC']],
    });
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /prices/alerts — upsert an alert (unique per userId+cardId+variant+currency)
router.post('/alerts', requireUser, async (req, res) => {
  const { cardId, variant, targetPrice, currency, enabled } = req.body ?? {};
  if (!cardId || !variant || targetPrice == null) {
    return res.status(400).json({ error: 'cardId, variant and targetPrice are required' });
  }

  try {
    const [alert, created] = await PriceAlert.findOrCreate({
      where: { userId: req.user.sub, cardId, variant, currency: currency ?? 'GBP' },
      defaults: { userId: req.user.sub, cardId, variant, currency: currency ?? 'GBP', targetPrice, enabled: enabled ?? true },
    });
    if (!created) {
      await alert.update({ targetPrice, ...(enabled != null ? { enabled } : {}), triggeredAt: null });
    }
    res.status(created ? 201 : 200).json(alert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /prices/alerts/:id — update an alert
router.patch('/alerts/:id', requireUser, async (req, res) => {
  try {
    const alert = await PriceAlert.findOne({ where: { id: req.params.id, userId: req.user.sub } });
    if (!alert) return res.status(404).json({ error: 'Alert not found' });

    const { targetPrice, enabled } = req.body ?? {};
    const updates = {};
    if (targetPrice != null) updates.targetPrice = targetPrice;
    if (enabled != null) updates.enabled = enabled;

    await alert.update(updates);
    res.json(alert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /prices/alerts/:id — remove an alert
router.delete('/alerts/:id', requireUser, async (req, res) => {
  try {
    const alert = await PriceAlert.findOne({ where: { id: req.params.id, userId: req.user.sub } });
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    await alert.destroy();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
