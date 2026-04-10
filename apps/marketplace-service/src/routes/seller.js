import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { SellerProfile, CardListing } from '../models/index.js';
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

export default router;
