import { Router } from 'express';
import { Op } from 'sequelize';
import { requireAuth, requireAdmin } from '../middleware/requireAuth.js';
import { Binder, BinderPage, BinderSlot, Collection, Card, sequelize } from '../models/index.js';
import { checkCapabilities } from '@sbf/contracts';

const router = Router();

const DEFAULT_PAGE_SIZE = 20;

const FREE_PAGES_PER_BINDER = Number(process.env.BINDER_PAGES_PER_BINDER_FREE ?? 20);

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

async function makeUniqueSlug(base) {
  let slug = slugify(base || 'binder');
  let i = 1;
  while (await Binder.findOne({ where: { slug } })) {
    slug = `${slugify(base || 'binder')}-${i++}`;
  }
  return slug;
}

function fullBinderInclude() {
  return [
    {
      model: BinderPage,
      as: 'pages',
      include: [
        {
          model: BinderSlot,
          as: 'slots',
          include: [{ model: Card, as: 'card' }],
        },
      ],
      order: [['pageOrder', 'ASC']],
    },
  ];
}

// GET /binder — my binders (includes pages + slots for editor hydration)
router.get('/', requireAuth, async (req, res) => {
  try {
    const binders = await Binder.findAll({
      where: { userId: req.user.sub, isDeleted: false },
      include: fullBinderInclude(),
      order: [['createdAt', 'DESC']],
    });
    res.json(binders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /binder/browse — public binder discovery
router.get('/browse', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || DEFAULT_PAGE_SIZE);
    const { userId, search } = req.query;

    const where = { visibility: 'public', isDeleted: false };
    if (userId) where.userId = userId;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    const { rows, count } = await Binder.findAndCountAll({
      where,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order: [['createdAt', 'DESC']],
      include: fullBinderInclude(),
    });

    res.json({ binders: rows, total: count, page, pageSize });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin routes ──────────────────────────────────────────────────────────────
// Must be defined BEFORE /:idOrSlug to prevent "admin" being treated as a slug.

// GET /binder/admin — list all binders (admin)
// ?showDeleted=true to include soft-deleted binders
router.get('/admin', requireAdmin, async (req, res) => {
  try {
    const limit       = Math.min(Number(req.query.limit) || 200, 500);
    const offset      = Number(req.query.offset) || 0;
    const showDeleted = req.query.showDeleted === 'true';
    const where       = showDeleted ? {} : { isDeleted: false };
    const binders = await Binder.findAll({
      where,
      attributes: ['id', 'userId', 'name', 'visibility', 'isDeleted', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
    res.json(binders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /binder/admin/:id
router.patch('/admin/:id', requireAdmin, async (req, res) => {
  try {
    const binder = await Binder.findByPk(req.params.id);
    if (!binder) return res.status(404).json({ error: 'Not found' });

    const { name, description, coverColor, accentColor, visibility } = req.body;
    if (name !== undefined) binder.name = name;
    if (description !== undefined) binder.description = description;
    if (coverColor !== undefined) binder.coverColor = coverColor;
    if (accentColor !== undefined) binder.accentColor = accentColor;
    if (visibility !== undefined) binder.visibility = visibility;

    await binder.save();
    res.json(binder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /binder/admin/:id
router.delete('/admin/:id', requireAdmin, async (req, res) => {
  try {
    const binder = await Binder.findByPk(req.params.id);
    if (!binder) return res.status(404).json({ error: 'Not found' });

    if (req.query.permanent === 'true') {
      await binder.destroy();
    } else {
      binder.isDeleted = true;
      await binder.save();
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Single binder ─────────────────────────────────────────────────────────────

// GET /binder/:idOrSlug — single binder with full pages + slots
router.get('/:idOrSlug', async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    // UUIDs are 36 chars; slugs are shorter and use hyphens
    const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
    const where = isUuid ? { id: idOrSlug } : { slug: idOrSlug };

    const binder = await Binder.findOne({ where, include: fullBinderInclude() });
    if (!binder) return res.status(404).json({ error: 'Not found' });

    // Private binders only visible to their owner
    if (binder.visibility === 'private') {
      const authHeader = req.headers.authorization ?? '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : req.cookies?.sbf_access;
      if (!token) return res.status(403).json({ error: 'Not authorized' });

      const jwt = await import('jsonwebtoken');
      try {
        const payload = jwt.default.verify(token, process.env.ACCESS_TOKEN_SECRET);
        if (payload.sub !== binder.userId) return res.status(403).json({ error: 'Not authorized' });
      } catch {
        return res.status(403).json({ error: 'Not authorized' });
      }
    }

    res.json(binder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /binder — create binder
router.post('/', requireAuth, async (req, res) => {
  try {
    const caps = await checkCapabilities(req.user.sub);
    if (caps.maxBinders !== null) {
      const count = await Binder.count({ where: { userId: req.user.sub, isDeleted: false } });
      if (count >= caps.maxBinders) {
        return res.status(403).json({
          error: 'Binder limit reached',
          limit: caps.maxBinders,
          plan: caps.planName,
        });
      }
    }

    const { name, description, coverColor, accentColor, visibility = 'public' } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });

    const slug = await makeUniqueSlug(name);
    const binder = await Binder.create({
      userId: req.user.sub,
      name,
      description,
      coverColor,
      accentColor,
      visibility,
      slug,
    });

    res.status(201).json(binder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /binder/:id — update binder
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const binder = await Binder.findByPk(req.params.id);
    if (!binder || binder.userId !== req.user.sub) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { name, description, coverColor, accentColor, visibility } = req.body;
    if (name !== undefined) binder.name = name;
    if (description !== undefined) binder.description = description;
    if (coverColor !== undefined) binder.coverColor = coverColor;
    if (accentColor !== undefined) binder.accentColor = accentColor;
    if (visibility !== undefined) binder.visibility = visibility;

    await binder.save();
    res.json(binder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /binder/:id — soft or hard delete
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const binder = await Binder.findByPk(req.params.id);
    if (!binder || binder.userId !== req.user.sub) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (req.query.permanent === 'true') {
      await binder.destroy();
    } else {
      binder.isDeleted = true;
      await binder.save();
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Pages ─────────────────────────────────────────────────────────────────────

// POST /binder/:id/pages — add a page
router.post('/:id/pages', requireAuth, async (req, res) => {
  try {
    const binder = await Binder.findByPk(req.params.id);
    if (!binder || binder.userId !== req.user.sub) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const pageCount = await BinderPage.count({ where: { binderId: binder.id } });
    if (pageCount >= FREE_PAGES_PER_BINDER) {
      return res.status(403).json({ error: 'Page limit reached' });
    }

    const { layout = '3x3', title, pageOrder } = req.body;
    const page = await BinderPage.create({
      binderId: binder.id,
      layout,
      title,
      pageOrder: pageOrder ?? pageCount,
    });

    res.status(201).json(page);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /binder/pages/:pageId — update a page
router.patch('/pages/:pageId', requireAuth, async (req, res) => {
  try {
    const page = await BinderPage.findByPk(req.params.pageId);
    if (!page) return res.status(404).json({ error: 'Not found' });

    const binder = await Binder.findByPk(page.binderId);
    if (!binder || binder.userId !== req.user.sub) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { layout, title, pageOrder } = req.body;
    if (layout !== undefined) page.layout = layout;
    if (title !== undefined) page.title = title;
    if (pageOrder !== undefined) page.pageOrder = pageOrder;

    await page.save();
    res.json(page);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /binder/pages/:pageId — delete a page (and its slots)
router.delete('/pages/:pageId', requireAuth, async (req, res) => {
  try {
    const page = await BinderPage.findByPk(req.params.pageId);
    if (!page) return res.status(404).json({ error: 'Not found' });

    const binder = await Binder.findByPk(page.binderId);
    if (!binder || binder.userId !== req.user.sub) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await BinderSlot.destroy({ where: { pageId: page.id } });
    await page.destroy();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Slots ─────────────────────────────────────────────────────────────────────

// POST /binder/pages/:pageId/slots — add card to binder slot
router.post('/pages/:pageId/slots', requireAuth, async (req, res) => {
  try {
    const page = await BinderPage.findByPk(req.params.pageId);
    if (!page) return res.status(404).json({ error: 'Page not found' });

    const binder = await Binder.findByPk(page.binderId);
    if (!binder || binder.userId !== req.user.sub) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { cardId, position, quantity = 1, notes } = req.body;
    if (!cardId || position === undefined) {
      return res.status(400).json({ error: 'cardId and position required' });
    }

    // Card must be in user's collection
    const inCollection = await Collection.findOne({
      where: { userId: req.user.sub, cardId, wishlist: false },
    });
    if (!inCollection) {
      return res.status(400).json({ error: 'Card not in collection' });
    }

    const slot = await BinderSlot.create({ pageId: page.id, cardId, position, quantity, notes });
    res.status(201).json(slot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /binder/slots/:slotId — update slot
router.patch('/slots/:slotId', requireAuth, async (req, res) => {
  try {
    const slot = await BinderSlot.findByPk(req.params.slotId);
    if (!slot) return res.status(404).json({ error: 'Not found' });

    const page = await BinderPage.findByPk(slot.pageId);
    const binder = await Binder.findByPk(page.binderId);
    if (!binder || binder.userId !== req.user.sub) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { cardId, position, quantity, notes } = req.body;
    if (cardId !== undefined) slot.cardId = cardId;
    if (position !== undefined) slot.position = position;
    if (quantity !== undefined) slot.quantity = quantity;
    if (notes !== undefined) slot.notes = notes;

    await slot.save();
    res.json(slot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /binder/slots/:slotId/move — move slot to different page/position
router.patch('/slots/:slotId/move', requireAuth, async (req, res) => {
  try {
    const slot = await BinderSlot.findByPk(req.params.slotId);
    if (!slot) return res.status(404).json({ error: 'Not found' });

    const page = await BinderPage.findByPk(slot.pageId);
    const binder = await Binder.findByPk(page.binderId);
    if (!binder || binder.userId !== req.user.sub) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { pageId, position } = req.body;
    if (!pageId || position === undefined) {
      return res.status(400).json({ error: 'pageId and position required' });
    }

    const targetPage = await BinderPage.findByPk(pageId);
    if (!targetPage || targetPage.binderId !== binder.id) {
      return res.status(400).json({ error: 'Invalid target page' });
    }

    slot.pageId = pageId;
    slot.position = position;
    await slot.save();
    res.json(slot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /binder/slots/:slotId — remove slot
router.delete('/slots/:slotId', requireAuth, async (req, res) => {
  try {
    const slot = await BinderSlot.findByPk(req.params.slotId);
    if (!slot) return res.status(404).json({ error: 'Not found' });

    const page = await BinderPage.findByPk(slot.pageId);
    const binder = await Binder.findByPk(page.binderId);
    if (!binder || binder.userId !== req.user.sub) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await slot.destroy();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /binder/:id/pages — bulk save all pages + slots (replaces prior state)
router.put('/:id/pages', requireAuth, async (req, res) => {
  try {
    const binder = await Binder.findByPk(req.params.id);
    if (!binder || binder.userId !== req.user.sub) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { pages } = req.body;
    if (!Array.isArray(pages)) return res.status(400).json({ error: 'pages array required' });

    const existingPages = await BinderPage.findAll({ where: { binderId: binder.id } });
    const existingPageMap = Object.fromEntries(existingPages.map((p) => [p.id, p]));
    const keptPageIds = [];

    const t = await sequelize.transaction();
    try {
      for (const [idx, clientPage] of pages.entries()) {
        let page;
        if (clientPage.id && existingPageMap[clientPage.id]) {
          page = existingPageMap[clientPage.id];
          if (clientPage.layout !== undefined) page.layout = clientPage.layout;
          if (clientPage.title !== undefined) page.title = clientPage.title;
          page.pageOrder = idx;
          await page.save({ transaction: t });
        } else {
          page = await BinderPage.create(
            { binderId: binder.id, pageOrder: idx, layout: clientPage.layout, title: clientPage.title },
            { transaction: t },
          );
        }
        keptPageIds.push(page.id);

        // Slots for this page
        const existingSlots = await BinderSlot.findAll({ where: { pageId: page.id }, transaction: t });
        const existingSlotMap = Object.fromEntries(existingSlots.map((s) => [s.id, s]));
        const keptSlotIds = [];

        for (const clientSlot of clientPage.slots || []) {
          let slot;
          if (clientSlot.id && existingSlotMap[clientSlot.id]) {
            slot = existingSlotMap[clientSlot.id];
            slot.position = clientSlot.position;
            slot.cardId = clientSlot.cardId;
            slot.quantity = clientSlot.quantity ?? 1;
            slot.notes = clientSlot.notes;
            await slot.save({ transaction: t });
          } else {
            slot = await BinderSlot.create(
              {
                pageId: page.id,
                cardId: clientSlot.cardId,
                position: clientSlot.position,
                quantity: clientSlot.quantity ?? 1,
                notes: clientSlot.notes,
              },
              { transaction: t },
            );
          }
          keptSlotIds.push(slot.id);
        }

        // Remove omitted slots
        if (keptSlotIds.length > 0) {
          await BinderSlot.destroy({
            where: { pageId: page.id, id: { [Op.notIn]: keptSlotIds } },
            transaction: t,
          });
        } else {
          await BinderSlot.destroy({ where: { pageId: page.id }, transaction: t });
        }
      }

      // Remove omitted pages (and their slots)
      const removedPages = existingPages.filter((p) => !keptPageIds.includes(p.id));
      if (removedPages.length > 0) {
        const removedPageIds = removedPages.map((p) => p.id);
        await BinderSlot.destroy({ where: { pageId: { [Op.in]: removedPageIds } }, transaction: t });
        await BinderPage.destroy({ where: { id: { [Op.in]: removedPageIds } }, transaction: t });
      }

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }

    // Return the fresh binder
    const result = await Binder.findByPk(binder.id, { include: fullBinderInclude() });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
