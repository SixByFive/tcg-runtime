import { Router } from 'express';
import { requireAdmin } from '@sbf/auth';
import {
  CardListing, Order, OrderDispute, OwnershipRecord, UserReputation, ProductListing, InventoryItem,
} from '../models/index.js';
import {
  capturePaymentIntent, cancelPaymentIntent, refundPaymentIntent,
} from '../services/stripe.service.js';
import { notifyUser, NotificationType } from '@sbf/contracts';
import { recalcReputation } from '../services/reputation.service.js';

import { Op, fn, col, literal } from 'sequelize';
import { readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';

const router = Router();
router.use(requireAdmin);

async function triggerWishlistMatch(listing) {
  const workerUrl = process.env.WORKER_SERVICE_URL;
  const key       = process.env.INTERNAL_API_KEY;
  if (!workerUrl || !key) return;
  try {
    await fetch(`${workerUrl}/internal/wishlist-match`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-key': key },
      body:    JSON.stringify({
        cardId:    listing.cardId,
        listingId: listing.id,
        title:     listing.title,
        price:     listing.price,
        condition: listing.condition,
      }),
    });
  } catch {
    // non-fatal
  }
}

// ─── Listings ─────────────────────────────────────────────────────────────────

router.get('/listings', async (req, res) => {
  try {
    const page     = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Number(req.query.pageSize) || 50);
    const where    = {};
    if (req.query.status)   where.status   = req.query.status;
    if (req.query.sellerId) where.sellerId = req.query.sellerId;

    const { count, rows } = await CardListing.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    res.json({ listings: rows, total: count, page, pageSize });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/listings/proof-queue — listings awaiting manual moderation
router.get('/listings/proof-queue', async (req, res) => {
  try {
    const rows = await CardListing.findAll({
      where: { status: 'PENDING_PROOF', moderationResult: 'pending_admin' },
      order: [['createdAt', 'ASC']],
      limit: 200,
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/listings/:id/proof-image — serves the proof image regardless of moderation status
router.get('/listings/:id/proof-image', async (req, res) => {
  try {
    const listing = await CardListing.findByPk(req.params.id, {
      attributes: ['id', 'proofImagePath'],
    });
    if (!listing || !listing.proofImagePath) return res.status(404).end();
    const PROOF_DIR = process.env.PROOF_DIR || '/var/uploads/marketplace_proofs';
    const diskPath = join(PROOF_DIR, basename(listing.proofImagePath));
    try {
      const buf = await readFile(diskPath);
      const ext = basename(diskPath).split('.').pop()?.toLowerCase() ?? 'jpg';
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      res.setHeader('content-type', mime);
      res.setHeader('cache-control', 'no-store');
      return res.send(buf);
    } catch {
      return res.status(404).end();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/listings/:id/approve-proof
router.post('/listings/:id/approve-proof', async (req, res) => {
  try {
    const listing = await CardListing.findByPk(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.moderationResult !== 'pending_admin') {
      return res.status(409).json({ error: 'Listing is not pending admin review' });
    }

    await listing.update({
      status: 'ACTIVE',
      moderationResult: 'approved',
      moderatedAt: new Date(),
    });

    await OwnershipRecord.create({
      cardId:     listing.cardId,
      ownerId:    listing.sellerId,
      eventType:  'LISTING_VERIFIED',
      sourceType: 'LISTING',
      sourceId:   listing.id,
      proofCode:  listing.proofCode,
    });

    await notifyUser({
      userId: listing.sellerId,
      type:   NotificationType.INFO,
      title:  'Listing manually verified',
      body:   `Your listing "${listing.title}" was reviewed and approved by a moderator.`,
      linkUrl: `/marketplace/${listing.id}`,
    }).catch(() => {});

    triggerWishlistMatch(listing).catch(() => {});

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/listings/:id/reject-proof
router.post('/listings/:id/reject-proof', async (req, res) => {
  const { reason } = req.body;
  try {
    const listing = await CardListing.findByPk(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    // Reset to PENDING_PROOF with a fresh proof code so seller can resubmit
    const { generateProofCode, proofCodeExpiry } = await import('../services/proof.service.js');
    const newCode  = generateProofCode();
    const newExpiry = proofCodeExpiry();

    await listing.update({
      status:            'PENDING_PROOF',
      moderationResult:  'pending',
      proofCode:         newCode,
      proofCodeExpiresAt: newExpiry,
      proofImagePath:    null,
      proofUploadedAt:   null,
      moderatedAt:       null,
    });

    await notifyUser({
      userId: listing.sellerId,
      type:   NotificationType.WARNING,
      title:  'Proof photo rejected — please resubmit',
      body:   reason || 'Your proof photo was unclear. A new code has been generated — please re-photograph your card.',
      linkUrl: `/marketplace/${listing.id}`,
    }).catch(() => {});

    res.json({ ok: true, newProofCode: newCode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /admin/orders/:id/fulfilment-status — update fulfilment status
router.patch('/orders/:id/fulfilment-status', async (req, res) => {
  const { status } = req.body;
  const VALID = ['pending', 'awaiting_shipment', 'shipped', 'completed', 'disputed', 'cancelled'];
  if (!status || !VALID.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID.join(', ')}` });
  }
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    await order.update({
      fulfilmentStatus: status,
      ...(status === 'completed' ? { completedAt: new Date() } : {}),
      ...(status === 'cancelled' ? { cancelledAt: new Date() } : {}),
    });

    if (status === 'shipped') {
      notifyUser({
        userId:  order.buyerId,
        type:    NotificationType.INFO,
        title:   'Your order has been shipped!',
        body:    "Your order is on its way. You'll receive it soon.",
        linkUrl: `/orders/${order.id}`,
      }).catch(() => {});
    } else if (status === 'completed') {
      notifyUser({
        userId:  order.buyerId,
        type:    NotificationType.INFO,
        title:   'Order complete',
        body:    'Your order has been marked complete. Thank you!',
        linkUrl: `/orders/${order.id}`,
      }).catch(() => {});
    } else if (status === 'cancelled') {
      notifyUser({
        userId:  order.buyerId,
        type:    NotificationType.WARNING,
        title:   'Order cancelled',
        body:    'Your order has been cancelled by an administrator.',
        linkUrl: `/orders/${order.id}`,
      }).catch(() => {});
      notifyUser({
        userId:  order.sellerId,
        type:    NotificationType.WARNING,
        title:   'Order cancelled',
        body:    'Your order has been cancelled by an administrator.',
        linkUrl: `/orders/${order.id}`,
      }).catch(() => {});
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Product Listings ─────────────────────────────────────────────────────────

router.get('/product-listings', async (req, res) => {
  try {
    const page     = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Number(req.query.pageSize) || 50);
    const where    = {};
    if (req.query.status) where.status = req.query.status;

    const { count, rows } = await ProductListing.findAndCountAll({
      where,
      include: [{ model: InventoryItem, as: 'inventory', required: false }],
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    res.json({ listings: rows, total: count, page, pageSize });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/product-listings', async (req, res) => {
  const {
    title, description, imageUrl, imagesJson, colourVariantsJson,
    price, currency = 'GBP', quantity = 1, status = 'ACTIVE',
    fulfilmentType, fulfilmentProvider, fulfilmentExternalId,
  } = req.body;
  if (!title || price == null) {
    return res.status(400).json({ error: 'title and price are required' });
  }
  try {
    const listing = await ProductListing.create({
      sellerId: req.user.sub,
      title, description, imageUrl, imagesJson, colourVariantsJson,
      price, currency, quantity, status,
      fulfilmentType, fulfilmentProvider, fulfilmentExternalId,
    });
    const inventory = await InventoryItem.create({
      productListingId: listing.id,
      onHand: quantity,
      reserved: 0,
      sold: 0,
    });
    res.status(201).json({ ...listing.toJSON(), inventory });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/product-listings/:id', async (req, res) => {
  try {
    const listing = await ProductListing.findByPk(req.params.id, {
      include: [{ model: InventoryItem, as: 'inventory', required: false }],
    });
    if (!listing) return res.status(404).json({ error: 'Product listing not found' });
    const {
      title, description, imageUrl, imagesJson, colourVariantsJson,
      price, currency, quantity, status,
      fulfilmentType, fulfilmentProvider, fulfilmentExternalId,
    } = req.body;
    await listing.update({
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(imagesJson !== undefined && { imagesJson }),
      ...(colourVariantsJson !== undefined && { colourVariantsJson }),
      ...(price !== undefined && { price }),
      ...(currency !== undefined && { currency }),
      ...(quantity !== undefined && { quantity }),
      ...(status !== undefined && { status }),
      ...(fulfilmentType !== undefined && { fulfilmentType }),
      ...(fulfilmentProvider !== undefined && { fulfilmentProvider }),
      ...(fulfilmentExternalId !== undefined && { fulfilmentExternalId }),
    });
    if (quantity !== undefined && listing.inventory) {
      await listing.inventory.update({ onHand: quantity });
    }
    await listing.reload({ include: [{ model: InventoryItem, as: 'inventory', required: false }] });
    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Orders ───────────────────────────────────────────────────────────────────

router.get('/orders', async (req, res) => {
  try {
    const page     = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Number(req.query.pageSize) || 50);
    const where    = {};
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

// ─── Disputes ─────────────────────────────────────────────────────────────────

router.get('/disputes', async (req, res) => {
  try {
    const status = req.query.status || 'open';
    const where  = status === 'all' ? {} : { status };
    const rows   = await OrderDispute.findAll({
      where,
      include: [{ model: Order, required: true }],
      order: [['createdAt', 'ASC']],
      limit: 200,
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/revenue-summary — marketplace-side revenue aggregation
router.get('/revenue-summary', async (req, res) => {
  try {
    const now    = new Date();
    const day7   = new Date(now - 7  * 86400000);
    const day30  = new Date(now - 30 * 86400000);

    // Pull all orders that actually resulted in a payment
    const orders = await Order.findAll({
      where: { paymentStatus: { [Op.in]: ['captured', 'refunded'] } },
      attributes: ['salePrice', 'platformFee', 'shippingCost', 'totalAmount',
                   'walletAmountPence', 'paymentStatus', 'fulfilmentStatus',
                   'capturedAt', 'createdAt'],
    });

    const captured  = orders.filter((o) => o.paymentStatus === 'captured');
    const refunded  = orders.filter((o) => o.paymentStatus === 'refunded');

    const sum = (rows, field) =>
      rows.reduce((acc, r) => acc + Number(r[field] ?? 0), 0);

    const gmv             = sum(captured, 'salePrice');
    const platformFees    = sum(captured, 'platformFee');
    const shippingCollected = sum(captured, 'shippingCost');
    const walletUsed      = captured.reduce((acc, o) => acc + (o.walletAmountPence ?? 0) / 100, 0);
    const refundedTotal   = sum(refunded, 'totalAmount');

    const cap30 = captured.filter((o) => new Date(o.capturedAt || o.createdAt) >= day30);
    const cap7  = captured.filter((o) => new Date(o.capturedAt || o.createdAt) >= day7);

    // Estimated Stripe fees: 1.4% + £0.20 per captured order (EU card rate)
    const stripeFeeEstimate = captured.length * 0.20 + sum(captured, 'totalAmount') * 0.014;

    // Dispute stats
    const disputes = await OrderDispute.findAll({ attributes: ['status'] });
    const openDisputes     = disputes.filter((d) => d.status === 'open').length;
    const resolvedDisputes = disputes.filter((d) => d.status === 'resolved').length;

    // Monthly GMV for last 6 months
    const monthly = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthly[key] = { gmv: 0, fees: 0, orders: 0 };
    }
    for (const o of captured) {
      const d   = new Date(o.capturedAt || o.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthly[key]) {
        monthly[key].gmv    += Number(o.salePrice ?? 0);
        monthly[key].fees   += Number(o.platformFee ?? 0);
        monthly[key].orders += 1;
      }
    }

    res.json({
      // Totals
      gmv, platformFees, shippingCollected, walletUsed, refundedTotal, stripeFeeEstimate,
      // Windowed
      gmv30d:        sum(cap30, 'salePrice'),
      gmv7d:         sum(cap7,  'salePrice'),
      platformFees30d: sum(cap30, 'platformFee'),
      // Counts
      totalOrders:     orders.length,
      completedOrders: captured.filter((o) => o.fulfilmentStatus === 'completed').length,
      openDisputes,
      resolvedDisputes,
      // Monthly breakdown
      monthly: Object.entries(monthly).map(([month, v]) => ({ month, ...v })),
      currency: 'GBP',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/disputes/:id/resolve
router.post('/disputes/:id/resolve', async (req, res) => {
  const { resolution, resolvedInFavourOf } = req.body;
  if (!resolution) return res.status(400).json({ error: 'resolution is required' });
  if (!['buyer', 'seller'].includes(resolvedInFavourOf)) {
    return res.status(400).json({ error: 'resolvedInFavourOf must be "buyer" or "seller"' });
  }

  try {
    const dispute = await OrderDispute.findByPk(req.params.id, {
      include: [{ model: Order, required: true }],
    });
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
    if (['resolved', 'rejected'].includes(dispute.status)) {
      return res.status(409).json({ error: 'Dispute is already closed' });
    }

    const order = dispute.Order;
    let escrowAction = null;

    if (order.stripePaymentIntentId) {
      if (order.paymentStatus === 'authorised') {
        if (resolvedInFavourOf === 'buyer') {
          // Cancel hold — buyer never charged
          await cancelPaymentIntent(order.stripePaymentIntentId);
          await order.update({ paymentStatus: 'cancelled' });
          escrowAction = 'cancelled';
        } else {
          // Capture — seller gets paid
          await capturePaymentIntent(order.stripePaymentIntentId);
          await order.update({ paymentStatus: 'captured', capturedAt: new Date() });
          escrowAction = 'captured';
        }
      } else if (order.paymentStatus === 'captured') {
        if (resolvedInFavourOf === 'buyer') {
          // Full refund
          await refundPaymentIntent(order.stripePaymentIntentId);
          await order.update({ paymentStatus: 'refunded' });
          escrowAction = 'refunded';
        }
        // resolved for seller after capture → no action, funds already released
      }
    }

    await dispute.update({
      status: 'resolved',
      resolution,
      resolvedInFavourOf,
      escrowActionTaken: escrowAction,
      resolvedAt: new Date(),
    });

    await order.update({
      fulfilmentStatus: resolvedInFavourOf === 'seller' ? 'completed' : 'cancelled',
      completedAt: new Date(),
      adminNotes: resolution,
    });

    // Flag losing party if repeated disputes
    const losingPartyId = resolvedInFavourOf === 'buyer' ? order.sellerId : order.buyerId;
    const losingRep = await UserReputation.findByPk(losingPartyId);
    if (losingRep) {
      await losingRep.increment('negative');
      await losingRep.reload();
      await losingRep.update({ score: losingRep.positive - losingRep.negative });
    }

    for (const userId of [order.buyerId, order.sellerId]) {
      await notifyUser({
        userId,
        type:   NotificationType.INFO,
        title:  'Your dispute has been resolved',
        body:   `An admin has resolved your order dispute: ${resolution}`,
        linkUrl: `/orders/${order.id}`,
        meta:   { orderId: order.id },
      }).catch(() => {});
    }

    res.json({ ok: true, escrowActionTaken: escrowAction });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /admin/reviews — review moderation queue ─────────────────────────────
// ?status=pending|disputed  (default: both)

router.get('/reviews', async (req, res) => {
  try {
    const statusFilter = req.query.status;
    const validStatuses = ['pending', 'disputed'];
    const whereStatus = validStatuses.includes(statusFilter)
      ? [statusFilter]
      : validStatuses;

    const limit  = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;

    const reviews = await CardListing.findAll({
      where: {
        rating:       { [Op.ne]: null },
        reviewStatus: { [Op.in]: whereStatus },
      },
      attributes: ['id', 'sellerId', 'cardId', 'rating', 'review', 'reviewStatus', 'disputeReason', 'updatedAt'],
      order: [['updatedAt', 'DESC']],
      limit,
      offset,
    });

    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /admin/reviews/:listingId/resolve — approve or void a review ────────

router.post('/reviews/:listingId/resolve', async (req, res) => {
  const { action } = req.body; // 'approve' | 'void'
  if (!['approve', 'void'].includes(action)) {
    return res.status(400).json({ error: 'action must be approve or void' });
  }

  try {
    const listing = await CardListing.findByPk(req.params.listingId);
    if (!listing)         return res.status(404).json({ error: 'Listing not found' });
    if (!listing.rating)  return res.status(404).json({ error: 'No review on this listing' });
    if (!['pending', 'disputed'].includes(listing.reviewStatus)) {
      return res.status(409).json({ error: 'Review is not pending resolution' });
    }

    const newStatus = action === 'approve' ? 'approved' : 'voided';
    await listing.update({ reviewStatus: newStatus });

    // Recalculate seller reputation
    await recalcReputation(listing.sellerId);

    // Notify seller if review was voided (they win the dispute)
    if (newStatus === 'voided' && listing.reviewStatus === 'disputed') {
      await notifyUser({
        userId: listing.sellerId,
        type:   NotificationType.INFO,
        title:  'Review removed',
        body:   'A disputed review has been removed from your profile after admin review.',
        linkUrl: `/dashboard?view=orders`,
      }).catch(() => {});
    }

    res.json({ ok: true, reviewStatus: newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
