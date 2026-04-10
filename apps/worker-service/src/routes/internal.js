/**
 * Internal endpoints — callable only by other services with x-internal-key.
 *
 * POST /internal/wishlist-match
 *   Called by marketplace-service when a listing goes ACTIVE.
 *   Fans out notifications to users who have the card in their wishlist.
 */
import { Router } from 'express';
import { sequelize } from '../models/index.js';
import { notifyUser, NotificationType } from '@sbf/contracts';
import { createLogger } from '@sbf/logger';

const logger = createLogger('worker:internal');
const router = Router();

function requireInternal(req, res, next) {
  const key = req.headers['x-internal-key'];
  if (!key || key !== process.env.INTERNAL_API_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

router.use(requireInternal);

/**
 * POST /internal/wishlist-match
 *
 * Body: { cardId, listingId, title, price, condition }
 *
 * Queries collections-service's wishlist tables (shared DB) for users
 * who have this cardId saved, then notifies each one (capped at 200).
 *
 * Wishlist schema assumed:
 *   wishlists (id, userId)
 *   wishlist_items (id, wishlistId, cardId)
 * Adjust table/column names to match actual collections-service schema.
 */
router.post('/wishlist-match', async (req, res) => {
  const { cardId, listingId, title, price, condition } = req.body;
  if (!cardId || !listingId) {
    return res.status(400).json({ error: 'cardId and listingId are required' });
  }

  res.json({ ok: true, queued: true }); // respond immediately, fan-out async

  setImmediate(async () => {
    try {
      // Find distinct users who have this card in any wishlist
      const [rows] = await sequelize.query(
        `SELECT DISTINCT w.userId
         FROM wishlist_items wi
         JOIN wishlists w ON wi.wishlistId = w.id
         WHERE wi.cardId = :cardId
         LIMIT 200`,
        { replacements: { cardId } },
      );

      if (!rows.length) return;

      logger.info(`Wishlist fan-out: notifying ${rows.length} users for cardId=${cardId}`);

      for (const { userId } of rows) {
        await notifyUser({
          userId,
          type:    NotificationType.INFO,
          title:   'A wishlisted card is now for sale',
          body:    `${title ?? cardId}${condition ? ` (${condition})` : ''} listed for £${Number(price).toFixed(2)}`,
          linkUrl: `/listings/${listingId}`,
          meta:    { cardId, listingId },
        }).catch(() => {});
      }
    } catch (err) {
      logger.error(`Wishlist fan-out failed for cardId=${cardId}: ${err.message}`);
    }
  });
});

/**
 * POST /internal/run-job
 *
 * Manually trigger a named job — useful for admin tooling and testing.
 * Body: { job: 'escrow-expiry' | 'offer-expiry' | 'price-alerts' | 'trade-topup-expiry' }
 */
router.post('/run-job', async (req, res) => {
  const { job } = req.body;
  const jobs = {
    'escrow-expiry':      () => import('../jobs/escrow-expiry.job.js').then((m) => m.runEscrowExpiryJob()),
    'offer-expiry':       () => import('../jobs/offer-expiry.job.js').then((m) => m.runOfferExpiryJob()),
    'price-alerts':       () => import('../jobs/price-alerts.job.js').then((m) => m.runPriceAlertsJob()),
    'trade-topup-expiry': () => import('../jobs/trade-topup-expiry.job.js').then((m) => m.runTradeTopUpExpiryJob()),
  };

  if (!jobs[job]) {
    return res.status(400).json({ error: `Unknown job: ${job}`, available: Object.keys(jobs) });
  }

  res.json({ ok: true, started: job });
  setImmediate(() => jobs[job]().catch((err) => logger.error(`Manual job ${job} failed: ${err.message}`)));
});

export default router;
