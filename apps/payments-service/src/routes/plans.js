import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { SubscriptionPlan } from '../models/index.js';
import {
  createStripeProduct, createStripePrice, archiveStripePrice,
} from '../services/stripe.service.js';

const router = Router();

// ─── Public ───────────────────────────────────────────────────────────────────

const normalisePlan = (p) => {
  const obj = p.toJSON ? p.toJSON() : { ...p };
  if (typeof obj.featuresJson === 'string') {
    try { obj.featuresJson = JSON.parse(obj.featuresJson); } catch { obj.featuresJson = []; }
  }
  return obj;
};

/** GET /payments/plans — list all active plans, ordered for display */
router.get('/', async (_req, res) => {
  try {
    const plans = await SubscriptionPlan.findAll({
      where: { active: true },
      attributes: { exclude: ['stripeProductId'] },
      order: [['sortOrder', 'ASC']],
    });
    res.json(plans.map(normalisePlan));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin ────────────────────────────────────────────────────────────────────

/** GET /payments/admin/plans — all plans including inactive */
router.get('/admin', requireAdmin, async (_req, res) => {
  try {
    const plans = await SubscriptionPlan.findAll({ order: [['sortOrder', 'ASC']] });
    res.json(plans.map(normalisePlan));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /payments/admin/plans — create a plan.
 * Creates backing Stripe Product + Price automatically.
 *
 * Body: { name, description?, price, interval?, feeDiscount?, featuresJson?, sortOrder? }
 */
router.post('/admin', requireAdmin, async (req, res) => {
  const {
    name, description, price, interval = 'month',
    feeDiscount = 0, platformFeePercent = 8,
    maxBinders = null, maxCollectionCards = null,
    maxActiveListings = null, maxActiveTrades = null,
    featuresJson, sortOrder = 0,
  } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'name and price are required' });

  try {
    // Create Stripe product and price
    const product     = await createStripeProduct(name, description);
    const stripePrice = await createStripePrice({
      productId:  product.id,
      unitAmount: Math.round(Number(price) * 100),
      currency:   'gbp',
      interval,
    });

    const plan = await SubscriptionPlan.create({
      name, description, price, currency: 'GBP', interval,
      stripeProductId: product.id,
      stripePriceId:   stripePrice.id,
      feeDiscount, platformFeePercent,
      maxBinders, maxCollectionCards, maxActiveListings, maxActiveTrades,
      featuresJson: featuresJson || null, sortOrder,
    });

    res.status(201).json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /payments/admin/plans/:id — update display fields.
 * To change price, creates a new Stripe Price and archives the old one.
 */
router.patch('/admin/:id', requireAdmin, async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const {
      name, description, feeDiscount, platformFeePercent,
      maxBinders, maxCollectionCards, maxActiveListings, maxActiveTrades,
      featuresJson, sortOrder, active, price, interval,
    } = req.body;
    const updates = {};

    if (name               !== undefined) updates.name               = name;
    if (description        !== undefined) updates.description        = description;
    if (feeDiscount        !== undefined) updates.feeDiscount        = feeDiscount;
    if (platformFeePercent !== undefined) updates.platformFeePercent = platformFeePercent;
    if (maxBinders         !== undefined) updates.maxBinders         = maxBinders;
    if (maxCollectionCards !== undefined) updates.maxCollectionCards = maxCollectionCards;
    if (maxActiveListings  !== undefined) updates.maxActiveListings  = maxActiveListings;
    if (maxActiveTrades    !== undefined) updates.maxActiveTrades    = maxActiveTrades;
    if (featuresJson       !== undefined) updates.featuresJson       = featuresJson;
    if (sortOrder          !== undefined) updates.sortOrder          = sortOrder;
    if (active             !== undefined) updates.active             = active;

    // Price change → create new Stripe Price, archive old
    if (price !== undefined || interval !== undefined) {
      const newPrice = await createStripePrice({
        productId:  plan.stripeProductId,
        unitAmount: Math.round(Number(price ?? plan.price) * 100),
        currency:   'gbp',
        interval:   interval ?? plan.interval,
      });
      if (plan.stripePriceId) await archiveStripePrice(plan.stripePriceId).catch(() => {});
      updates.stripePriceId = newPrice.id;
      updates.price    = price ?? plan.price;
      updates.interval = interval ?? plan.interval;
    }

    await plan.update(updates);
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
