/**
 * Trade Top-Up Expiry Warning Job
 *
 * When a trade has a cash top-up, the Stripe authorisation follows the same
 * 7-day expiry window as marketplace orders. If the top-up hold approaches
 * day 5 without both parties confirming delivery, we warn both parties.
 *
 * topUpPaidAt is used as the authorisation timestamp (the moment the hold
 * was placed). Trades in TOP_UP_PENDING status have not yet confirmed receipt.
 *
 * Schedule: daily at 09:05
 */
import { Op } from 'sequelize';
import { Trade } from '../models/index.js';
import { notifyUser, NotificationType } from '@sbf/contracts';
import { createLogger } from '@sbf/logger';

const logger = createLogger('worker:trade-topup-expiry');

const DAY_MS   = 24 * 60 * 60 * 1000;
const WARN_DAY = 5;
const ESC_DAY  = 6;

export async function runTradeTopUpExpiryJob() {
  logger.info('Running trade top-up expiry check…');
  let warned = 0;

  try {
    const cutoff = new Date(Date.now() - WARN_DAY * DAY_MS);

    // Trades with an active top-up hold approaching expiry
    const trades = await Trade.findAll({
      where: {
        status:      'TOP_UP_PENDING',
        topUpPaidAt: { [Op.lte]: cutoff },
      },
    });

    for (const trade of trades) {
      const ageDays = (Date.now() - new Date(trade.topUpPaidAt).getTime()) / DAY_MS;
      const isEsc   = ageDays >= ESC_DAY;

      const title = isEsc
        ? '⚠️ URGENT: Trade top-up authorisation expires tomorrow'
        : 'Trade top-up expiring soon';
      const body  = isEsc
        ? 'The Stripe authorisation for your trade\'s cash top-up expires tomorrow. Please confirm delivery or the hold will be released.'
        : 'The cash top-up hold on your trade expires in 2 days. Both parties must confirm delivery before then.';

      for (const userId of [trade.partyAId, trade.partyBId]) {
        await notifyUser({
          userId,
          type:    NotificationType.WARNING,
          title,
          body,
          linkUrl: `/trades/${trade.id}`,
          meta:    { tradeId: trade.id },
        }).catch(() => {});
      }

      warned++;
    }

    logger.info(`Trade top-up expiry: ${warned} trades warned`);
  } catch (err) {
    logger.error(`Trade top-up expiry job failed: ${err.message}`);
  }
}
