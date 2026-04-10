import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import {
  CardListing, Order, OrderDispute, OwnershipRecord, UserReputation,
} from '../models/index.js';
import {
  capturePaymentIntent, cancelPaymentIntent, refundPaymentIntent,
} from '../services/stripe.service.js';
import { notifyUser, NotificationType } from '@sbf/contracts';

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
      linkUrl: `/listings/${listing.id}`,
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
      linkUrl: `/listings/${listing.id}`,
    }).catch(() => {});

    res.json({ ok: true, newProofCode: newCode });
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

export default router;
