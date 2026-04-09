import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/requireAuth.js';
import { Wishlist, Card, sequelize } from '../models/index.js';

const router = Router();

const VALID_STATUSES = new Set(['ACTIVE', 'GRAIL', 'EVENTUAL', 'UPGRADE']);
const DEFAULT_STATUS = 'ACTIVE';
const DEFAULT_PAGE_SIZE = 20;

function normalizeStatus(s) {
  if (typeof s !== 'string') return null;
  const upper = s.trim().toUpperCase();
  return VALID_STATUSES.has(upper) ? upper : null;
}

function safeStatus(s) {
  return normalizeStatus(s) || DEFAULT_STATUS;
}

function cleanEntry(row) {
  const raw = row?.get ? row.get({ plain: true }) : row;
  if (!raw) return raw;
  return { ...raw, status: safeStatus(raw.status) };
}

// GET /wishlist — my wishlist (paginated)
router.get('/', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || DEFAULT_PAGE_SIZE);

    const { count, rows } = await Wishlist.findAndCountAll({
      where: { userId: req.user.sub },
      include: [{ model: Card, as: 'card' }],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order: [['addedAt', 'DESC']],
    });

    res.json({ entries: rows.map(cleanEntry), total: count, page, pageSize });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /wishlist/entry?cardId=&variation= — single entry for logged-in user
router.get('/entry', requireAuth, async (req, res) => {
  try {
    const { cardId, variation } = req.query;
    if (!cardId) return res.status(400).json({ error: 'cardId required' });

    const entry = await Wishlist.findOne({
      where: { userId: req.user.sub, cardId, variation: variation || null },
      include: [{ model: Card, as: 'card' }],
    });

    res.json(entry ? cleanEntry(entry) : null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /wishlist/:userId — public view of a user's wishlist (paginated)
router.get('/:userId', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || DEFAULT_PAGE_SIZE);

    const { count, rows } = await Wishlist.findAndCountAll({
      where: { userId: req.params.userId },
      include: [{ model: Card, as: 'card' }],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order: [['addedAt', 'DESC']],
    });

    res.json({ entries: rows.map(cleanEntry), total: count, page, pageSize });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /wishlist — add to wishlist
router.post('/', requireAuth, async (req, res) => {
  const { cardId, quantity = 1, variation, notes, status } = req.body;
  if (!cardId) return res.status(400).json({ error: 'cardId required' });

  const t = await sequelize.transaction();
  try {
    const normalizedStatus = normalizeStatus(status) || DEFAULT_STATUS;

    let entry = await Wishlist.findOne({
      where: { userId: req.user.sub, cardId, variation: variation || null },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (entry) {
      entry.quantity += Number(quantity);
      if (notes !== undefined) entry.notes = notes;
      if (status !== undefined) entry.status = normalizedStatus;
      await entry.save({ transaction: t });
    } else {
      entry = await Wishlist.create(
        {
          userId: req.user.sub,
          cardId,
          quantity: Number(quantity),
          variation: variation || null,
          notes,
          status: normalizedStatus,
        },
        { transaction: t },
      );
    }

    await t.commit();
    res.status(201).json(cleanEntry(entry));
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: err.message });
  }
});

// PATCH /wishlist — update entry
router.patch('/', requireAuth, async (req, res) => {
  const { cardId, variation, quantity, notes, status } = req.body;
  if (!cardId) return res.status(400).json({ error: 'cardId required' });

  const t = await sequelize.transaction();
  try {
    const entry = await Wishlist.findOne({
      where: { userId: req.user.sub, cardId, variation: variation || null },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!entry) {
      await t.rollback();
      return res.status(404).json({ error: 'Entry not found' });
    }

    if (quantity !== undefined) entry.quantity = Number(quantity);
    if (notes !== undefined) entry.notes = notes;
    if (status !== undefined) {
      const normalized = normalizeStatus(status);
      if (!normalized) {
        await t.rollback();
        return res.status(400).json({ error: 'Invalid status' });
      }
      entry.status = normalized;
    }

    await entry.save({ transaction: t });
    await t.commit();
    res.json(cleanEntry(entry));
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: err.message });
  }
});

// DELETE /wishlist — remove entry
router.delete('/', requireAuth, async (req, res) => {
  const { cardId, variation } = req.body;
  if (!cardId) return res.status(400).json({ error: 'cardId required' });

  try {
    const entry = await Wishlist.findOne({
      where: { userId: req.user.sub, cardId, variation: variation || null },
    });

    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    await entry.destroy();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin routes ──────────────────────────────────────────────────────────────

// POST /wishlist/admin — admin add to any user's wishlist
router.post('/admin', requireAdmin, async (req, res) => {
  const { userId, cardId, quantity = 1, variation, notes, status } = req.body;
  if (!userId || !cardId) return res.status(400).json({ error: 'userId and cardId required' });

  const t = await sequelize.transaction();
  try {
    const normalizedStatus = normalizeStatus(status) || DEFAULT_STATUS;

    let entry = await Wishlist.findOne({
      where: { userId, cardId, variation: variation || null },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (entry) {
      entry.quantity += Number(quantity);
      if (notes !== undefined) entry.notes = notes;
      if (status !== undefined) entry.status = normalizedStatus;
      await entry.save({ transaction: t });
    } else {
      entry = await Wishlist.create(
        { userId, cardId, quantity: Number(quantity), variation: variation || null, notes, status: normalizedStatus },
        { transaction: t },
      );
    }

    await t.commit();
    res.status(201).json(cleanEntry(entry));
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: err.message });
  }
});

// PATCH /wishlist/admin — admin update any user's entry
router.patch('/admin', requireAdmin, async (req, res) => {
  const { userId, cardId, variation, quantity, notes, status } = req.body;
  if (!userId || !cardId) return res.status(400).json({ error: 'userId and cardId required' });

  const t = await sequelize.transaction();
  try {
    const entry = await Wishlist.findOne({
      where: { userId, cardId, variation: variation || null },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!entry) {
      await t.rollback();
      return res.status(404).json({ error: 'Entry not found' });
    }

    if (quantity !== undefined) entry.quantity = Number(quantity);
    if (notes !== undefined) entry.notes = notes;
    if (status !== undefined) {
      const normalized = normalizeStatus(status);
      if (!normalized) {
        await t.rollback();
        return res.status(400).json({ error: 'Invalid status' });
      }
      entry.status = normalized;
    }

    await entry.save({ transaction: t });
    await t.commit();
    res.json(cleanEntry(entry));
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: err.message });
  }
});

// DELETE /wishlist/admin — admin remove a specific entry
router.delete('/admin', requireAdmin, async (req, res) => {
  const { userId, cardId, variation } = req.body;
  if (!userId || !cardId) return res.status(400).json({ error: 'userId and cardId required' });

  try {
    const entry = await Wishlist.findOne({
      where: { userId, cardId, variation: variation || null },
    });
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    await entry.destroy();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /wishlist/admin/clear — admin clear a user's entire wishlist
router.delete('/admin/clear', requireAdmin, async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    await Wishlist.destroy({ where: { userId } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
