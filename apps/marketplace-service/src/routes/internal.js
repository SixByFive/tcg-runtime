import { Router } from 'express';
import { Op } from 'sequelize';
import { createLogger } from '@sbf/logger';
import { Order } from '../models/index.js';
import { capturePaymentIntent, cancelPaymentIntent } from '../services/stripe.service.js';
import { relistListing } from '../services/listing.service.js';
import { notifyUser, NotificationType, OrderPaymentStatus, OrderFulfilmentStatus } from '@sbf/contracts';

const logger = createLogger('marketplace-service:internal');
const router = Router();

// ─── Internal auth ────────────────────────────────────────────────────────────

router.use((req, res, next) => {
  const key = process.env.INTERNAL_API_KEY;
  if (key && req.headers['x-internal-key'] !== key) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// ─── Auto-capture timed-out orders ───────────────────────────────────────────

/**
 * POST /internal/auto-capture
 *
 * Called by a daily cron job. Finds all orders that have been shipped but
 * the buyer hasn't confirmed receipt within AUTO_CAPTURE_DAYS (default 7).
 *
 * Stripe authorisations expire after 7 days — this must run before that.
 * Auto-capturing protects the seller and prevents payment expiry.
 *
 * Cron schedule: daily, e.g. 02:00 UTC
 * curl -X POST https://backendtcg.sixbyfive.com/internal/marketplace/auto-capture \
 *      -H "x-internal-key: $INTERNAL_API_KEY"
 */
router.post('/auto-capture', async (req, res) => {
  const captureDays = Number(process.env.AUTO_CAPTURE_DAYS ?? 7);
  const cutoff      = new Date(Date.now() - captureDays * 24 * 60 * 60 * 1000);

  try {
    const orders = await Order.findAll({
      where: {
        paymentStatus:    OrderPaymentStatus.AUTHORISED,
        fulfilmentStatus: OrderFulfilmentStatus.SHIPPED,
        shippedAt:        { [Op.lt]: cutoff },
        stripePaymentIntentId: { [Op.not]: null },
      },
    });

    const results = { captured: [], failed: [] };

    for (const order of orders) {
      try {
        await capturePaymentIntent(order.stripePaymentIntentId);
        await order.update({
          paymentStatus:    OrderPaymentStatus.CAPTURED,
          fulfilmentStatus: OrderFulfilmentStatus.COMPLETED,
          capturedAt:       new Date(),
          completedAt:      new Date(),
          adminNotes:       `Auto-captured after ${captureDays}-day delivery window`,
        });

        await notifyUser({
          userId:  order.buyerId,
          type:    NotificationType.INFO,
          title:   'Order marked complete',
          body:    `Your order was automatically completed after ${captureDays} days. If you have an issue, please contact support.`,
          linkUrl: `/orders/${order.id}`,
          meta:    { orderId: order.id },
        }).catch(() => {});

        await notifyUser({
          userId:  order.sellerId,
          type:    NotificationType.INFO,
          title:   'Payment released',
          body:    'Your payment has been automatically released after the delivery window expired.',
          linkUrl: `/orders/${order.id}`,
          meta:    { orderId: order.id },
        }).catch(() => {});

        results.captured.push(order.id);
        logger.info(`Auto-captured order ${order.id} (shipped ${order.shippedAt?.toISOString()})`);
      } catch (err) {
        results.failed.push({ id: order.id, error: err.message });
        logger.error(`Auto-capture failed for order ${order.id}: ${err.message}`);
      }
    }

    res.json({ ok: true, processed: orders.length, ...results });
  } catch (err) {
    logger.error(`auto-capture job failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /internal/marketplace/orders/:orderId/buyer ─────────────────────────
// Called by shipping-service cron to resolve the buyer userId for tracking notifications.

router.get('/orders/:orderId/buyer', async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.orderId, {
      attributes: ['id', 'buyerId'],
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ buyerId: order.buyerId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Auto-cancel expired pending orders ──────────────────────────────────────

/**
 * POST /internal/auto-cancel-pending
 *
 * Cancels orders stuck in `pending` paymentStatus for more than PENDING_EXPIRY_HOURS
 * (default 2h). These are orders where the buyer abandoned the payment flow.
 * Releases the listing back to ACTIVE.
 */
router.post('/auto-cancel-pending', async (req, res) => {
  const expiryHours = Number(process.env.PENDING_EXPIRY_HOURS ?? 2);
  const cutoff      = new Date(Date.now() - expiryHours * 60 * 60 * 1000);

  try {
    const orders = await Order.findAll({
      where: {
        paymentStatus: OrderPaymentStatus.PENDING,
        createdAt:     { [Op.lt]: cutoff },
      },
    });

    const results = { cancelled: [], failed: [] };

    for (const order of orders) {
      try {
        // Cancel Stripe intent if one was created
        if (order.stripePaymentIntentId) {
          try {
            await cancelPaymentIntent(order.stripePaymentIntentId);
          } catch (stripeErr) {
            // Intent may already be cancelled — log and continue
            logger.warn(`Stripe cancel for ${order.stripePaymentIntentId}: ${stripeErr.message}`);
          }
        }

        await order.update({
          paymentStatus:    OrderPaymentStatus.CANCELLED,
          fulfilmentStatus: OrderFulfilmentStatus.CANCELLED,
          cancelledAt:      new Date(),
          cancelReason:     'Payment not completed — automatically cancelled',
        });

        // Restore listing quantity
        const { CardListing } = await import('../models/index.js');
        await relistListing(await CardListing.findByPk(order.listingId));

        results.cancelled.push(order.id);
        logger.info(`Auto-cancelled pending order ${order.id}`);
      } catch (err) {
        results.failed.push({ id: order.id, error: err.message });
        logger.error(`Auto-cancel failed for order ${order.id}: ${err.message}`);
      }
    }

    res.json({ ok: true, processed: orders.length, ...results });
  } catch (err) {
    logger.error(`auto-cancel-pending job failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

export default router;
