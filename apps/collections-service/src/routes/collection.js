import { Router } from 'express';
import { Op, fn, col } from 'sequelize';
import { requireAuth, requireAdmin } from '../middleware/requireAuth.js';
import { Collection, Wishlist, Card, sequelize } from '../models/index.js';

const router = Router();

// Normalize empty/blank variation to null (matches prod behaviour)
function normalizeVariation(v) {
  return !v || String(v).trim() === '' ? null : String(v).trim();
}

// GET /collection — my collection (no wishlist items)
router.get('/', requireAuth, async (req, res) => {
  try {
    const entries = await Collection.findAll({
      where: { userId: req.user.sub, wishlist: false },
      include: [{ model: Card, as: 'card' }],
      order: [['createdAt', 'DESC']],
    });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /collection/admin/summary — admin: per-user collection summary
router.get('/admin/summary', requireAdmin, async (req, res) => {
  try {
    const { search, limit = 200 } = req.query;
    // Raw query for cross-table group-by (User lives in auth-service's DB, same DB here)
    const rows = await Collection.findAll({
      attributes: [
        'userId',
        [fn('SUM', col('quantity')), 'totalCards'],
        [fn('COUNT', fn('DISTINCT', col('cardId'))), 'distinctCards'],
      ],
      where: { wishlist: false },
      group: ['userId'],
      order: [['userId', 'ASC']],
      limit: Number(limit),
      raw: true,
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /collection/entry?cardId=&variation= — single entry for logged-in user
router.get('/entry', requireAuth, async (req, res) => {
  try {
    const { cardId, variation } = req.query;
    if (!cardId) return res.status(400).json({ error: 'cardId required' });
    const entry = await Collection.findOne({
      where: {
        userId: req.user.sub,
        cardId,
        variation: normalizeVariation(variation),
        wishlist: false,
      },
      include: [{ model: Card, as: 'card' }],
    });
    res.json(entry || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /collection/set-completion?setCode= — card IDs owned by the user for a given set
router.get('/set-completion', requireAuth, async (req, res) => {
  const { setCode } = req.query;
  if (!setCode) return res.status(400).json({ error: 'setCode required' });
  try {
    const entries = await Collection.findAll({
      where: {
        userId: req.user.sub,
        cardId: { [Op.like]: `${setCode.toLowerCase()}-%` },
        wishlist: false,
      },
      attributes: ['cardId'],
    });
    const ownedCardIds = entries.map((e) => e.cardId);
    res.json({ ownedCardIds, total: ownedCardIds.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /collection/:userId — public view of a user's collection
router.get('/:userId', async (req, res) => {
  try {
    const entries = await Collection.findAll({
      where: { userId: req.params.userId, wishlist: false },
      include: [{ model: Card, as: 'card' }],
      order: [['createdAt', 'DESC']],
    });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /collection — add card to collection
router.post('/', requireAuth, async (req, res) => {
  const { cardId, quantity = 1, condition, variation } = req.body;
  if (!cardId) return res.status(400).json({ error: 'cardId required' });

  const t = await sequelize.transaction();
  try {
    let entry = await Collection.findOne({
      where: {
        userId: req.user.sub,
        cardId,
        variation: normalizeVariation(variation),
        wishlist: false,
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (entry) {
      entry.quantity += Number(quantity);
      if (condition !== undefined) entry.condition = condition;
      await entry.save({ transaction: t });
    } else {
      entry = await Collection.create(
        {
          userId: req.user.sub,
          cardId,
          quantity: Number(quantity),
          condition,
          variation: normalizeVariation(variation),
          wishlist: false,
        },
        { transaction: t },
      );
    }

    await t.commit();
    res.status(201).json(entry);
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: err.message });
  }
});

// POST /collection/bulk-add — add multiple cards at once
router.post('/bulk-add', requireAuth, async (req, res) => {
  const { cards } = req.body;
  if (!Array.isArray(cards) || cards.length === 0) {
    return res.status(400).json({ error: 'cards array required' });
  }

  const t = await sequelize.transaction();
  try {
    const results = [];
    for (const { cardId, quantity = 1, condition, variation } of cards) {
      if (!cardId) continue;

      let entry = await Collection.findOne({
        where: {
          userId: req.user.sub,
          cardId,
          variation: normalizeVariation(variation),
          wishlist: false,
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (entry) {
        entry.quantity += Number(quantity);
        if (condition !== undefined) entry.condition = condition;
        await entry.save({ transaction: t });
      } else {
        entry = await Collection.create(
          {
            userId: req.user.sub,
            cardId,
            quantity: Number(quantity),
            condition,
            variation: normalizeVariation(variation),
            wishlist: false,
          },
          { transaction: t },
        );
      }
      results.push(entry);
    }

    await t.commit();
    res.status(201).json({ added: results.length, entries: results });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: err.message });
  }
});

// PATCH /collection — update an existing entry
router.patch('/', requireAuth, async (req, res) => {
  const { cardId, quantity, condition, variation } = req.body;
  if (!cardId) return res.status(400).json({ error: 'cardId required' });

  const t = await sequelize.transaction();
  try {
    const entry = await Collection.findOne({
      where: {
        userId: req.user.sub,
        cardId,
        variation: normalizeVariation(variation),
        wishlist: false,
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!entry) {
      await t.rollback();
      return res.status(404).json({ error: 'Entry not found' });
    }

    if (quantity !== undefined) entry.quantity = Number(quantity);
    if (condition !== undefined) entry.condition = condition;
    await entry.save({ transaction: t });
    await t.commit();

    res.json(entry);
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: err.message });
  }
});

// DELETE /collection — remove entry
router.delete('/', requireAuth, async (req, res) => {
  const { cardId, variation } = req.body;
  if (!cardId) return res.status(400).json({ error: 'cardId required' });

  try {
    const entry = await Collection.findOne({
      where: {
        userId: req.user.sub,
        cardId,
        variation: normalizeVariation(variation),
        wishlist: false,
      },
    });

    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    await entry.destroy();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /collection/move-to-wishlist
router.post('/move-to-wishlist', requireAuth, async (req, res) => {
  const { cardId, variation } = req.body;
  if (!cardId) return res.status(400).json({ error: 'cardId required' });

  const t = await sequelize.transaction();
  try {
    const entry = await Collection.findOne({
      where: {
        userId: req.user.sub,
        cardId,
        variation: normalizeVariation(variation),
        wishlist: false,
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!entry) {
      await t.rollback();
      return res.status(404).json({ error: 'Entry not found' });
    }

    // Create wishlist entry then remove from collection
    await Wishlist.findOrCreate({
      where: {
        userId: req.user.sub,
        cardId,
        variation: normalizeVariation(variation),
      },
      defaults: {
        userId: req.user.sub,
        cardId,
        variation: normalizeVariation(variation),
        quantity: entry.quantity,
        status: 'ACTIVE',
      },
      transaction: t,
    });

    await entry.destroy({ transaction: t });
    await t.commit();
    res.json({ ok: true });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: err.message });
  }
});

// POST /collection/move-from-wishlist
router.post('/move-from-wishlist', requireAuth, async (req, res) => {
  const { cardId, variation } = req.body;
  if (!cardId) return res.status(400).json({ error: 'cardId required' });

  const t = await sequelize.transaction();
  try {
    const wishlistEntry = await Wishlist.findOne({
      where: {
        userId: req.user.sub,
        cardId,
        variation: normalizeVariation(variation),
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!wishlistEntry) {
      await t.rollback();
      return res.status(404).json({ error: 'Entry not found in wishlist' });
    }

    const quantity = wishlistEntry.quantity || 1;
    await wishlistEntry.destroy({ transaction: t });

    let collectionEntry = await Collection.findOne({
      where: {
        userId: req.user.sub,
        cardId,
        variation: normalizeVariation(variation),
        wishlist: false,
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (collectionEntry) {
      collectionEntry.quantity += quantity;
      await collectionEntry.save({ transaction: t });
    } else {
      collectionEntry = await Collection.create(
        {
          userId: req.user.sub,
          cardId,
          variation: normalizeVariation(variation),
          quantity,
          wishlist: false,
        },
        { transaction: t },
      );
    }

    await t.commit();
    res.json(collectionEntry);
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: err.message });
  }
});

export default router;
