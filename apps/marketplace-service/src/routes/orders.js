import { Router } from 'express';
import { Op } from 'sequelize';
import { requireAuth } from '../middleware/auth.js';
import { Order, OrderDispute, CardListing, OwnershipRecord, UserReputation, SellerProfile } from '../models/index.js';
import {
  capturePaymentIntent, cancelPaymentIntent, refundPaymentIntent, createEscrowPaymentIntent,
} from '../services/stripe.service.js';
import { notifyUser, NotificationType } from '@sbf/contracts';
import { recalcReputation } from '../services/reputation.service.js';

const SHIPPING_SERVICE_URL = process.env.SHIPPING_SERVICE_URL || 'http://localhost:4023';
const INTERNAL_KEY         = process.env.INTERNAL_API_KEY;

async function bookShippingLabel({ orderId, sellerId, from, to, parcelSize, declaredValue }) {
  const res = await fetch(`${SHIPPING_SERVICE_URL}/internal/shipping/book-for-order`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      ...(INTERNAL_KEY ? { 'x-internal-key': INTERNAL_KEY } : {}),
    },
    body: JSON.stringify({ orderId, sellerId, from, to, parcelSize, declaredValue }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Shipping service error ${res.status}`);
  return data;
}

const FEEDBACK_WINDOW_DAYS = 30;

const router = Router();

// ─── GET / — list my orders ───────────────────────────────────────────────────

router.get('/', requireAuth, async (req, res) => {
  try {
    const page     = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || 50);
    const userId   = req.user.sub;
    const role     = req.query.role; // 'buyer' | 'seller' | omit for both

    const where = {};
    if (role === 'buyer')  where.buyerId  = userId;
    else if (role === 'seller') where.sellerId = userId;
    else where[Op.or] = [{ buyerId: userId }, { sellerId: userId }];

    if (req.query.paymentStatus)    where.paymentStatus    = req.query.paymentStatus;
    if (req.query.fulfilmentStatus) where.fulfilmentStatus = req.query.fulfilmentStatus;

    const { count, rows } = await Order.findAndCountAll({
      where,
      include: [{ model: OrderDispute, as: 'dispute', required: false }],
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    res.json({ orders: rows, total: count, page, pageSize });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /:id — order detail ──────────────────────────────────────────────────

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [
        { model: OrderDispute, as: 'dispute', required: false },
      ],
      attributes: { exclude: ['stripeClientSecret', 'sellerStripeAccountId'] },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.buyerId !== req.user.sub && order.sellerId !== req.user.sub) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /:id/ship — auto-create tracked label and mark shipped ──────────────

router.post('/:id/ship', requireAuth, async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.sellerId !== req.user.sub) return res.status(403).json({ error: 'Not your order' });
    if (!['authorised', 'paid', 'captured'].includes(order.paymentStatus)) {
      return res.status(409).json({ error: 'Order must be paid before shipping' });
    }
    if (!['awaiting_shipment', 'pending_dispatch', 'pending'].includes(order.fulfilmentStatus)) {
      return res.status(409).json({ error: 'Order is already shipped or cannot be shipped in its current state' });
    }

    // ── Resolve buyer address (stored on order at purchase time)
    const buyerAddr = order.buyerAddressJson;
    if (!buyerAddr?.postcode) {
      return res.status(422).json({ error: 'Buyer address is missing or incomplete' });
    }

    // ── Resolve seller return address from profile
    const profile = await SellerProfile.findByPk(req.user.sub);
    if (!profile?.returnPostcode) {
      return res.status(422).json({
        error: 'Your return address is not set. Please add it in your seller settings before shipping.',
      });
    }

    const from = {
      name:     profile.returnName,
      line1:    profile.returnLine1,
      line2:    profile.returnLine2,
      city:     profile.returnCity,
      postcode: profile.returnPostcode,
      country:  profile.returnCountry || 'GB',
      phone:    profile.returnPhone,
      email:    profile.returnEmail,
    };

    // ── Resolve parcel size from listing
    const listing = await CardListing.findByPk(order.listingId, {
      attributes: ['parcelSize', 'price'],
    });
    const parcelSize = listing?.parcelSize ?? 'LARGE_LETTER';

    // ── Book label via shipping-service
    const label = await bookShippingLabel({
      orderId:       order.id,
      sellerId:      req.user.sub,
      from,
      to:            buyerAddr,
      parcelSize,
      declaredValue: Number(order.salePrice) || 10,
    });

    // ── Persist tracking on order
    await order.update({
      fulfilmentStatus: 'shipped',
      trackingNumber:   label.trackingNumber,
      trackingCarrier:  label.carrier,
      shippingLabelUrl: label.labelUrl,
      shippingLabelId:  label.labelId,
      shippedAt:        new Date(),
    });

    // ── Notify buyer
    await notifyUser({
      userId:  order.buyerId,
      type:    NotificationType.INFO,
      title:   'Your order has been shipped!',
      body:    label.trackingNumber
        ? `Tracking number: ${label.trackingNumber}${label.carrier ? ` via ${label.carrier}` : ''}`
        : 'Your order is on its way.',
      linkUrl: `/dashboard?view=orders`,
      meta:    { orderId: order.id, trackingNumber: label.trackingNumber },
    }).catch(() => {});

    res.json({
      ok:             true,
      trackingNumber: label.trackingNumber,
      trackingUrl:    label.trackingUrl,
      labelUrl:       label.labelUrl,
      labelBase64:    label.labelBase64,
      carrier:        label.carrier,
      service:        label.service,
      labelCost:      label.amount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /:id/received — buyer confirms receipt, triggers payment capture ────

router.post('/:id/received', requireAuth, async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.buyerId !== req.user.sub) return res.status(403).json({ error: 'Not your order' });
    if (!['shipped'].includes(order.fulfilmentStatus)) {
      return res.status(409).json({ error: 'Order has not been shipped yet' });
    }

    // Capture Stripe PaymentIntent
    if (order.stripePaymentIntentId) {
      await capturePaymentIntent(order.stripePaymentIntentId);
    }

    await order.update({
      paymentStatus:    'captured',
      fulfilmentStatus: 'completed',
      capturedAt:       new Date(),
      completedAt:      new Date(),
    });

    // If seller has no Stripe Connect account, credit their platform wallet instead.
    // Net = salePrice + sellerShippingCost - platformFee.
    // If the buyer paid for the label (labelQuotePence in metadataJson), that portion
    // stays with the platform to cover P2G PrePay — exclude it from seller credit.
    if (!order.sellerStripeAccountId) {
      const labelQuotePence = order.metadataJson?.labelQuotePence ?? 0;
      const netPence = Math.round(
        (Number(order.salePrice) + Number(order.shippingCost)) * 100
      ) - Math.round(Number(order.platformFee) * 100) - labelQuotePence;
      if (netPence > 0) {
        const paymentsUrl = process.env.PAYMENTS_SERVICE_URL || 'http://localhost:4019';
        const key         = process.env.INTERNAL_API_KEY;
        await fetch(`${paymentsUrl}/internal/wallet/credit`, {
          method:  'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(key ? { 'x-internal-key': key } : {}),
          },
          body: JSON.stringify({
            userId:      order.sellerId,
            amountPence: netPence,
            orderId:     order.id,
            description: `Sale: order ${order.id.slice(0, 8)} — £${(netPence / 100).toFixed(2)}`,
          }),
        }).catch((err) => {
          // Non-fatal: log and continue — order is still complete, credit can be retried
          console.error(`[orders] wallet credit failed for order ${order.id}: ${err.message}`);
        });
      }
    }

    // Write ownership record
    await OwnershipRecord.create({
      cardId:     order.cardId,
      ownerId:    order.buyerId,
      eventType:  'SALE_COMPLETED',
      sourceType: 'ORDER',
      sourceId:   order.id,
    });

    // Increment seller's marketplace reputation
    const [rep] = await UserReputation.findOrCreate({
      where: { userId: order.sellerId },
      defaults: { userId: order.sellerId },
    });
    await rep.increment('completedMarketplace');

    // Notify seller
    await notifyUser({
      userId: order.sellerId,
      type:   NotificationType.INFO,
      title:  'Order complete — payment released',
      body:   'The buyer confirmed receipt. Your payment has been released.',
      linkUrl: `/dashboard?view=orders`,
      meta:   { orderId: order.id },
    }).catch(() => {});

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /:id/dispute — raise a dispute ─────────────────────────────────────

router.post('/:id/dispute', requireAuth, async (req, res) => {
  const { reason, evidenceJson } = req.body;
  if (!reason) return res.status(400).json({ error: 'reason is required' });

  try {
    const order = await Order.findByPk(req.params.id, {
      include: [{ model: OrderDispute, as: 'dispute', required: false }],
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.buyerId !== req.user.sub && order.sellerId !== req.user.sub) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (order.dispute) return res.status(409).json({ error: 'A dispute already exists for this order' });
    if (order.fulfilmentStatus === 'completed') {
      return res.status(409).json({ error: 'Order is already completed' });
    }

    await OrderDispute.create({
      orderId:     order.id,
      raisedById:  req.user.sub,
      reason,
      evidenceJson: evidenceJson || null,
    });

    const otherId = req.user.sub === order.buyerId ? order.sellerId : order.buyerId;
    await notifyUser({
      userId: otherId,
      type:   NotificationType.WARNING,
      title:  'A dispute has been raised',
      body:   `A dispute was raised on order ${order.id.slice(0, 8)}.`,
      linkUrl: `/dashboard?view=orders`,
    }).catch(() => {});

    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /:id/evidence — submit dispute evidence ─────────────────────────────

router.post('/:id/evidence', requireAuth, async (req, res) => {
  const { evidenceJson } = req.body;
  if (!evidenceJson) return res.status(400).json({ error: 'evidenceJson is required' });

  try {
    const order = await Order.findByPk(req.params.id, {
      include: [{ model: OrderDispute, as: 'dispute', required: false }],
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.buyerId !== req.user.sub && order.sellerId !== req.user.sub) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!order.dispute) return res.status(404).json({ error: 'No dispute found for this order' });
    if (!['open', 'reviewing'].includes(order.dispute.status)) {
      return res.status(409).json({ error: 'Dispute is already resolved' });
    }

    const existing = order.dispute.evidenceJson || [];
    await order.dispute.update({
      evidenceJson: [...existing, ...evidenceJson],
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Feedback constants ───────────────────────────────────────────────────────

const ANOMALY_WINDOW_HOURS = 24;
const ANOMALY_THRESHOLD    = 3;   // negatives within window to trigger hold
const MIN_ORDER_VALUE_GBP  = 1;   // orders below this cannot leave feedback

// ─── POST /:id/feedback — buyer leaves feedback for seller ───────────────────

router.post('/:id/feedback', requireAuth, async (req, res) => {
  const { rating, review } = req.body;
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'rating must be 1–5' });
  }

  try {
    const order = await Order.findByPk(req.params.id, {
      include: [{ model: CardListing, required: false }],
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.buyerId !== req.user.sub) return res.status(403).json({ error: 'Only the buyer can leave feedback' });
    if (order.fulfilmentStatus !== 'completed') {
      return res.status(409).json({ error: 'Order must be completed before leaving feedback' });
    }

    // Minimum order value guard
    if (Number(order.salePrice) < MIN_ORDER_VALUE_GBP) {
      return res.status(409).json({ error: `Only orders of £${MIN_ORDER_VALUE_GBP}+ are eligible for feedback` });
    }

    // Enforce 30-day feedback window
    const daysSinceCompletion = (Date.now() - new Date(order.completedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCompletion > FEEDBACK_WINDOW_DAYS) {
      return res.status(409).json({ error: `Feedback can only be left within ${FEEDBACK_WINDOW_DAYS} days of completion` });
    }

    const listing = await CardListing.findByPk(order.listingId);
    if (listing?.rating) return res.status(409).json({ error: 'Feedback already left for this order' });

    // ── Anomaly detection: hold if 3+ negatives arrive within 24 hours ──────
    const isNegative = rating <= 2;
    let reviewStatus = null; // null = approved

    if (isNegative) {
      const windowStart = new Date(Date.now() - ANOMALY_WINDOW_HOURS * 60 * 60 * 1000);
      const recentNegatives = await CardListing.count({
        where: {
          sellerId: order.sellerId,
          rating:   { [Op.lte]: 2 },
          updatedAt: { [Op.gte]: windowStart },
        },
      });

      if (recentNegatives + 1 >= ANOMALY_THRESHOLD) {
        // Auto-hold this review and any un-held recent negatives from this window
        await CardListing.update(
          { reviewStatus: 'pending' },
          {
            where: {
              sellerId:  order.sellerId,
              rating:    { [Op.lte]: 2 },
              updatedAt: { [Op.gte]: windowStart },
              [Op.or]:   [{ reviewStatus: null }, { reviewStatus: 'approved' }],
            },
          },
        );
        reviewStatus = 'pending';
      }
    }

    // Save feedback
    if (listing) await listing.update({ rating, review: review || null, reviewStatus });

    // Recalculate reputation from all approved reviews
    await recalcReputation(order.sellerId);

    res.json({ ok: true, held: reviewStatus === 'pending' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /:id/dispute-review — seller flags a review as suspicious ───────────

router.post('/:id/dispute-review', requireAuth, async (req, res) => {
  const { reason } = req.body;
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.sellerId !== req.user.sub) return res.status(403).json({ error: 'Only the seller can dispute a review' });
    if (order.fulfilmentStatus !== 'completed') {
      return res.status(409).json({ error: 'Order is not completed' });
    }

    const listing = await CardListing.findByPk(order.listingId);
    if (!listing?.rating) return res.status(404).json({ error: 'No review found for this order' });
    if (['disputed', 'voided'].includes(listing.reviewStatus)) {
      return res.status(409).json({ error: 'Review is already disputed or voided' });
    }

    await listing.update({ reviewStatus: 'disputed', disputeReason: reason || null });

    // Recalculate — disputed review no longer counts
    await recalcReputation(order.sellerId);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /:id/cancel ─────────────────────────────────────────────────────────

router.post('/:id/cancel', requireAuth, async (req, res) => {
  const { reason } = req.body;

  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.buyerId !== req.user.sub && order.sellerId !== req.user.sub) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (['completed', 'cancelled'].includes(order.fulfilmentStatus)) {
      return res.status(409).json({ error: 'Order cannot be cancelled' });
    }
    if (order.fulfilmentStatus === 'shipped') {
      return res.status(409).json({ error: 'Order has already shipped — raise a dispute instead' });
    }

    // Cancel Stripe authorisation
    if (order.stripePaymentIntentId && order.paymentStatus === 'authorised') {
      await cancelPaymentIntent(order.stripePaymentIntentId);
    }

    // Refund wallet portion
    if (order.walletAmountPence > 0) {
      const paymentsUrl = process.env.PAYMENTS_SERVICE_URL || 'http://localhost:4019';
      const key = process.env.INTERNAL_API_KEY;
      await fetch(`${paymentsUrl}/internal/wallet/refund-purchase`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(key ? { 'x-internal-key': key } : {}),
        },
        body: JSON.stringify({
          userId:      order.buyerId,
          amountPence: order.walletAmountPence,
          orderId:     order.id,
          description: `Cancelled: order ${order.id.slice(0, 8)}`,
        }),
      }).catch((e) => console.error(`[orders] wallet refund on cancel failed: ${e.message}`));
    }

    await order.update({
      paymentStatus:    'cancelled',
      fulfilmentStatus: 'cancelled',
      cancelledAt:      new Date(),
      cancelledBy:      req.user.sub,
      cancelReason:     reason || null,
    });

    // Restore listing if possible
    const listing = await CardListing.findByPk(order.listingId);
    if (listing && listing.status === 'SOLD') {
      await listing.update({ status: 'ACTIVE', soldAt: null });
    } else if (listing && listing.status === 'ACTIVE') {
      await listing.increment('quantity');
    }

    const otherId = req.user.sub === order.buyerId ? order.sellerId : order.buyerId;
    await notifyUser({
      userId: otherId,
      type:   NotificationType.WARNING,
      title:  'Order cancelled',
      body:   reason || 'An order was cancelled.',
      linkUrl: `/dashboard?view=orders`,
    }).catch(() => {});

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /:id/apply-wallet — buyer applies wallet credit to a pending order ───
//
// Used when a seller accepts an offer and creates an order. The buyer can call
// this before confirming card payment to reduce or eliminate the Stripe PI amount.
// Cancels the existing PI and creates a new one for the residual card amount.

router.post('/:id/apply-wallet', requireAuth, async (req, res) => {
  const walletAmountPence = Math.round(Number(req.body.walletAmountPence) || 0);
  if (!walletAmountPence || walletAmountPence <= 0) {
    return res.status(400).json({ error: 'walletAmountPence must be a positive integer' });
  }

  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.buyerId !== req.user.sub) return res.status(403).json({ error: 'Not your order' });
    if (order.paymentStatus !== 'pending') {
      return res.status(409).json({ error: 'Wallet can only be applied to pending (unpaid) orders' });
    }
    if (order.walletAmountPence > 0) {
      return res.status(409).json({ error: 'Wallet is already applied to this order' });
    }

    const totalPence  = Math.round(Number(order.totalAmount) * 100);
    const walletPence = Math.min(walletAmountPence, totalPence);
    const cardPence   = totalPence - walletPence;

    const paymentsUrl = process.env.PAYMENTS_SERVICE_URL || 'http://localhost:4019';
    const key         = process.env.INTERNAL_API_KEY;

    // Deduct from wallet
    const walletRes = await fetch(`${paymentsUrl}/internal/wallet/spend`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...(key ? { 'x-internal-key': key } : {}) },
      body: JSON.stringify({
        userId:      req.user.sub,
        amountPence: walletPence,
        orderId:     order.id,
        description: `Order ${order.id.slice(0, 8)} — wallet payment £${(walletPence / 100).toFixed(2)}`,
      }),
    });
    if (!walletRes.ok) {
      const errData = await walletRes.json().catch(() => ({}));
      return res.status(walletRes.status).json({ error: errData.error || 'Wallet payment failed' });
    }

    // Cancel the existing Stripe PI (was created for full totalPence)
    if (order.stripePaymentIntentId) {
      await cancelPaymentIntent(order.stripePaymentIntentId).catch(() => {});
    }

    let clientSecret = null;

    if (cardPence > 0 && order.sellerStripeAccountId) {
      try {
        const platformFeePence = Math.round(Number(order.platformFee) * 100);
        const pi = await createEscrowPaymentIntent({
          amountPence:           cardPence,
          currency:              (order.currency || 'GBP').toLowerCase(),
          sellerStripeAccountId: order.sellerStripeAccountId,
          platformFeePence:      Math.round(platformFeePence * (cardPence / totalPence)),
          orderId:               order.id,
        });
        await order.update({
          walletAmountPence:     walletPence,
          stripePaymentIntentId: pi.id,
          stripeClientSecret:    pi.client_secret,
        });
        clientSecret = pi.client_secret;
      } catch (stripeErr) {
        // Refund wallet if PI creation fails
        await fetch(`${paymentsUrl}/internal/wallet/refund-purchase`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', ...(key ? { 'x-internal-key': key } : {}) },
          body: JSON.stringify({ userId: req.user.sub, amountPence: walletPence, orderId: order.id }),
        }).catch(() => {});
        throw stripeErr;
      }
    } else if (cardPence === 0) {
      await order.update({
        walletAmountPence: walletPence,
        paymentStatus:     'authorised',
        fulfilmentStatus:  'awaiting_shipment',
        authorisedAt:      new Date(),
      });
    }

    res.json({ ok: true, clientSecret, walletAmountPence: walletPence, cardTotal: cardPence / 100 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
