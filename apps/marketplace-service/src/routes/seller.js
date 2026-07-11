import { Router } from 'express';
import { Op } from 'sequelize';
import { requireAuth } from '@sbf/auth';
import { SellerProfile, CardListing, UserReputation } from '../models/index.js';
import {
  createConnectOnboardingUrl,
  createConnectRefreshUrl,
  getAccountStatus,
} from '../services/stripe.service.js';

const router = Router();

/**
 * GET /seller/status
 *
 * Returns the caller's Stripe Connect onboarding status.
 * Used to gate listing creation on the frontend.
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const profile = await SellerProfile.findByPk(req.user.sub);
    if (!profile || !profile.stripeAccountId) {
      return res.json({ connected: false, complete: false, url: null });
    }

    const status = await getAccountStatus(profile.stripeAccountId);
    if (status.complete !== profile.stripeOnboardingComplete) {
      await profile.update({ stripeOnboardingComplete: status.complete });

      // Backfill stripeAccountId on existing listings
      if (status.complete) {
        await CardListing.update(
          { sellerStripeAccountId: profile.stripeAccountId },
          { where: { sellerId: req.user.sub, sellerStripeAccountId: null } },
        );
      }
    }

    res.json({ connected: true, complete: status.complete, ...status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /seller/connect
 *
 * Initiate Stripe Connect Express onboarding.
 * Creates a Stripe account and returns the onboarding URL.
 * Safe to call multiple times — returns a refresh URL if already initiated.
 */
router.post('/connect', requireAuth, async (req, res) => {
  try {
    let profile = await SellerProfile.findByPk(req.user.sub);

    if (profile?.stripeOnboardingComplete) {
      return res.json({ alreadyConnected: true });
    }

    if (profile?.stripeAccountId) {
      // Already initiated — generate a fresh link
      const url = await createConnectRefreshUrl(profile.stripeAccountId);
      return res.json({ accountId: profile.stripeAccountId, url });
    }

    // First time — create account
    const { accountId, url } = await createConnectOnboardingUrl(req.user.sub);
    await SellerProfile.upsert({ userId: req.user.sub, stripeAccountId: accountId });
    res.json({ accountId, url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /seller/address
 *
 * Returns the seller's saved return address for shipping labels.
 */
router.get('/address', requireAuth, async (req, res) => {
  try {
    const profile = await SellerProfile.findByPk(req.user.sub, {
      attributes: ['returnName', 'returnLine1', 'returnLine2', 'returnCity', 'returnPostcode', 'returnCountry', 'returnPhone', 'returnEmail'],
    });
    if (!profile) return res.json({});
    res.json({
      name:     profile.returnName,
      line1:    profile.returnLine1,
      line2:    profile.returnLine2,
      city:     profile.returnCity,
      postcode: profile.returnPostcode,
      country:  profile.returnCountry ?? 'GB',
      phone:    profile.returnPhone,
      email:    profile.returnEmail,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /seller/address
 *
 * Save or update the seller's return address.
 * Body: { name, line1, line2, city, postcode, country, phone, email }
 */
router.put('/address', requireAuth, async (req, res) => {
  const { name, line1, line2, city, postcode, country, phone, email } = req.body;
  if (!name || !line1 || !city || !postcode) {
    return res.status(400).json({ error: 'name, line1, city, and postcode are required' });
  }

  try {
    await SellerProfile.upsert({
      userId:         req.user.sub,
      returnName:     name,
      returnLine1:    line1,
      returnLine2:    line2 || null,
      returnCity:     city,
      returnPostcode: postcode,
      returnCountry:  country || 'GB',
      returnPhone:    phone || null,
      returnEmail:    email || null,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /seller/connect/refresh
 *
 * EasyPost redirect — user returned to our platform after completing
 * (or abandoning) Stripe onboarding. Re-check status and redirect.
 *
 * In production this would redirect to the frontend with a status query param.
 */
router.get('/connect/complete', requireAuth, async (req, res) => {
  try {
    const profile = await SellerProfile.findByPk(req.user.sub);
    if (profile?.stripeAccountId) {
      const status = await getAccountStatus(profile.stripeAccountId);
      await profile.update({ stripeOnboardingComplete: status.complete });

      if (status.complete) {
        await CardListing.update(
          { sellerStripeAccountId: profile.stripeAccountId },
          { where: { sellerId: req.user.sub, sellerStripeAccountId: null } },
        );
      }
    }
    res.redirect(`${process.env.APP_URL}/seller/dashboard?connected=true`);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /seller/:userId/reputation — public ─────────────────────────────────

router.get('/:userId/reputation', async (req, res) => {
  try {
    const [rep] = await UserReputation.findOrCreate({
      where:    { userId: req.params.userId },
      defaults: { userId: req.params.userId },
    });
    res.json({
      userId:               rep.userId,
      score:                rep.score,
      positive:             rep.positive,
      negative:             rep.negative,
      neutral:              rep.neutral,
      completedMarketplace: rep.completedMarketplace,
      flagged:              rep.flagged,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /seller/:userId/reviews — public, paginated ─────────────────────────

router.get('/:userId/reviews', async (req, res) => {
  try {
    const limit  = Math.min(Number(req.query.limit)  || 20, 50);
    const offset = Number(req.query.offset) || 0;

    const listings = await CardListing.findAll({
      where: {
        sellerId: req.params.userId,
        rating:   { [Op.ne]: null },
        [Op.or]:  [{ reviewStatus: null }, { reviewStatus: 'approved' }],
      },
      attributes: ['id', 'cardId', 'rating', 'review', 'updatedAt'],
      order: [['updatedAt', 'DESC']],
      limit,
      offset,
    });

    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
