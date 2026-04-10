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
      include: [{ model: SubscriptionPlan, as: 'plan', attributes: ['name', 'feeDiscount'] }],
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

export default router;
