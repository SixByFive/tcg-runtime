import { Router } from 'express';
import { Op } from 'sequelize';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { UserSubscription, SubscriptionPlan } from '../models/index.js';
import {
  getOrCreateCustomer,
  createSubscriptionCheckout,
  createPortalSession,
  cancelSubscription,
  resumeSubscription,
} from '../services/stripe.service.js';
import { notifyUser, NotificationType } from '@sbf/contracts';

const router = Router();

// ─── GET /payments/subscription — my current subscription ────────────────────

router.get('/', requireAuth, async (req, res) => {
  try {
    const sub = await UserSubscription.findOne({
      where: {
        userId: req.user.sub,
        status: { [Op.in]: ['active', 'past_due', 'trialing'] },
      },
      include: [{ model: SubscriptionPlan, as: 'plan' }],
      order: [['createdAt', 'DESC']],
    });
    // No active sub → return free tier indicator
    if (!sub) return res.json({ active: false, plan: null });
    res.json({ active: true, subscription: sub });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /payments/subscription — subscribe to a plan ───────────────────────

router.post('/', requireAuth, async (req, res) => {
  const { planId, email } = req.body;
  if (!planId) return res.status(400).json({ error: 'planId is required' });

  try {
    const plan = await SubscriptionPlan.findByPk(planId);
    if (!plan || !plan.active) return res.status(404).json({ error: 'Plan not found' });
    if (!plan.stripePriceId) return res.status(409).json({ error: 'Plan is not yet configured in Stripe' });

    // Check for existing active subscription
    const existing = await UserSubscription.findOne({
      where: { userId: req.user.sub, status: { [Op.in]: ['active', 'trialing'] } },
    });
    if (existing && existing.planId === planId) {
      return res.status(409).json({ error: 'Already subscribed to this plan' });
    }

    // Get or create Stripe Customer
    const customer = await getOrCreateCustomer(req.user.sub, email || req.user.email);

    const session = await createSubscriptionCheckout({
      customerId:   customer.id,
      stripePriceId: plan.stripePriceId,
      userId:       req.user.sub,
      planId:       plan.id,
    });

    // Create pending subscription record — webhook will activate it
    await UserSubscription.create({
      userId:                  req.user.sub,
      planId:                  plan.id,
      status:                  'pending',
      stripeCustomerId:        customer.id,
      stripeCheckoutSessionId: session.id,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /payments/subscription/cancel ──────────────────────────────────────

router.post('/cancel', requireAuth, async (req, res) => {
  try {
    const sub = await UserSubscription.findOne({
      where: { userId: req.user.sub, status: { [Op.in]: ['active', 'trialing'] } },
    });
    if (!sub) return res.status(404).json({ error: 'No active subscription found' });
    if (sub.cancelAtPeriodEnd) return res.status(409).json({ error: 'Already set to cancel' });

    await cancelSubscription(sub.stripeSubscriptionId);
    await sub.update({ cancelAtPeriodEnd: true });

    res.json({ ok: true, message: 'Subscription will cancel at the end of the current billing period' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /payments/subscription/resume — undo a pending cancellation ─────────

router.post('/resume', requireAuth, async (req, res) => {
  try {
    const sub = await UserSubscription.findOne({
      where: { userId: req.user.sub, status: 'active', cancelAtPeriodEnd: true },
    });
    if (!sub) return res.status(404).json({ error: 'No subscription pending cancellation' });

    await resumeSubscription(sub.stripeSubscriptionId);
    await sub.update({ cancelAtPeriodEnd: false });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /payments/portal — Stripe Customer Portal ───────────────────────────

router.get('/portal', requireAuth, async (req, res) => {
  try {
    const sub = await UserSubscription.findOne({
      where: {
        userId: req.user.sub,
        stripeCustomerId: { [Op.ne]: null },
      },
      order: [['createdAt', 'DESC']],
    });
    if (!sub?.stripeCustomerId) {
      return res.status(404).json({ error: 'No billing account found' });
    }

    const portal = await createPortalSession(sub.stripeCustomerId);
    res.json({ url: portal.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin ────────────────────────────────────────────────────────────────────

router.get('/admin', requireAdmin, async (req, res) => {
  try {
    const page     = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Number(req.query.pageSize) || 50);
    const where    = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.userId) where.userId = req.query.userId;

    const { count, rows } = await UserSubscription.findAndCountAll({
      where,
      include: [{ model: SubscriptionPlan, as: 'plan', attributes: ['name', 'price', 'interval'] }],
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    res.json({ subscriptions: rows, total: count, page, pageSize });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
