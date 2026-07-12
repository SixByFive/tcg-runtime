import { Router } from 'express';
import { requireAuth } from '@sbf/auth';
import { CardListing, Offer, Order, SellerProfile, UserProfile } from '../models/index.js';
import { createEscrowPaymentIntent } from '../services/stripe.service.js';
import { calculateFeeForSeller } from '../services/fees.service.js';
import { notifyUser, NotificationType, ListingStatus, OfferStatus, OrderPaymentStatus } from '@sbf/contracts';

const router = Router();

// ─── GET /listings/:listingId/offers — seller views their offers ──────────────

router.get('/listings/:listingId/offers', requireAuth, async (req, res) => {
  try {
    const listing = await CardListing.findByPk(req.params.listingId);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.sellerId !== req.user.sub) return res.status(403).json({ error: 'Not your listing' });

    const offers = await Offer.findAll({
      where: { listingId: req.params.listingId },
      order: [['createdAt', 'DESC']],
    });
    res.json(offers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /listings/:listingId/offers — buyer makes an offer ─────────────────

router.post('/listings/:listingId/offers', requireAuth, async (req, res) => {
  const { amount, message } = req.body;
  if (!amount || isNaN(amount)) return res.status(400).json({ error: 'amount is required' });

  try {
    const listing = await CardListing.findByPk(req.params.listingId);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.status !== ListingStatus.ACTIVE) return res.status(409).json({ error: 'Listing is not active' });
    if (listing.sellerId === req.user.sub) return res.status(403).json({ error: 'Cannot offer on your own listing' });
    if (!listing.allowOffers) return res.status(409).json({ error: 'This listing does not accept offers' });
    if (listing.offerMinPrice && Number(amount) < Number(listing.offerMinPrice)) {
      return res.status(400).json({
        error: `Minimum offer is £${listing.offerMinPrice}`,
      });
    }

    // Expire any previous pending offers from this buyer on the same listing
    await Offer.update(
      { status: OfferStatus.EXPIRED },
      { where: { listingId: listing.id, buyerId: req.user.sub, status: OfferStatus.PENDING } },
    );

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h
    const offer = await Offer.create({
      listingId: listing.id,
      buyerId:   req.user.sub,
      amount,
      message:   message || null,
      status:    OfferStatus.PENDING,
      expiresAt,
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

// ─── GET /offers — buyer views their own offers ───────────────────────────────

router.get('/', requireAuth, async (req, res) => {
  try {
    const offers = await Offer.findAll({
      where: { buyerId: req.user.sub },
      include: [{ model: CardListing, attributes: ['id', 'title', 'price', 'status', 'cardId'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json(offers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /offers/incoming — all pending offers on the seller's listings ──────

router.get('/incoming', requireAuth, async (req, res) => {
  try {
    const offers = await Offer.findAll({
      include: [{
        model: CardListing,
        where: { sellerId: req.user.sub },
        attributes: ['id', 'title', 'price', 'cardId', 'sellerId'],
      }],
      order: [['createdAt', 'DESC']],
    });
    res.json(offers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /offers/:id/respond — seller accepts, declines, or counters ─────────

router.post('/:id/respond', requireAuth, async (req, res) => {
  const { action, counterAmount, counterMessage, buyerAddress } = req.body;
  if (!action || !['accept', 'decline', 'counter'].includes(action)) {
    return res.status(400).json({ error: 'action must be accept, decline, or counter' });
  }
  if (action === 'counter' && !counterAmount) {
    return res.status(400).json({ error: 'counterAmount is required for counter action' });
  }

  try {
    const offer = await Offer.findByPk(req.params.id, {
      include: [{ model: CardListing }],
    });
    if (!offer) return res.status(404).json({ error: 'Offer not found' });
    if (offer.CardListing.sellerId !== req.user.sub) return res.status(403).json({ error: 'Not your listing' });
    if (offer.status !== OfferStatus.PENDING) return res.status(409).json({ error: 'Offer is no longer pending' });
    if (offer.expiresAt && new Date(offer.expiresAt) < new Date()) {
      await offer.update({ status: OfferStatus.EXPIRED });
      return res.status(410).json({ error: 'Offer has expired' });
    }

    const listing = offer.CardListing;

    if (action === 'decline') {
      await offer.update({ status: OfferStatus.DECLINED, respondedAt: new Date() });
      await notifyUser({
        userId: offer.buyerId,
        type:   NotificationType.WARNING,
        title:  'Offer declined',
        body:   `Your offer on "${listing.title}" was declined.`,
        linkUrl: `/marketplace/${listing.id}`,
      }).catch(() => {});
      return res.json({ ok: true, status: OfferStatus.DECLINED });
    }

    if (action === 'counter') {
      await offer.update({
        status: OfferStatus.COUNTERED, counterAmount, counterMessage: counterMessage || null, respondedAt: new Date(),
      });
      await notifyUser({
        userId: offer.buyerId,
        type:   NotificationType.INFO,
        title:  'Offer countered',
        body:   `"${listing.title}" — seller countered at £${Number(counterAmount).toFixed(2)}`,
        linkUrl: `/marketplace/${listing.id}`,
      }).catch(() => {});
      return res.json({ ok: true, status: OfferStatus.COUNTERED, counterAmount });
    }

    // action === 'accept' → create order
    const agreedPrice     = Number(offer.amount);
    const agreedPricePence = Math.round(agreedPrice * 100);
    const shippingPence   = listing.shippingType === 'FIXED'
      ? Math.round(Number(listing.shippingPrice ?? 0) * 100)
      : 0;
    const totalPence = agreedPricePence + shippingPence;
    // Use the seller's subscription tier for their platform fee rate
    const feePence   = await calculateFeeForSeller(agreedPricePence, listing.sellerId);

    // Resolve buyer address: request body → offer snapshot → live profile lookup
    let resolvedAddress = buyerAddress || offer.buyerAddressJson || null;
    if (!resolvedAddress) {
      const profile = await UserProfile.findOne({ where: { userId: offer.buyerId } });
      if (profile?.address1) {
        resolvedAddress = {
          line1:    profile.address1,
          line2:    profile.address2 || undefined,
          city:     profile.city,
          postcode: profile.postcode,
          state:    profile.state || undefined,
          country:  profile.country || 'GB',
        };
      }
    }

    const order = await Order.create({
      listingId:   listing.id,
      buyerId:     offer.buyerId,
      sellerId:    listing.sellerId,
      cardId:      listing.cardId,
      offerId:     offer.id,
      salePrice:   agreedPrice,
      platformFee: feePence / 100,
      shippingCost: shippingPence / 100,
      totalAmount: totalPence / 100,
      currency:    listing.currency || 'GBP',
      buyerAddressJson: resolvedAddress,
      sellerStripeAccountId: listing.sellerStripeAccountId,
      paymentStatus: OrderPaymentStatus.PENDING,
    });

    await offer.update({ status: OfferStatus.ACCEPTED, respondedAt: new Date() });

    // Mark listing sold
    if (listing.quantity <= 1) {
      await listing.update({ status: ListingStatus.SOLD, soldAt: new Date() });
    } else {
      await listing.decrement('quantity');
    }

    // Create Stripe PaymentIntent
    let clientSecret = null;
    if (listing.sellerStripeAccountId) {
      const pi = await createEscrowPaymentIntent({
        amountPence: totalPence,
        currency:    (listing.currency || 'GBP').toLowerCase(),
        sellerStripeAccountId: listing.sellerStripeAccountId,
        platformFeePence: feePence,
        orderId: order.id,
      });
      await order.update({
        stripePaymentIntentId: pi.id,
        stripeClientSecret:    pi.client_secret,
      });
      clientSecret = pi.client_secret;
    }

    await notifyUser({
      userId: offer.buyerId,
      type:   NotificationType.INFO,
      title:  'Offer accepted!',
      body:   `Your offer on "${listing.title}" was accepted. Complete your purchase.`,
      linkUrl: `/dashboard?view=orders`,
      meta:   { orderId: order.id },
    }).catch(() => {});

    res.json({ ok: true, orderId: order.id, clientSecret, totalAmount: totalPence / 100 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /offers/:id — buyer withdraws offer ───────────────────────────────

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const offer = await Offer.findByPk(req.params.id);
    if (!offer) return res.status(404).json({ error: 'Offer not found' });
    if (offer.buyerId !== req.user.sub) return res.status(403).json({ error: 'Not your offer' });
    if (![OfferStatus.PENDING, OfferStatus.COUNTERED].includes(offer.status)) {
      return res.status(409).json({ error: 'Offer cannot be withdrawn in its current state' });
    }
    await offer.update({ status: OfferStatus.WITHDRAWN, respondedAt: new Date() });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
