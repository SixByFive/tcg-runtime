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

    if (sub.stripeSubscriptionId) {
      await cancelSubscription(sub.stripeSubscriptionId);
    }
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

    if (sub.stripeSubscriptionId) {
      await resumeSubscription(sub.stripeSubscriptionId);
    }
    await sub.update({ cancelAtPeriodEnd: false });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /payments/subscription/change-plan — user switches their own plan ───

router.post('/change-plan', requireAuth, async (req, res) => {
  const { planId } = req.body;
  if (!planId) return res.status(400).json({ error: 'planId required' });

  try {
    const sub = await UserSubscription.findOne({
      where: { userId: req.user.sub, status: { [Op.in]: ['active', 'trialing'] } },
      include: [{ model: SubscriptionPlan, as: 'plan' }],
    });
    if (!sub) return res.status(404).json({ error: 'No active subscription found' });

    const newPlan = await SubscriptionPlan.findByPk(planId);
    if (!newPlan || !newPlan.active) return res.status(404).json({ error: 'Plan not found' });
    if (sub.planId === planId) return res.status(409).json({ error: 'Already on this plan' });

    if (sub.stripeSubscriptionId && newPlan.stripePriceId) {
      const { getStripe } = await import('../services/stripe.service.js');
      const stripeSub = await getStripe().subscriptions.retrieve(sub.stripeSubscriptionId);
      const itemId = stripeSub.items.data[0]?.id;
      if (itemId) {
        await getStripe().subscriptions.update(sub.stripeSubscriptionId, {
          items: [{ id: itemId, price: newPlan.stripePriceId }],
          proration_behavior: 'always_invoice',
        });
      }
    }

    await sub.update({ planId });
    const updated = await UserSubscription.findByPk(sub.id, {
      include: [{ model: SubscriptionPlan, as: 'plan' }],
    });
    res.json(updated);
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

// ─── GET /plan/:userId — public plan name lookup (no auth) ───────────────────

router.get('/plan/:userId', async (req, res) => {
  try {
    const sub = await UserSubscription.findOne({
      where: {
        userId: req.params.userId,
        status: { [Op.in]: ['active', 'trialing'] },
      },
      include: [{ model: SubscriptionPlan, as: 'plan' }],
      order: [['createdAt', 'DESC']],
    });
    const planName = sub?.plan?.name ?? 'Free';
    res.json({ planName });
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
      include: [{ model: SubscriptionPlan, as: 'plan', attributes: ['id', 'name', 'price', 'interval'] }],
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    res.json({ subscriptions: rows, total: count, page, pageSize });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /payments/subscription/admin/:id/cancel — force-cancel a subscription
router.post('/admin/:id/cancel', requireAdmin, async (req, res) => {
  try {
    const sub = await UserSubscription.findByPk(req.params.id);
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });

    if (sub.stripeSubscriptionId) {
      // Cancel immediately in Stripe (not at period end)
      const { getStripe } = await import('../services/stripe.service.js');
      await getStripe().subscriptions.cancel(sub.stripeSubscriptionId);
    }

    await sub.update({
      status:           'cancelled',
      cancelAtPeriodEnd: false,
      cancelledAt:       new Date(),
    });

    await notifyUser({
      userId: sub.userId,
      type:   NotificationType.WARNING,
      title:  'Subscription cancelled by admin',
      body:   'Your subscription has been cancelled by an administrator.',
    }).catch(() => {});

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /payments/subscription/admin/:id/resume — resume a subscription
router.post('/admin/:id/resume', requireAdmin, async (req, res) => {
  try {
    const sub = await UserSubscription.findByPk(req.params.id);
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });

    if (sub.stripeSubscriptionId) {
      await resumeSubscription(sub.stripeSubscriptionId);
    }

    await sub.update({ cancelAtPeriodEnd: false, status: 'active', cancelledAt: null });

    await notifyUser({
      userId: sub.userId,
      type:   NotificationType.INFO,
      title:  'Subscription reinstated',
      body:   'Your subscription has been reinstated by an administrator.',
    }).catch(() => {});

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /payments/subscription/admin/:id/change-plan — upgrade/downgrade
router.post('/admin/:id/change-plan', requireAdmin, async (req, res) => {
  const { planId } = req.body;
  if (!planId) return res.status(400).json({ error: 'planId required' });

  try {
    const sub  = await UserSubscription.findByPk(req.params.id);
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });

    const newPlan = await SubscriptionPlan.findByPk(planId);
    if (!newPlan) return res.status(404).json({ error: 'Plan not found' });

    if (sub.stripeSubscriptionId && newPlan.stripePriceId) {
      const { getStripe } = await import('../services/stripe.service.js');
      const stripeSub = await getStripe().subscriptions.retrieve(sub.stripeSubscriptionId);
      const itemId = stripeSub.items.data[0]?.id;
      if (itemId) {
        await getStripe().subscriptions.update(sub.stripeSubscriptionId, {
          items: [{ id: itemId, price: newPlan.stripePriceId }],
          proration_behavior: 'always_invoice',
        });
      }
    }

    await sub.update({ planId });

    await notifyUser({
      userId: sub.userId,
      type:   NotificationType.INFO,
      title:  'Your plan has been changed',
      body:   `An administrator has moved your subscription to the ${newPlan.name} plan.`,
    }).catch(() => {});

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /payments/subscription/admin/grant — grant a free/manual subscription
router.post('/admin/grant', requireAdmin, async (req, res) => {
  const { userId, planId, periodDays = 30 } = req.body;
  if (!userId || !planId) return res.status(400).json({ error: 'userId and planId required' });

  try {
    const plan = await SubscriptionPlan.findByPk(planId);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    // Cancel any existing active sub first
    await UserSubscription.update(
      { status: 'cancelled', cancelledAt: new Date() },
      { where: { userId, status: ['active', 'trialing'] } },
    );

    const now = new Date();
    const end = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);

    const granted = await UserSubscription.create({
      userId,
      planId,
      status:              'active',
      currentPeriodStart:  now,
      currentPeriodEnd:    end,
      cancelAtPeriodEnd:   false,
    });

    await notifyUser({
      userId,
      type:   NotificationType.INFO,
      title:  `${plan.name} subscription granted`,
      body:   `An administrator has granted you a ${plan.name} subscription for ${periodDays} days.`,
    }).catch(() => {});

    res.status(201).json(granted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /payments/subscription/admin/:id/revoke — revoke a manually-granted subscription
router.post('/admin/:id/revoke', requireAdmin, async (req, res) => {
  try {
    const sub = await UserSubscription.findByPk(req.params.id);
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });

    await sub.update({ status: 'cancelled', cancelledAt: new Date() });

    await notifyUser({
      userId: sub.userId,
      type:   NotificationType.WARNING,
      title:  'Subscription revoked',
      body:   'Your subscription has been revoked by an administrator.',
    }).catch(() => {});

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
