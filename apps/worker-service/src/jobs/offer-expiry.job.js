/**
 * Offer Expiry Sweeper
 *
 * Finds marketplace offers that have passed their expiresAt timestamp
 * and are still in 'pending' or 'countered' status, marks them expired,
 * and notifies the buyer.
 *
 * Schedule: hourly at :30
 */
import { Op } from 'sequelize';
import { MarketplaceOffer, CardListing } from '../models/index.js';
import { notifyUser, NotificationType, OfferStatus } from '@sbf/contracts';
import { createLogger } from '@sbf/logger';

const logger = createLogger('worker:offer-expiry');

export async function runOfferExpiryJob() {
  logger.info('Running offer expiry sweep…');

  try {
    const stale = await MarketplaceOffer.findAll({
      where: {
        status:    { [Op.in]: [OfferStatus.PENDING, OfferStatus.COUNTERED] },
        expiresAt: { [Op.lt]: new Date() },
      },
      include: [{ model: CardListing, attributes: ['title'], required: false }],
      limit: 500,
    });

    if (!stale.length) {
      logger.info('Offer expiry: nothing to expire');
      return;
    }

    const ids = stale.map((o) => o.id);
    await MarketplaceOffer.update({ status: OfferStatus.EXPIRED }, { where: { id: ids } });

    // Notify buyers
    for (const offer of stale) {
      const title = offer.CardListing?.title ?? 'a listing';
      await notifyUser({
        userId:  offer.buyerId,
        type:    NotificationType.INFO,
        title:   'Offer expired',
        body:    `Your offer of £${Number(offer.amount).toFixed(2)} on "${title}" has expired.`,
        linkUrl: `/listings/${offer.listingId}`,
      }).catch(() => {});
    }

    logger.info(`Offer expiry: ${stale.length} offers expired`);
  } catch (err) {
    logger.error(`Offer expiry job failed: ${err.message}`);
  }
}
