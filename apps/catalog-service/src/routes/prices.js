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

/**
 * GET /prices/observations?cardId=X&variant=Y&limit=90
 *
 * Gateway-facing endpoint. Returns observations in the GraphQL schema shape:
 *   { date, market, mid, low, high }
 * Translates from the DB columns: observed_at → date, amount_gbp → market.
 */
router.get('/observations', async (req, res) => {
  try {
    const { cardId, variant, limit = 90 } = req.query;
    if (!cardId) return res.status(400).json({ error: 'cardId is required' });

    const where = { card_id: cardId };
    if (variant) where.variant = variant;

    const rows = await PriceObservation.findAll({
      where,
      order: [['observed_at', 'DESC']],
      limit: Math.min(Number(limit) || 90, 500),
    });

    // Reverse so oldest-first for charting, then map to schema shape
    const observations = rows.reverse().map((r) => ({
      date:   r.observed_at ? r.observed_at.toISOString().slice(0, 10) : null,
      market: r.amount_gbp != null ? Number(r.amount_gbp) : null,
      mid:    r.amount_gbp != null ? Number(r.amount_gbp) : null,
      low:    null,
      high:   null,
    }));

    res.json(observations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Shared helper: fetch rollup rows and transform into the GraphQL PriceRollup shape.
 * DB: one row per (card_id, variant, days) with avg_gbp/min_gbp/max_gbp/last_gbp.
 * Schema: { variant, currency, latest, d7, d30, d90 } grouped per variant.
 */
async function getRollupsForCard(cardId, variant) {
  const where = { card_id: cardId };
  if (variant) where.variant = variant;

  const rows = await PriceRollup.findAll({ where, order: [['days', 'ASC']] });
  if (!rows.length) return [];

  // Group by variant
  const byVariant = new Map();
  for (const r of rows) {
    const v = r.variant ?? 'normal';
    if (!byVariant.has(v)) byVariant.set(v, {});
    byVariant.get(v)[r.days] = r;
  }

  const result = [];
  for (const [v, byDays] of byVariant) {
    // Use the longest available window as the "latest" reference
    const latestRow = byDays[90] ?? byDays[30] ?? byDays[7] ?? Object.values(byDays)[0];
    const computedAt = latestRow?.computed_at;

    const makeStats = (row) => {
      if (!row) return null;
      const avg = row.avg_gbp != null ? Number(row.avg_gbp) : null;
      const last = row.last_gbp != null ? Number(row.last_gbp) : null;
      const min  = row.min_gbp != null ? Number(row.min_gbp)  : null;
      // change = last - avg (rough delta over the period)
      const change    = avg != null && last != null ? Number((last - avg).toFixed(4)) : null;
      const changePct = avg != null && avg !== 0 && change != null
        ? Number(((change / avg) * 100).toFixed(2)) : null;
      return { avg, change, changePct, min, max: row.max_gbp != null ? Number(row.max_gbp) : null };
    };

    result.push({
      variant:  v,
      currency: 'GBP',
      latest: {
        date:   computedAt ? new Date(computedAt).toISOString().slice(0, 10) : null,
        market: latestRow?.last_gbp != null ? Number(latestRow.last_gbp) : null,
        mid:    latestRow?.avg_gbp  != null ? Number(latestRow.avg_gbp)  : null,
      },
      d7:  makeStats(byDays[7]),
      d30: makeStats(byDays[30]),
      d90: makeStats(byDays[90]),
    });
  }

  return result;
}

// GET /prices/rollups/:cardId?variant=normal   (original URL-param form, kept for compat)
router.get('/rollups/:cardId', async (req, res) => {
  try {
    const rollups = await getRollupsForCard(req.params.cardId, req.query.variant);
    res.json(rollups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /prices/rollups?cardId=X&variant=Y   (query-param form used by the gateway client)
router.get('/rollups', async (req, res) => {
  try {
    const { cardId, variant } = req.query;
    if (!cardId) return res.status(400).json({ error: 'cardId is required' });
    const rollups = await getRollupsForCard(cardId, variant);
    res.json(rollups);
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
