import { Router } from 'express';
import { Order, SellerProfile, CardListing } from '../models/index.js';
import { constructWebhookEvent } from '../services/stripe.service.js';
import { notifyUser, NotificationType, OrderPaymentStatus } from '@sbf/contracts';
import { getServiceUrl } from '@sbf/config';
import { relistListing } from '../services/listing.service.js';
import { createLogger } from '@sbf/logger';

const logger = createLogger('marketplace-service:webhooks');
const router = Router();

// ─── Stripe webhook ───────────────────────────────────────────────────────────
// Mounted with express.raw() in index.js — raw body required for signature verification.

router.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).json({ error: 'Missing stripe-signature header' });

  let event;
  try {
    event = constructWebhookEvent(req.body, sig);
  } catch (err) {
    logger.warn(`Stripe webhook signature failure: ${err.message}`);
    return res.status(400).json({ error: `Webhook signature error: ${err.message}` });
  }

  try {
    switch (event.type) {

      // Fired when a manual-capture PaymentIntent is authorised.
      // This is the signal that the buyer's card is reserved — notify seller to ship.
      case 'payment_intent.amount_capturable_updated': {
        const pi    = event.data.object;
        const order = await Order.findOne({ where: { stripePaymentIntentId: pi.id } });
        if (!order) break;

        await order.update({ paymentStatus: OrderPaymentStatus.AUTHORISED, authorisedAt: new Date() });

        await notifyUser({
          userId: order.sellerId,
          type:   NotificationType.LISTING_SOLD,
          title:  'Payment authorised — ship now!',
          body:   'The buyer\'s payment is authorised. Please ship the card and submit your tracking number.',
          linkUrl: `/orders/${order.id}`,
          meta:   { orderId: order.id },
        }).catch(() => {});
        break;
      }

      // Fired when a charge is captured (manual-capture flow completes).
      case 'charge.captured': {
        const charge = event.data.object;
        const order  = await Order.findOne({ where: { stripePaymentIntentId: charge.payment_intent } });
        if (!order) break;

        await order.update({ paymentStatus: OrderPaymentStatus.CAPTURED, capturedAt: new Date() });

        await notifyUser({
          userId:  order.buyerId,
          type:    NotificationType.INFO,
          title:   'Payment confirmed',
          body:    'Your payment has been processed. Your order is on its way!',
          linkUrl: `/orders/${order.id}`,
          meta:    { orderId: order.id },
        }).catch(() => {});

        await notifyUser({
          userId:  order.sellerId,
          type:    NotificationType.INFO,
          title:   'Payment received',
          body:    "The buyer's payment has been captured. Funds will be transferred after delivery confirmation.",
          linkUrl: `/orders/${order.id}`,
          meta:    { orderId: order.id },
        }).catch(() => {});
        break;
      }

      // Fired when a PaymentIntent payment attempt fails.
      case 'payment_intent.payment_failed': {
        const pi    = event.data.object;
        const order = await Order.findOne({ where: { stripePaymentIntentId: pi.id } });
        if (!order) break;

        await order.update({ paymentStatus: OrderPaymentStatus.CANCELLED });

        // Refund any wallet contribution the buyer already paid
        if (order.walletAmountPence > 0) {
          const paymentsUrl = getServiceUrl('PAYMENTS_SERVICE_URL', 4019);
          const key         = process.env.INTERNAL_API_KEY;
          await fetch(`${paymentsUrl}/internal/wallet/refund-purchase`, {
            method:  'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(key ? { 'x-internal-key': key } : {}),
            },
            body: JSON.stringify({
              userId:      order.buyerId,
              amountPence: order.walletAmountPence,
              orderId:     order.id,
              description: `Payment failed: order ${order.id.slice(0, 8)}`,
            }),
          }).catch((e) => logger.warn(`wallet refund on payment_failed: ${e.message}`));
        }

        // Relist — payment never completed so the card was never sold
        if (order.listingId) {
          await relistListing(await CardListing.findByPk(order.listingId));
        }

        await notifyUser({
          userId:  order.buyerId,
          type:    NotificationType.WARNING,
          title:   'Payment failed',
          body:    'Your payment could not be processed. Please update your payment method and try again.',
          linkUrl: `/orders/${order.id}`,
          meta:    { orderId: order.id },
        }).catch(() => {});
        break;
      }

      // Fired when a PaymentIntent is cancelled (dispute pre-capture, order cancellation).
      case 'payment_intent.canceled': {
        const pi    = event.data.object;
        const order = await Order.findOne({ where: { stripePaymentIntentId: pi.id } });
        if (!order) break;

        if (order.paymentStatus !== OrderPaymentStatus.CANCELLED) {
          await order.update({ paymentStatus: OrderPaymentStatus.CANCELLED });
        }

        // Relist — PI was voided before any capture, card was never sold
        if (order.listingId) {
          await relistListing(await CardListing.findByPk(order.listingId));
        }
        break;
      }

      // Fired when a refund completes (dispute resolution in buyer's favour after capture).
      case 'charge.refunded': {
        const charge = event.data.object;
        const order  = await Order.findOne({ where: { stripePaymentIntentId: charge.payment_intent } });
        if (!order) break;

        // Only update if not already marked refunded (inline dispute resolution may have done it)
        if (order.paymentStatus !== OrderPaymentStatus.REFUNDED) {
          await order.update({ paymentStatus: OrderPaymentStatus.REFUNDED });
        }

        await notifyUser({
          userId:  order.buyerId,
          type:    NotificationType.INFO,
          title:   'Refund processed',
          body:    'Your refund has been processed and will appear in your account within a few days.',
          linkUrl: `/orders/${order.id}`,
          meta:    { orderId: order.id },
        }).catch(() => {});
        break;
      }

      // Stripe Connect — account updated (e.g. onboarding completed externally).
      case 'account.updated': {
        const account = event.data.object;
        const profile = await SellerProfile.findOne({
          where: { stripeAccountId: account.id },
        });
        if (profile) {
          await profile.update({ stripeOnboardingComplete: account.charges_enabled });
        }
        break;
      }

      default:
        // Unhandled event type — ignore gracefully
        break;
    }
  } catch (err) {
    logger.error(`Stripe webhook handler error (${event.type}): ${err.message}`);
    // Return 200 anyway — Stripe retries on non-2xx responses
  }

  res.json({ received: true });
});


export default router;
