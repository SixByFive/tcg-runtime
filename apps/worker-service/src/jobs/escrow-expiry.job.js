/**
 * Escrow Expiry Warning Job
 *
 * Stripe authorises a card hold for 7 days on manual-capture PaymentIntents.
 * If the seller hasn't shipped by day 5, we warn them.
 * If they haven't shipped by day 6, we escalate.
 * At day 7, Stripe silently releases the hold — the order fails.
 *
 * Schedule: daily at 09:00
 */
import { Op } from 'sequelize';
import { MarketplaceOrder } from '../models/index.js';
import { notifyUser, NotificationType } from '@sbf/contracts';
import { createLogger } from '@sbf/logger';

const logger = createLogger('worker:escrow-expiry');

const DAY_MS   = 24 * 60 * 60 * 1000;
const WARN_DAY = 5;
const ESC_DAY  = 6;

export async function runEscrowExpiryJob() {
  logger.info('Running escrow expiry check…');
  let warned = 0, escalated = 0;

  try {
    const cutoffWarn = new Date(Date.now() - WARN_DAY * DAY_MS);
    const cutoffEsc  = new Date(Date.now() - ESC_DAY  * DAY_MS);

    // Orders authorised more than 5 days ago, not yet shipped
    const orders = await MarketplaceOrder.findAll({
      where: {
        paymentStatus:    'authorised',
        fulfilmentStatus: 'awaiting_shipment',
        authorisedAt: { [Op.lte]: cutoffWarn },
      },
    });

    for (const order of orders) {
      const meta      = order.metadataJson || {};
      const ageMs     = Date.now() - new Date(order.authorisedAt).getTime();
      const ageDays   = ageMs / DAY_MS;
      const isEscalated = ageDays >= ESC_DAY;

      // Only re-notify once per tier
      if (isEscalated && meta.escrowEscalatedAt) continue;
      if (!isEscalated && meta.escrowWarnedAt)    continue;

      const title = isEscalated
        ? '⚠️ URGENT: Ship today or payment will be lost'
        : 'Action required: Ship your card soon';
      const body  = isEscalated
        ? 'Payment authorisation expires tomorrow. If you do not submit a tracking number today, the buyer\'s hold will be released and the sale will fail.'
        : 'The buyer\'s payment authorisation expires in 2 days. Please ship your card and submit a tracking number now.';

      await notifyUser({
        userId:  order.sellerId,
        type:    NotificationType.WARNING,
        title,
        body,
        linkUrl: `/orders/${order.id}`,
        meta:    { orderId: order.id },
      }).catch(() => {});

      // Record warning in metadataJson so we don't re-send
      const updatedMeta = { ...meta };
      if (isEscalated) updatedMeta.escrowEscalatedAt = new Date().toISOString();
      else              updatedMeta.escrowWarnedAt    = new Date().toISOString();

      await order.update({ metadataJson: updatedMeta });
      isEscalated ? escalated++ : warned++;
    }

    logger.info(`Escrow expiry: ${warned} warned, ${escalated} escalated`);
  } catch (err) {
    logger.error(`Escrow expiry job failed: ${err.message}`);
  }
}
