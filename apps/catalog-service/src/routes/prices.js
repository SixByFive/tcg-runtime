import { Router } from 'express';
import { Op } from 'sequelize';
import { PriceLatest, PriceObservation, PriceRollup } from '../models/index.js';

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

export default router;
