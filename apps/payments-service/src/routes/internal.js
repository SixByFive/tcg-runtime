import { Router } from 'express';
import { Op } from 'sequelize';
import { requireInternal } from '../middleware/auth.js';
import { UserSubscription, SubscriptionPlan } from '../models/index.js';
import {
  holdForTrade,
  releaseHold,
  completeTradeTransfer,
  getWalletSummary,
  creditForSale,
  spendForPurchase,
  refundPurchase,
} from '../services/wallet.service.js';

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
        platformFeePercent: 7,
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

// ─── Wallet (internal — called by trading-service) ────────────────────────────

/**
 * GET /internal/wallet/:userId
 * Returns the user's wallet balance summary (for trading-service pre-flight checks).
 */
router.get('/wallet/:userId', async (req, res) => {
  try {
    const summary = await getWalletSummary(req.params.userId, { limit: 0 });
    res.json({ balancePence: summary.balancePence, heldPence: summary.heldPence, currency: summary.currency });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /internal/wallet/hold
 * Body: { userId, amountPence, tradeId }
 * Deducts from available balance into escrow for a trade.
 */
router.post('/wallet/hold', async (req, res) => {
  const { userId, amountPence, tradeId } = req.body ?? {};
  if (!userId || !amountPence || !tradeId) {
    return res.status(400).json({ error: 'userId, amountPence and tradeId are required' });
  }
  try {
    await holdForTrade(userId, amountPence, tradeId);
    res.json({ ok: true });
  } catch (err) {
    const status = err.message?.includes('Insufficient') ? 402 : 500;
    res.status(status).json({ error: err.message });
  }
});

/**
 * POST /internal/wallet/release
 * Body: { userId, tradeId }
 * Returns held funds to the user (trade cancelled).
 */
router.post('/wallet/release', async (req, res) => {
  const { userId, tradeId } = req.body ?? {};
  if (!userId || !tradeId) {
    return res.status(400).json({ error: 'userId and tradeId are required' });
  }
  try {
    await releaseHold(userId, tradeId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /internal/wallet/credit
 * Body: { userId, amountPence, orderId, description }
 * Credits a seller's wallet when a marketplace sale completes (no Stripe Connect).
 * Called by marketplace-service on buyer receipt confirmation.
 */
router.post('/wallet/credit', async (req, res) => {
  const { userId, amountPence, orderId, description } = req.body ?? {};
  if (!userId || !amountPence) {
    return res.status(400).json({ error: 'userId and amountPence are required' });
  }
  const pence = parseInt(amountPence, 10);
  if (isNaN(pence) || pence <= 0) {
    return res.status(400).json({ error: 'amountPence must be a positive integer' });
  }
  try {
    await creditForSale(userId, pence, { orderId, description });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /internal/wallet/spend
 * Body: { userId, amountPence, orderId, description }
 * Debits a buyer's wallet for a marketplace purchase.
 */
router.post('/wallet/spend', async (req, res) => {
  const { userId, amountPence, orderId, description } = req.body ?? {};
  if (!userId || !amountPence) {
    return res.status(400).json({ error: 'userId and amountPence are required' });
  }
  const pence = parseInt(amountPence, 10);
  if (isNaN(pence) || pence <= 0) {
    return res.status(400).json({ error: 'amountPence must be a positive integer' });
  }
  try {
    await spendForPurchase(userId, pence, { orderId, description });
    res.json({ ok: true });
  } catch (err) {
    const status = err.message?.includes('Insufficient') ? 402 : 500;
    res.status(status).json({ error: err.message });
  }
});

/**
 * POST /internal/wallet/refund-purchase
 * Body: { userId, amountPence, orderId, description }
 * Refunds buyer's wallet when a wallet-paid order is cancelled.
 */
router.post('/wallet/refund-purchase', async (req, res) => {
  const { userId, amountPence, orderId, description } = req.body ?? {};
  if (!userId || !amountPence) {
    return res.status(400).json({ error: 'userId and amountPence are required' });
  }
  const pence = parseInt(amountPence, 10);
  if (isNaN(pence) || pence <= 0) {
    return res.status(400).json({ error: 'amountPence must be a positive integer' });
  }
  try {
    await refundPurchase(userId, pence, { orderId, description });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /internal/wallet/transfer
 * Body: { fromUserId, toUserId, tradeId }
 * Completes a trade: moves held funds from payer to recipient.
 */
router.post('/wallet/transfer', async (req, res) => {
  const { fromUserId, toUserId, tradeId } = req.body ?? {};
  if (!fromUserId || !toUserId || !tradeId) {
    return res.status(400).json({ error: 'fromUserId, toUserId and tradeId are required' });
  }
  try {
    await completeTradeTransfer(fromUserId, toUserId, tradeId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
