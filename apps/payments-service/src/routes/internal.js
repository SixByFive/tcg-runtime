import { Router } from 'express';
import { Op } from 'sequelize';
import { requireInternal } from '../middleware/auth.js';
import { UserSubscription, SubscriptionPlan } from '../models/index.js';

const router = Router();
router.use(requireInternal);

/**
 * GET /internal/subscription/:userId
 *
 * Returns the user's current active subscription tier and fee discount.
 * Called by marketplace-service to apply the correct platform fee.
 *
 * Response: {
 *   active: boolean,
 *   planName: string | null,
 *   feeDiscount: number,   // 0-100, percentage off platform fee
 *   currentPeriodEnd: string | null
 * }
 */
router.get('/subscription/:userId', async (req, res) => {
  try {
    const sub = await UserSubscription.findOne({
      where: {
        userId: req.params.userId,
        status: { [Op.in]: ['active', 'trialing'] },
      },
      include: [{ model: SubscriptionPlan, as: 'plan', attributes: ['name', 'feeDiscount', 'platformFeePercent'] }],
      order: [['createdAt', 'DESC']],
    });

    if (!sub) {
      return res.json({ active: false, planName: null, feeDiscount: 0, currentPeriodEnd: null });
    }

    res.json({
      active:           true,
      planName:         sub.plan?.name ?? null,
      feeDiscount:      sub.plan?.feeDiscount ?? 0,
      currentPeriodEnd: sub.currentPeriodEnd,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /internal/capabilities/:userId
 *
 * Returns the full set of tier limits for the user.
 * null values mean unlimited. Free-tier defaults apply when no active subscription.
 */
router.get('/capabilities/:userId', async (req, res) => {
  try {
    const sub = await UserSubscription.findOne({
      where: {
        userId: req.params.userId,
        status: { [Op.in]: ['active', 'trialing'] },
      },
      include: [{
        model: SubscriptionPlan,
        as: 'plan',
        attributes: [
          'name', 'platformFeePercent', 'feeDiscount',
          'maxBinders', 'maxCollectionCards', 'maxActiveListings', 'maxActiveTrades',
          'featuresJson',
        ],
      }],
      order: [['createdAt', 'DESC']],
    });

    if (!sub?.plan) {
      return res.json({
        planName:           'Free',
        platformFeePercent: 8,
        maxBinders:         3,
        maxCollectionCards: 500,
        maxActiveListings:  5,
        maxActiveTrades:    3,
        features:           [],
      });
    }

    const p = sub.plan;
    res.json({
      planName:           p.name,
      platformFeePercent: Number(p.platformFeePercent),
      maxBinders:         p.maxBinders,
      maxCollectionCards: p.maxCollectionCards,
      maxActiveListings:  p.maxActiveListings,
      maxActiveTrades:    p.maxActiveTrades,
      features:           p.featuresJson ?? [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
