import { Router } from 'express';
import { Op }    from 'sequelize';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { requireAuth } from '@sbf/auth';
import { getServiceUrl } from '@sbf/config';
import {
  CardListing, CardListingItem, Offer, Order, SellerProfile, OwnershipRecord, MarketplaceAgreement, UserProfile,
  sequelize,
} from '../models/index.js';

const MARKETPLACE_RULES = [
  'Only list cards you physically own. Proof-of-ownership photos are required before a listing goes live.',
  'All listings must accurately describe the card\'s condition and variation. Misrepresentation will result in removal.',
  'No counterfeit, fake, proxy, or altered cards. Violations result in immediate account suspension.',
  'Cards from sets released within the last 14 days may not be listed for sale or trade.',
  'Sellers must dispatch within 3 business days of a confirmed, paid order.',
  'Listings must use the correct parcel size for the item(s) being shipped.',
  'No price manipulation, shill bidding, or coordinated listing activity.',
  'A platform fee is deducted from each completed sale. This is non-negotiable.',
  'Disputes must be raised through the platform. Do not attempt to resolve chargebacks directly.',
  'SixByFive TCG reserves the right to remove any listing or suspend any account at its discretion.',
];
import {
  generateProofCode, proofCodeExpiry, saveProofImage, saveLotImage, moderateProof,
} from '../services/proof.service.js';
import { getRates } from '../services/shipping.service.js';
import { createEscrowPaymentIntent } from '../services/stripe.service.js';
import { calculateFeeForSeller } from '../services/fees.service.js';
import {
  notifyUser, NotificationType, checkCapabilities,
  ListingStatus, OfferStatus, OrderPaymentStatus, OrderFulfilmentStatus,
} from '@sbf/contracts';

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

// ─── Marketplace rules ────────────────────────────────────────────────────────

router.get('/rules', (_req, res) => {
  res.json({ rules: MARKETPLACE_RULES });
});

router.get('/agreed', requireAuth, async (req, res) => {
  try {
    const row = await MarketplaceAgreement.findOne({ where: { userId: req.user.sub } });
    res.json({ agreed: !!row });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/agree', requireAuth, async (req, res) => {
  try {
    await MarketplaceAgreement.findOrCreate({
      where:    { userId: req.user.sub },
      defaults: { userId: req.user.sub, agreedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Public browse ────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const page     = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || 50);
    const where    = { status: ListingStatus.ACTIVE };

    if (req.query.cardId)    where.cardId    = req.query.cardId;
    if (req.query.condition) where.condition = req.query.condition;
    if (req.query.variation) where.variation = req.query.variation;
    if (req.query.sellerId)  where.sellerId  = req.query.sellerId;
    if (req.query.listingKind) {
      // comma-separated list, e.g. ?listingKind=BULK_TRACKED,BULK_RANDOM for the Bulk tab
      const kinds = String(req.query.listingKind).split(',').map((s) => s.trim()).filter(Boolean);
      if (kinds.length) where.listingKind = { [Op.in]: kinds };
    } else {
      // Default browse view hides bulk lots so they don't pollute per-card search
      where.listingKind = 'SINGLE';
    }
    if (req.query.minPrice || req.query.maxPrice) {
      where.price = {};
      if (req.query.minPrice) where.price[Op.gte] = Number(req.query.minPrice);
      if (req.query.maxPrice) where.price[Op.lte] = Number(req.query.maxPrice);
    }

    const sortMap = { PRICE_ASC: ['price', 'ASC'], PRICE_DESC: ['price', 'DESC'] };
    const orderBy = sortMap[req.query.sort] || ['createdAt', 'DESC'];

    const { count, rows } = await CardListing.findAndCountAll({
      where,
      attributes: { exclude: ['proofImagePath', 'sellerStripeAccountId'] },
      order: [orderBy],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    // Batch-fetch pending offer counts for all returned listings
    const listingIds = rows.map((r) => r.id);
    const offerCounts = listingIds.length
      ? await Offer.findAll({
          where: { listingId: { [Op.in]: listingIds }, status: { [Op.in]: [OfferStatus.PENDING, OfferStatus.COUNTERED] } },
          attributes: ['listingId', [Offer.sequelize.fn('COUNT', Offer.sequelize.col('id')), 'cnt']],
          group: ['listingId'],
          raw: true,
        })
      : [];
    const countMap = Object.fromEntries(offerCounts.map((r) => [r.listingId, Number(r.cnt)]));
    const listings = rows.map((r) => ({ ...r.toJSON(), pendingOfferCount: countMap[r.id] ?? 0 }));

    res.json({ listings, total: count, page, pageSize });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Create listing ───────────────────────────────────────────────────────────

router.post('/', requireAuth, async (req, res) => {
  const {
    listingKind = 'SINGLE',
    // SINGLE
    cardId, condition, variant,
    // bulk (both kinds)
    conditionMin, conditionMax, cardCount,
    guaranteedInclusions,          // [{ description, quantity }]
    lotPhotoPath,                  // path returned by a prior lot-photo upload (optional)
    lotPhotoBase64,                // OR a data URL to be saved server-side (BULK_RANDOM)
    // BULK_TRACKED
    items,                         // [{ cardId, variant, condition, quantity }]
    // shared
    title, description,
    price, currency, quantity,
    shippingType, shippingPrice, parcelSize, labelPaidBy,
    allowOffers, offerMinPrice, willTrade,
  } = req.body;

  // Shared required: title and (price or willTrade)
  if (!title || (!price && !willTrade)) {
    return res.status(400).json({ error: 'title and price (unless trade-only) are required' });
  }

  // Kind-specific validation
  if (listingKind === 'SINGLE') {
    if (!cardId || !condition) {
      return res.status(400).json({ error: 'SINGLE listings require cardId and condition' });
    }
  } else if (listingKind === 'BULK_TRACKED') {
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'BULK_TRACKED requires items[]' });
    }
    if (!conditionMin || !conditionMax) {
      return res.status(400).json({ error: 'BULK_TRACKED requires conditionMin and conditionMax' });
    }
  } else if (listingKind === 'BULK_RANDOM') {
    if (!cardCount || Number(cardCount) < 50) {
      return res.status(400).json({ error: 'BULK_RANDOM requires cardCount >= 50' });
    }
    if (!lotPhotoPath && !lotPhotoBase64) {
      return res.status(400).json({ error: 'BULK_RANDOM requires a lot photo' });
    }
    if (!conditionMin || !conditionMax) {
      return res.status(400).json({ error: 'BULK_RANDOM requires conditionMin and conditionMax' });
    }
  } else {
    return res.status(400).json({ error: 'invalid listingKind' });
  }

  try {
    // ── Marketplace rules agreement required ─────────────────────────────────
    const agreed = await MarketplaceAgreement.findOne({ where: { userId: req.user.sub } });
    if (!agreed) {
      return res.status(403).json({ error: 'MARKETPLACE_AGREEMENT_REQUIRED' });
    }

    // ── New-set embargo: block listings for 14 days after a set's release ────
    // Only enforced for SINGLE (has cardId). BULK_TRACKED should be checked per-item
    // in a follow-up (fan out across items[]); BULK_RANDOM has no cardId to check.
    if (listingKind === 'SINGLE') {
      const EMBARGO_DAYS = Number(process.env.NEW_SET_EMBARGO_DAYS ?? 14);
      const catalogUrl   = getServiceUrl('CATALOG_SERVICE_URL', 4012);
      try {
        const catalogRes = await fetch(`${catalogUrl}/cards/${encodeURIComponent(cardId)}`);
        if (catalogRes.ok) {
          const cardData = await catalogRes.json();
          const releaseDate = cardData?.Set?.release_date ?? cardData?.set?.release_date ?? null;
          if (releaseDate) {
            const released  = new Date(releaseDate);
            const embargoEnd = new Date(released.getTime() + EMBARGO_DAYS * 24 * 60 * 60 * 1000);
            if (new Date() < embargoEnd) {
              const unlocksAt = embargoEnd.toISOString().slice(0, 10);
              return res.status(403).json({
                error: `This set was released less than ${EMBARGO_DAYS} days ago. Listings open on ${unlocksAt}.`,
                embargoEndsAt: unlocksAt,
              });
            }
          }
        }
      } catch {
        // Non-fatal — if catalog is unreachable, allow the listing through
      }
    }

    // Enforce subscription listing limit
    const caps = await checkCapabilities(req.user.sub);
    if (caps.maxActiveListings !== null) {
      const activeCount = await CardListing.count({
        where: { sellerId: req.user.sub, status: { [Op.in]: [ListingStatus.ACTIVE, ListingStatus.PENDING_PROOF] } },
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

    // Proof codes apply to single-card and tracked-bulk listings. Random-bulk
    // uses the uploaded lot photo as its own proof and goes ACTIVE immediately.
    const needsProof   = listingKind !== 'BULK_RANDOM';
    const proofCode    = needsProof ? generateProofCode() : null;
    const proofExpiry  = needsProof ? proofCodeExpiry()   : null;

    // For random-bulk, decode the base64 lot photo now (if provided) so the
    // resolved path can be persisted with the listing row.
    let resolvedLotPhotoPath = null;
    if (listingKind === 'BULK_RANDOM') {
      resolvedLotPhotoPath = lotPhotoBase64
        ? await saveLotImage(req.user.sub, lotPhotoBase64)
        : lotPhotoPath;
    }

    const listing = await sequelize.transaction(async (tx) => {
      const row = await CardListing.create({
        sellerId: req.user.sub,
        listingKind,
        cardId:    listingKind === 'SINGLE' ? cardId : null,
        condition: listingKind === 'SINGLE' ? condition : null,
        conditionMin: listingKind === 'SINGLE' ? null : conditionMin,
        conditionMax: listingKind === 'SINGLE' ? null : conditionMax,
        cardCount:    listingKind === 'SINGLE' ? null : (cardCount ?? null),
        guaranteedInclusionsJson: guaranteedInclusions ?? null,
        lotPhotoPath: resolvedLotPhotoPath,
        isReturnable: listingKind !== 'BULK_RANDOM',
        title, description, variant,
        price, currency: currency || 'GBP',
        quantity: quantity || 1,
        status: needsProof ? ListingStatus.PENDING_PROOF : ListingStatus.ACTIVE,
        proofCode,
        proofCodeExpiresAt: proofExpiry,
        shippingType:  shippingType || 'FIXED',
        shippingPrice: shippingType === 'FIXED' ? (shippingPrice ?? null) : null,
        parcelSize:    parcelSize || 'LARGE_LETTER',
        labelPaidBy:   labelPaidBy === 'buyer' ? 'buyer' : 'seller',
        allowOffers:   allowOffers !== false,
        offerMinPrice: offerMinPrice ?? null,
        willTrade:     willTrade === true,
        sellerStripeAccountId: stripeAccountId,
      }, { transaction: tx });

      if (listingKind === 'BULK_TRACKED') {
        await CardListingItem.bulkCreate(
          items.map((i) => ({
            listingId: row.id,
            cardId:    i.cardId,
            variant:   i.variant ?? null,
            condition: i.condition ?? null,
            quantity:  i.quantity ?? 1,
          })),
          { transaction: tx },
        );
        // Reload with items so the response includes the snapshot clients
        // just submitted — otherwise UIs would show an empty lot briefly.
        return CardListing.findByPk(row.id, {
          include: [{ model: CardListingItem, as: 'items' }],
          transaction: tx,
        });
      }
      return row;
    });

    res.status(201).json(listing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── My listings (seller) ─────────────────────────────────────────────────────

router.get('/mine', requireAuth, async (req, res) => {
  try {
    const sellerId = req.user.sub;
    const page     = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || 50);
    const where    = { sellerId };
    if (req.query.status) where.status = req.query.status;

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

// ─── Listing-scoped offer routes (gateway calls /marketplace/listings/:id/offers) ─

router.get('/:id/offers', requireAuth, async (req, res) => {
  try {
    const listing = await CardListing.findByPk(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.sellerId !== req.user.sub) return res.status(403).json({ error: 'Not your listing' });
    const offers = await Offer.findAll({
      where: { listingId: req.params.id },
      order: [['createdAt', 'DESC']],
    });
    res.json(offers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/offers', requireAuth, async (req, res) => {
  const { amount, message } = req.body;
  if (!amount || isNaN(amount)) return res.status(400).json({ error: 'amount is required' });
  try {
    const listing = await CardListing.findByPk(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.status !== ListingStatus.ACTIVE) return res.status(409).json({ error: 'Listing is not active' });
    if (listing.sellerId === req.user.sub) return res.status(403).json({ error: 'Cannot offer on your own listing' });
    if (!listing.allowOffers) return res.status(409).json({ error: 'This listing does not accept offers' });
    if (listing.offerMinPrice && Number(amount) < Number(listing.offerMinPrice)) {
      return res.status(400).json({ error: `Minimum offer is £${listing.offerMinPrice}` });
    }
    await Offer.update(
      { status: OfferStatus.EXPIRED },
      { where: { listingId: listing.id, buyerId: req.user.sub, status: OfferStatus.PENDING } },
    );

    // Snapshot the buyer's saved shipping address at offer time
    const buyerProfile = await UserProfile.findOne({ where: { userId: req.user.sub } });
    const buyerAddressJson = buyerProfile?.address1 ? {
      line1:    buyerProfile.address1,
      line2:    buyerProfile.address2 || undefined,
      city:     buyerProfile.city,
      postcode: buyerProfile.postcode,
      state:    buyerProfile.state || undefined,
      country:  buyerProfile.country || 'GB',
    } : null;

    const offer = await Offer.create({
      listingId: listing.id,
      buyerId:   req.user.sub,
      amount,
      message:   message || null,
      status:    OfferStatus.PENDING,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      buyerAddressJson,
    });
    await notifyUser({
      userId: listing.sellerId,
      type:   NotificationType.INFO,
      title:  'New offer on your listing',
      body:   `Someone offered £${Number(amount).toFixed(2)} on "${listing.title}"`,
      linkUrl: `/marketplace/${listing.id}/offers`,
      meta:   { offerId: offer.id, listingId: listing.id },
    }).catch(() => {});
    res.status(201).json(offer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Proof image (public, approved listings only) ─────────────────────────────

router.get('/:id/proof-image', async (req, res) => {
  try {
    const listing = await CardListing.findByPk(req.params.id, {
      attributes: ['id', 'status', 'moderationResult', 'proofImagePath'],
    });
    if (!listing || listing.status !== ListingStatus.ACTIVE || listing.moderationResult !== 'approved' || !listing.proofImagePath) {
      return res.status(404).end();
    }
    const PROOF_DIR = process.env.PROOF_DIR || '/var/uploads/marketplace_proofs';
    const diskPath = join(PROOF_DIR, basename(listing.proofImagePath));
    try {
      const buf = await readFile(diskPath);
      const ext = basename(diskPath).split('.').pop()?.toLowerCase() ?? 'jpg';
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      res.setHeader('content-type', mime);
      res.setHeader('cache-control', 'public, max-age=3600');
      return res.send(buf);
    } catch {
      return res.status(404).end();
    }
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
    if (listing.status !== ListingStatus.ACTIVE) {
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

    // Count active offers for the "Under Offer" indicator
    const pendingOfferCount = await Offer.count({
      where: { listingId: listing.id, status: { [Op.in]: [OfferStatus.PENDING, OfferStatus.COUNTERED] } },
    });

    res.json({ ...listing.toJSON(), pendingOfferCount });
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
    if ([ListingStatus.SOLD, ListingStatus.CANCELLED, ListingStatus.REMOVED].includes(listing.status)) {
      return res.status(409).json({ error: 'Listing cannot be edited in its current status' });
    }

    const allowed = [
      'title', 'description', 'price', 'quantity',
      'shippingType', 'shippingPrice', 'parcelSize', 'labelPaidBy',
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
    if ([ListingStatus.SOLD, ListingStatus.CANCELLED, ListingStatus.REMOVED].includes(listing.status)) {
      return res.status(409).json({ error: 'Listing is already closed' });
    }
    await listing.update({ status: ListingStatus.CANCELLED });
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
    if (![ListingStatus.PENDING_PROOF, ListingStatus.DRAFT].includes(listing.status)) {
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

    // Fetch canonical card name + set name from catalog for OCR verification
    let expectedCardName, expectedSetName;
    try {
      const catalogUrl = getServiceUrl('CATALOG_SERVICE_URL', 4012);
      const cardRes    = await fetch(`${catalogUrl}/cards/${encodeURIComponent(listing.cardId)}`);
      if (cardRes.ok) {
        const cardData   = await cardRes.json();
        expectedCardName = cardData?.name ?? cardData?.card_name ?? undefined;
        expectedSetName  = cardData?.Set?.name ?? cardData?.set?.name ?? cardData?.setName ?? undefined;
      }
    } catch {
      // Non-fatal — if catalog is unreachable, OCR will skip card/set checks
    }

    const imagePath = await saveProofImage(listing.id, req.user.sub, image);

    // Record upload immediately and respond — OCR runs in background
    await listing.update({
      proofImagePath:  imagePath,
      proofUploadedAt: new Date(),
      moderationResult: 'pending',
    });

    res.json({ ok: true, result: 'processing' });

    // ── Background OCR ────────────────────────────────────────────────────────
    setImmediate(async () => {
      try {
        const result = await moderateProof(imagePath, listing.proofCode, expectedCardName, expectedSetName);

        const updates = {
          moderationResult: result,
          moderatedAt:      new Date(),
        };

        if (result === 'approved') {
          updates.status = ListingStatus.ACTIVE;

          // Bulk-lot proofs don't have a single cardId to attribute ownership to.
          if (listing.cardId) {
            await OwnershipRecord.create({
              cardId:     listing.cardId,
              ownerId:    listing.sellerId,
              eventType:  'LISTING_VERIFIED',
              sourceType: 'LISTING',
              sourceId:   listing.id,
              proofCode:  listing.proofCode,
            });
          }

          await notifyUser({
            userId: listing.sellerId,
            type:   NotificationType.INFO,
            title:  'Listing verified and live',
            body:   `Your listing "${listing.title}" has been verified and is now live.`,
            linkUrl: `/marketplace?listing=${listing.id}`,
          }).catch(() => {});

          triggerWishlistMatch(listing).catch(() => {});
        }

        if (result === 'pending_admin') {
          await notifyUser({
            userId:  listing.sellerId,
            type:    NotificationType.INFO,
            title:   'Proof submitted — under review',
            body:    `Your proof photo for "${listing.title}" is being reviewed by a moderator. We'll let you know once it's approved.`,
            linkUrl: `/marketplace`,
          }).catch(() => {});
        }

        await listing.update(updates);
      } catch (err) {
        logger.error({ msg: 'proof_ocr_background_error', listingId: listing.id, error: err.message });
      }
    });
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
    if (listing.status !== ListingStatus.ACTIVE) return res.status(409).json({ error: 'Listing is not active' });
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
  const { buyerAddress, shippingRateId, shipmentId, walletAmountPence = 0 } = req.body;

  try {
    const agreed = await MarketplaceAgreement.findOne({ where: { userId: req.user.sub } });
    if (!agreed) {
      return res.status(403).json({ error: 'MARKETPLACE_AGREEMENT_REQUIRED' });
    }

    const listing = await CardListing.findByPk(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.status !== ListingStatus.ACTIVE) return res.status(409).json({ error: 'Listing is not available' });
    if (listing.sellerId === req.user.sub) return res.status(403).json({ error: 'Cannot buy your own listing' });

    // For dynamic shipping, a rateId is required at this point
    if (listing.shippingType === 'DYNAMIC' && !shippingRateId) {
      return res.status(400).json({ error: 'shippingRateId required for dynamic-shipping listings' });
    }

    const salePricePence  = Math.round(Number(listing.price) * 100);
    const baseShippingPence = listing.shippingType === 'FIXED'
      ? Math.round(Number(listing.shippingPrice ?? 0) * 100)
      : 0;

    // When the buyer pays for the label, fetch a P2G quote and add it to the order total
    let labelQuotePence = 0;
    if (listing.labelPaidBy === 'buyer' && buyerAddress?.postcode) {
      const sellerProfile = await SellerProfile.findByPk(listing.sellerId, {
        attributes: ['returnPostcode'],
      });
      if (sellerProfile?.returnPostcode) {
        const shippingUrl = getServiceUrl('SHIPPING_SERVICE_URL', 4023);
        const internalKey = process.env.INTERNAL_API_KEY;
        try {
          const qRes = await fetch(`${shippingUrl}/internal/shipping/quote`, {
            method:  'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(internalKey ? { 'x-internal-key': internalKey } : {}),
            },
            body: JSON.stringify({
              to:           { postcode: buyerAddress.postcode },
              from:         { postcode: sellerProfile.returnPostcode },
              parcelSize:   listing.parcelSize || 'LARGE_LETTER',
              declaredValue: Number(listing.price) || 10,
            }),
          });
          if (qRes.ok) {
            const q = await qRes.json();
            labelQuotePence = Math.round((q.amount || 0) * 100);
          }
        } catch {
          // Non-fatal — proceed without label cost in total
        }
      }
    }

    const shippingPence    = baseShippingPence + labelQuotePence;
    const totalPence       = salePricePence + shippingPence;
    const platformFeePence = await calculateFeeForSeller(salePricePence, listing.sellerId);

    // Clamp wallet contribution to total
    const walletPence = Math.min(Math.max(0, Math.round(Number(walletAmountPence) || 0)), totalPence);
    const cardPence   = totalPence - walletPence;

    // Snapshot bulk-tracked contents at sale time
    let itemsJson = null;
    if (listing.listingKind === 'BULK_TRACKED') {
      const items = await CardListingItem.findAll({ where: { listingId: listing.id } });
      itemsJson = items.map((i) => ({
        cardId:    i.cardId,
        variant:   i.variant,
        condition: i.condition,
        quantity:  i.quantity,
      }));
    }

    // Create order record
    const order = await Order.create({
      listingId:  listing.id,
      buyerId:    req.user.sub,
      sellerId:   listing.sellerId,
      cardId:     listing.listingKind === 'SINGLE' ? listing.cardId : null,
      itemsJson,
      salePrice:  listing.price,
      platformFee: platformFeePence / 100,
      shippingCost: shippingPence / 100,
      totalAmount: totalPence / 100,
      currency:   listing.currency || 'GBP',
      buyerAddressJson: buyerAddress || null,
      sellerStripeAccountId: listing.sellerStripeAccountId,
      metadataJson: {
        ...(shippingRateId ? { shipmentId, shippingRateId } : {}),
        ...(labelQuotePence > 0 ? { labelQuotePence } : {}),
      } || null,
      walletAmountPence: walletPence,
      paymentStatus: OrderPaymentStatus.PENDING,
    });

    // Mark listing sold (reserve it while payment is pending)
    if (listing.quantity <= 1) {
      await listing.update({ status: ListingStatus.SOLD, soldAt: new Date() });
    } else {
      await listing.decrement('quantity');
    }

    // Deduct wallet portion
    if (walletPence > 0) {
      const paymentsUrl = getServiceUrl('PAYMENTS_SERVICE_URL', 4019);
      const key = process.env.INTERNAL_API_KEY;
      const walletRes = await fetch(`${paymentsUrl}/internal/wallet/spend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(key ? { 'x-internal-key': key } : {}),
        },
        body: JSON.stringify({
          userId:      req.user.sub,
          amountPence: walletPence,
          orderId:     order.id,
          description: `Order ${order.id.slice(0, 8)} — wallet payment £${(walletPence / 100).toFixed(2)}`,
        }),
      });
      if (!walletRes.ok) {
        const errData = await walletRes.json().catch(() => ({}));
        // Undo listing reservation
        if (listing.quantity <= 1) {
          await listing.update({ status: ListingStatus.ACTIVE, soldAt: null });
        } else {
          await listing.increment('quantity');
        }
        await order.destroy();
        return res.status(walletRes.status).json({ error: errData.error || 'Wallet payment failed' });
      }
    }

    // Create Stripe escrow PaymentIntent for card portion (if any)
    let clientSecret = null;
    if (cardPence > 0 && listing.sellerStripeAccountId) {
      try {
        const pi = await createEscrowPaymentIntent({
          amountPence:           cardPence,
          currency:              (listing.currency || 'GBP').toLowerCase(),
          sellerStripeAccountId: listing.sellerStripeAccountId,
          platformFeePence:      Math.round(platformFeePence * (cardPence / totalPence)),
          orderId:               order.id,
        });
        await order.update({
          stripePaymentIntentId: pi.id,
          stripeClientSecret:    pi.client_secret,
        });
        clientSecret = pi.client_secret;
      } catch (stripeErr) {
        // Refund wallet if Stripe PI creation fails
        if (walletPence > 0) {
          const paymentsUrl = getServiceUrl('PAYMENTS_SERVICE_URL', 4019);
          const key = process.env.INTERNAL_API_KEY;
          await fetch(`${paymentsUrl}/internal/wallet/refund-purchase`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(key ? { 'x-internal-key': key } : {}),
            },
            body: JSON.stringify({ userId: req.user.sub, amountPence: walletPence, orderId: order.id }),
          }).catch(() => {});
        }
        await order.destroy();
        if (listing.quantity <= 1) {
          await listing.update({ status: ListingStatus.ACTIVE, soldAt: null });
        } else {
          await listing.increment('quantity');
        }
        throw stripeErr;
      }
    } else if (cardPence === 0) {
      // Fully wallet-paid — mark as authorised and ready to ship immediately
      await order.update({
        paymentStatus:    OrderPaymentStatus.AUTHORISED,
        fulfilmentStatus: OrderFulfilmentStatus.AWAITING_SHIPMENT,
        authorisedAt:     new Date(),
      });
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

// ─── POST /listings/batch — create multiple listings with one shared proof code ─

router.post('/batch', requireAuth, async (req, res) => {
  const { listings: items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'listings array is required' });
  }
  if (items.length > 50) {
    return res.status(400).json({ error: 'Maximum 50 listings per batch' });
  }

  try {
    // Enforce subscription listing limit for the whole batch at once
    const caps = await checkCapabilities(req.user.sub);
    if (caps.maxActiveListings !== null) {
      const activeCount = await CardListing.count({
        where: { sellerId: req.user.sub, status: { [Op.in]: [ListingStatus.ACTIVE, ListingStatus.PENDING_PROOF] } },
      });
      const available = caps.maxActiveListings - activeCount;
      if (items.length > available) {
        return res.status(403).json({
          error: `Listing limit reached. You can add ${available} more listing(s) on your current plan.`,
          limit:     caps.maxActiveListings,
          current:   activeCount,
          available,
          plan:      caps.planName,
        });
      }
    }

    const sellerProfile  = await SellerProfile.findByPk(req.user.sub);
    const stripeAccountId = sellerProfile?.stripeOnboardingComplete
      ? sellerProfile.stripeAccountId
      : null;

    // All listings in the batch share one proof code
    const batchId    = randomUUID();
    const proofCode  = generateProofCode();
    const proofExpiry = proofCodeExpiry();

    const created = await Promise.all(
      items
        .filter((item) => item.cardId && item.title && item.condition)
        .map((item) => CardListing.create({
          sellerId:              req.user.sub,
          cardId:                item.cardId,
          title:                 item.title,
          description:           item.description  || null,
          condition:             item.condition,
          variant:               item.variant       || null,
          price:                 item.price         ?? null,
          currency:              item.currency      || 'GBP',
          quantity:              item.quantity      || 1,
          status:                ListingStatus.PENDING_PROOF,
          batchId,
          proofCode,
          proofCodeExpiresAt:    proofExpiry,
          shippingType:          item.shippingType  || 'FIXED',
          shippingPrice:         item.shippingType === 'FIXED' ? (item.shippingPrice ?? null) : null,
          parcelSize:            item.parcelSize    || 'LARGE_LETTER',
          labelPaidBy:           item.labelPaidBy   === 'buyer' ? 'buyer' : 'seller',
          allowOffers:           item.allowOffers   !== false,
          offerMinPrice:         item.offerMinPrice ?? null,
          willTrade:             item.willTrade     === true,
          sellerStripeAccountId: stripeAccountId,
        })),
    );

    res.status(201).json({
      batchId,
      proofCode,
      proofCodeExpiresAt: proofExpiry,
      count:    created.length,
      listings: created,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /listings/batch/:batchId/proof — one photo activates entire batch ───

router.post('/batch/:batchId/proof', requireAuth, async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'image (base64) is required' });

  try {
    const listings = await CardListing.findAll({
      where: {
        batchId:  req.params.batchId,
        sellerId: req.user.sub,
        status:   ListingStatus.PENDING_PROOF,
      },
    });
    if (!listings.length) {
      return res.status(404).json({ error: 'No pending listings found for this batch' });
    }

    const proofCode = listings[0].proofCode;

    // Regenerate if expired
    if (listings[0].proofCodeExpiresAt && new Date(listings[0].proofCodeExpiresAt) < new Date()) {
      const newCode   = generateProofCode();
      const newExpiry = proofCodeExpiry();
      await CardListing.update(
        { proofCode: newCode, proofCodeExpiresAt: newExpiry },
        { where: { batchId: req.params.batchId, sellerId: req.user.sub } },
      );
      return res.status(410).json({
        error: 'Proof code expired — a new code has been generated. Re-photograph with the new code.',
        newProofCode: newCode,
      });
    }

    // Save photo + run OCR (code-only — too many cards in one photo for card name check)
    const imagePath = await saveProofImage(req.params.batchId, req.user.sub, image);
    const result    = await moderateProof(imagePath, proofCode);

    const now = new Date();
    const updates = {
      proofImagePath:   imagePath,
      proofUploadedAt:  now,
      moderationResult: result,
      moderatedAt:      result !== 'pending_admin' ? now : null,
      ...(result === 'approved' ? { status: ListingStatus.ACTIVE } : {}),
    };

    await CardListing.update(updates, {
      where: { batchId: req.params.batchId, sellerId: req.user.sub, status: ListingStatus.PENDING_PROOF },
    });

    if (result === 'approved') {
      for (const listing of listings) {
        await OwnershipRecord.create({
          cardId:     listing.cardId,
          ownerId:    listing.sellerId,
          eventType:  'LISTING_VERIFIED',
          sourceType: 'LISTING',
          sourceId:   listing.id,
          proofCode,
        }).catch(() => {});
        triggerWishlistMatch(listing).catch(() => {});
      }
      await notifyUser({
        userId:  req.user.sub,
        type:    NotificationType.INFO,
        title:   `${listings.length} listing${listings.length !== 1 ? 's' : ''} verified and live`,
        body:    `Your batch of ${listings.length} card${listings.length !== 1 ? 's' : ''} has been verified and is now live on the marketplace.`,
        linkUrl: '/dashboard?view=selling',
      }).catch(() => {});
    } else {
      await notifyUser({
        userId:  req.user.sub,
        type:    NotificationType.INFO,
        title:   'Batch proof submitted — under review',
        body:    `Your proof photo for ${listings.length} listing${listings.length !== 1 ? 's' : ''} is being reviewed by a moderator.`,
        linkUrl: '/dashboard?view=selling',
      }).catch(() => {});
    }

    res.json({ ok: true, result, activated: result === 'approved' ? listings.length : 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
