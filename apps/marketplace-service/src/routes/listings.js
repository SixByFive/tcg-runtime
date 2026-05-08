import { Router } from 'express';
import { Op } from 'sequelize';
import { requireAuth } from '../middleware/auth.js';
import {
  CardListing, Offer, Order, SellerProfile, OwnershipRecord,
} from '../models/index.js';
import {
  generateProofCode, proofCodeExpiry, saveProofImage, moderateProof,
} from '../services/proof.service.js';
import { getRates } from '../services/shipping.service.js';
import {
  createEscrowPaymentIntent, calculateFee,
} from '../services/stripe.service.js';
import { notifyUser, NotificationType, checkCapabilities } from '@sbf/contracts';

const router = Router();

/**
 * Fire-and-forget — tell worker-service to fan out wishlist notifications.
 * Responds immediately so the caller is never blocked.
 */
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
    // non-fatal — worker being down must not affect listing activation
  }
}

// ─── Public browse ────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const page     = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || 50);
    const where    = { status: 'ACTIVE' };

    if (req.query.cardId)    where.cardId    = req.query.cardId;
    if (req.query.condition) where.condition = req.query.condition;
    if (req.query.sellerId)  where.sellerId  = req.query.sellerId;
    if (req.query.minPrice || req.query.maxPrice) {
      where.price = {};
      if (req.query.minPrice) where.price[Op.gte] = Number(req.query.minPrice);
      if (req.query.maxPrice) where.price[Op.lte] = Number(req.query.maxPrice);
    }

    const { count, rows } = await CardListing.findAndCountAll({
      where,
      attributes: { exclude: ['proofImagePath', 'sellerStripeAccountId'] },
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    res.json({ listings: rows, total: count, page, pageSize });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Create listing ───────────────────────────────────────────────────────────

router.post('/', requireAuth, async (req, res) => {
  const {
    cardId, title, description, condition, variant,
    price, currency, quantity,
    shippingType, shippingPrice, parcelSize,
    allowOffers, offerMinPrice,
  } = req.body;

  if (!cardId || !title || !condition || !price) {
    return res.status(400).json({ error: 'cardId, title, condition, price are required' });
  }

  try {
    // Enforce subscription listing limit
    const caps = await checkCapabilities(req.user.sub);
    if (caps.maxActiveListings !== null) {
      const activeCount = await CardListing.count({
        where: { sellerId: req.user.sub, status: { [Op.in]: ['ACTIVE', 'PENDING_PROOF'] } },
      });
      if (activeCount >= caps.maxActiveListings) {
        return res.status(403).json({
          error: 'Listing limit reached',
          limit: caps.maxActiveListings,
          plan: caps.planName,
        });
      }
    }

    // Check seller has completed Stripe onboarding
    const sellerProfile = await SellerProfile.findByPk(req.user.sub);
    const stripeAccountId = sellerProfile?.stripeOnboardingComplete
      ? sellerProfile.stripeAccountId
      : null;

    const proofCode    = generateProofCode();
    const proofExpiry  = proofCodeExpiry();

    const listing = await CardListing.create({
      sellerId: req.user.sub,
      cardId, title, description, condition, variant,
      price, currency: currency || 'GBP',
      quantity: quantity || 1,
      status: 'PENDING_PROOF',
      proofCode,
      proofCodeExpiresAt: proofExpiry,
      shippingType:  shippingType || 'FIXED',
      shippingPrice: shippingType === 'FIXED' ? (shippingPrice ?? null) : null,
      parcelSize:    parcelSize || 'LARGE_LETTER',
      allowOffers:   allowOffers !== false,
      offerMinPrice: offerMinPrice ?? null,
      sellerStripeAccountId: stripeAccountId,
    });

    res.status(201).json(listing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Get listing ──────────────────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const listing = await CardListing.findByPk(req.params.id, {
      attributes: { exclude: ['proofImagePath', 'sellerStripeAccountId'] },
    });
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    // Only expose non-ACTIVE listings to the seller
    if (listing.status !== 'ACTIVE') {
      // Parse JWT cookie without middleware (optional auth)
      let userId = null;
      try {
        const { default: jwt } = await import('jsonwebtoken');
        const token = req.cookies?.sbf_access;
        if (token) userId = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)?.sub;
      } catch {}
      if (userId !== listing.sellerId) {
        return res.status(404).json({ error: 'Listing not found' });
      }
    }

    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Update listing ───────────────────────────────────────────────────────────

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const listing = await CardListing.findByPk(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.sellerId !== req.user.sub) return res.status(403).json({ error: 'Not your listing' });
    if (['SOLD', 'CANCELLED', 'REMOVED'].includes(listing.status)) {
      return res.status(409).json({ error: 'Listing cannot be edited in its current status' });
    }

    const allowed = [
      'title', 'description', 'price', 'quantity',
      'shippingType', 'shippingPrice', 'parcelSize',
      'allowOffers', 'offerMinPrice', 'condition', 'variant',
    ];
    const updates = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }

    await listing.update(updates);
    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Cancel listing ───────────────────────────────────────────────────────────

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const listing = await CardListing.findByPk(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.sellerId !== req.user.sub) return res.status(403).json({ error: 'Not your listing' });
    if (['SOLD', 'CANCELLED', 'REMOVED'].includes(listing.status)) {
      return res.status(409).json({ error: 'Listing is already closed' });
    }
    await listing.update({ status: 'CANCELLED' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Upload proof image ───────────────────────────────────────────────────────

router.post('/:id/proof', requireAuth, async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'image (base64) is required' });

  try {
    const listing = await CardListing.findByPk(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.sellerId !== req.user.sub) return res.status(403).json({ error: 'Not your listing' });
    if (!['PENDING_PROOF', 'DRAFT'].includes(listing.status)) {
      return res.status(409).json({ error: 'Listing is not awaiting proof' });
    }

    // Regenerate expired proof code
    if (listing.proofCodeExpiresAt && new Date(listing.proofCodeExpiresAt) < new Date()) {
      const newCode   = generateProofCode();
      const newExpiry = proofCodeExpiry();
      await listing.update({ proofCode: newCode, proofCodeExpiresAt: newExpiry });
      return res.status(410).json({
        error: 'Proof code expired — a new code has been generated. Re-photograph with the new code.',
        newProofCode: newCode,
      });
    }

    const imagePath = await saveProofImage(listing.id, req.user.sub, image);
    const result    = await moderateProof(imagePath, listing.proofCode);

    const updates = {
      proofImagePath:   imagePath,
      proofUploadedAt:  new Date(),
      moderationResult: result,
      moderatedAt:      result !== 'pending_admin' ? new Date() : null,
    };

    if (result === 'approved') {
      updates.status = 'ACTIVE';

      // Write LISTING_VERIFIED ownership record
      await OwnershipRecord.create({
        cardId:     listing.cardId,
        ownerId:    listing.sellerId,
        eventType:  'LISTING_VERIFIED',
        sourceType: 'LISTING',
        sourceId:   listing.id,
        proofCode:  listing.proofCode,
      });

      await notifyUser({
        userId: req.user.sub,
        type:   NotificationType.INFO,
        title:  'Listing verified and live',
        body:   `Your listing "${listing.title}" has been verified and is now live.`,
        linkUrl: `/listings/${listing.id}`,
      }).catch(() => {});

      triggerWishlistMatch(listing).catch(() => {});
    }
    // pending_admin → stays PENDING_PROOF, admin reviews

    await listing.update(updates);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Ownership history ────────────────────────────────────────────────────────

router.get('/:id/ownership', async (req, res) => {
  try {
    const listing = await CardListing.findByPk(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const records = await OwnershipRecord.findAll({
      where: { cardId: listing.cardId },
      order: [['createdAt', 'ASC']],
    });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Get shipping rates (dynamic listings) ────────────────────────────────────

router.post('/:id/shipping-rates', requireAuth, async (req, res) => {
  const { buyerAddress } = req.body;
  if (!buyerAddress) return res.status(400).json({ error: 'buyerAddress is required' });

  try {
    const listing = await CardListing.findByPk(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.status !== 'ACTIVE') return res.status(409).json({ error: 'Listing is not active' });
    if (listing.shippingType !== 'DYNAMIC') {
      return res.status(400).json({ error: 'This listing uses fixed shipping' });
    }
    if (!req.body.sellerAddress) {
      return res.status(400).json({ error: 'sellerAddress is required' });
    }

    const result = await getRates({
      fromAddress: req.body.sellerAddress,
      toAddress:   buyerAddress,
      parcelSize:  listing.parcelSize,
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Buy it now ───────────────────────────────────────────────────────────────

router.post('/:id/buy', requireAuth, async (req, res) => {
  const { buyerAddress, shippingRateId, shipmentId } = req.body;

  try {
    const listing = await CardListing.findByPk(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.status !== 'ACTIVE') return res.status(409).json({ error: 'Listing is not available' });
    if (listing.sellerId === req.user.sub) return res.status(403).json({ error: 'Cannot buy your own listing' });

    // For dynamic shipping, a rateId is required at this point
    if (listing.shippingType === 'DYNAMIC' && !shippingRateId) {
      return res.status(400).json({ error: 'shippingRateId required for dynamic-shipping listings' });
    }

    const salePricePence  = Math.round(Number(listing.price) * 100);
    const shippingPence   = listing.shippingType === 'FIXED'
      ? Math.round(Number(listing.shippingPrice ?? 0) * 100)
      : 0; // dynamic shipping cost is resolved when seller buys label
    const totalPence      = salePricePence + shippingPence;
    const platformFeePence = calculateFee(salePricePence);

    // Create order record
    const order = await Order.create({
      listingId:  listing.id,
      buyerId:    req.user.sub,
      sellerId:   listing.sellerId,
      cardId:     listing.cardId,
      salePrice:  listing.price,
      platformFee: platformFeePence / 100,
      shippingCost: shippingPence / 100,
      totalAmount: totalPence / 100,
      currency:   listing.currency || 'GBP',
      buyerAddressJson: buyerAddress || null,
      sellerStripeAccountId: listing.sellerStripeAccountId,
      metadataJson: shippingRateId ? { shipmentId, shippingRateId } : null,
      paymentStatus: 'pending',
    });

    // Mark listing sold (reserve it while payment is pending)
    if (listing.quantity <= 1) {
      await listing.update({ status: 'SOLD', soldAt: new Date() });
    } else {
      await listing.decrement('quantity');
    }

    // Create Stripe escrow PaymentIntent
    let clientSecret = null;
    if (listing.sellerStripeAccountId) {
      const pi = await createEscrowPaymentIntent({
        amountPence:          totalPence,
        currency:             (listing.currency || 'GBP').toLowerCase(),
        sellerStripeAccountId: listing.sellerStripeAccountId,
        orderId:              order.id,
      });
      await order.update({
        stripePaymentIntentId: pi.id,
        stripeClientSecret:    pi.client_secret,
      });
      clientSecret = pi.client_secret;
    }

    // Notify seller
    await notifyUser({
      userId: listing.sellerId,
      type:   NotificationType.LISTING_SOLD,
      title:  'New sale — ship it!',
      body:   `Your listing "${listing.title}" sold. Get it shipped!`,
      linkUrl: `/orders/${order.id}`,
      meta:   { orderId: order.id },
    }).catch(() => {});

    await order.reload();
    res.status(201).json({ ...order.toJSON(), clientSecret });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
