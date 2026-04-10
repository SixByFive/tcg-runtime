import { Router } from 'express';
import { Op } from 'sequelize';
import { requireAuth } from '../middleware/auth.js';
import { Order, OrderDispute, CardListing, OwnershipRecord, UserReputation } from '../models/index.js';
import { getRates, createLabel } from '../services/shipping.service.js';
import {
  capturePaymentIntent, cancelPaymentIntent, refundPaymentIntent,
} from '../services/stripe.service.js';
import { notifyUser, NotificationType } from '@sbf/contracts';

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

// ─── GET /:id/shipping-rates — seller gets rates before buying label ──────────

router.post('/:id/shipping-rates', requireAuth, async (req, res) => {
  const { sellerAddress, buyerAddress } = req.body;
  if (!sellerAddress || !buyerAddress) {
    return res.status(400).json({ error: 'sellerAddress and buyerAddress are required' });
  }

  try {
    const order = await Order.findByPk(req.params.id, {
      include: [{ model: CardListing, as: null, required: false }],
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.sellerId !== req.user.sub) return res.status(403).json({ error: 'Not your order' });
    if (order.paymentStatus !== 'authorised') {
      return res.status(409).json({ error: 'Order payment not yet authorised' });
    }

    const listing = await CardListing.findByPk(order.listingId);
    const parcelSize = listing?.parcelSize || 'LARGE_LETTER';

    const result = await getRates({ fromAddress: sellerAddress, toAddress: buyerAddress, parcelSize });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /:id/ship — seller creates label and marks shipped ──────────────────

router.post('/:id/ship', requireAuth, async (req, res) => {
  const { shipmentId, rateId, trackingNumber, trackingCarrier } = req.body;

  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.sellerId !== req.user.sub) return res.status(403).json({ error: 'Not your order' });
    if (order.paymentStatus !== 'authorised') {
      return res.status(409).json({ error: 'Order must be authorised before shipping' });
    }
    if (order.fulfilmentStatus !== 'awaiting_shipment') {
      return res.status(409).json({ error: 'Order is already shipped' });
    }

    let labelUrl    = null;
    let tracking    = trackingNumber || null;
    let carrier     = trackingCarrier || null;

    // If using EasyPost label creation
    if (shipmentId && rateId) {
      const label = await createLabel({ shipmentId, rateId });
      labelUrl = label.labelUrl;
      tracking = label.trackingNumber;
      carrier  = label.carrier;
    }

    if (!tracking) return res.status(400).json({ error: 'trackingNumber is required' });

    await order.update({
      fulfilmentStatus: 'shipped',
      trackingNumber:   tracking,
      trackingCarrier:  carrier,
      shippingLabelUrl: labelUrl,
      shippedAt:        new Date(),
    });

    await notifyUser({
      userId: order.buyerId,
      type:   NotificationType.INFO,
      title:  'Your order has been shipped!',
      body:   `Tracking: ${tracking}${carrier ? ` via ${carrier}` : ''}`,
      linkUrl: `/orders/${order.id}`,
      meta:   { orderId: order.id, trackingNumber: tracking },
    }).catch(() => {});

    res.json({ ok: true, trackingNumber: tracking, labelUrl });
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
      linkUrl: `/orders/${order.id}`,
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
      linkUrl: `/orders/${order.id}`,
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

    // Enforce 30-day feedback window
    const daysSinceCompletion = (Date.now() - new Date(order.completedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCompletion > FEEDBACK_WINDOW_DAYS) {
      return res.status(409).json({ error: `Feedback can only be left within ${FEEDBACK_WINDOW_DAYS} days of completion` });
    }

    const listing = await CardListing.findByPk(order.listingId);
    if (listing?.rating) return res.status(409).json({ error: 'Feedback already left for this order' });

    // Map star rating to reputation bucket
    let bucket;
    if (rating >= 4) bucket = 'positive';
    else if (rating === 3) bucket = 'neutral';
    else bucket = 'negative';

    // Update listing with rating
    if (listing) await listing.update({ rating, review: review || null });

    // Update seller reputation
    const [rep] = await UserReputation.findOrCreate({
      where: { userId: order.sellerId },
      defaults: { userId: order.sellerId },
    });
    await rep.increment(bucket);
    await rep.reload();
    await rep.update({ score: rep.positive - rep.negative });

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
      linkUrl: `/orders/${order.id}`,
    }).catch(() => {});

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
