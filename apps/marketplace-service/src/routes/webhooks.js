import { Router } from 'express';
import { Order, SellerProfile } from '../models/index.js';
import { constructWebhookEvent } from '../services/stripe.service.js';
import { parseTrackingWebhook } from '../services/shipping.service.js';
import { notifyUser, NotificationType } from '@sbf/contracts';
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

        await order.update({ paymentStatus: 'authorised', authorisedAt: new Date() });

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

        await order.update({ paymentStatus: 'captured', capturedAt: new Date() });

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

        await order.update({ paymentStatus: 'cancelled' });

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
        if (order && order.paymentStatus !== 'cancelled') {
          await order.update({ paymentStatus: 'cancelled' });
        }
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

// ─── EasyPost tracking webhook ────────────────────────────────────────────────

router.post('/easypost', async (req, res) => {
  try {
    const tracking = parseTrackingWebhook(req.body);
    if (!tracking?.trackingCode) return res.json({ ok: true });

    const order = await Order.findOne({ where: { trackingNumber: tracking.trackingCode } });
    if (!order) return res.json({ ok: true });

    if (tracking.status === 'delivered') {
      // Don't auto-complete — buyer must confirm receipt. Just notify.
      await notifyUser({
        userId: order.buyerId,
        type:   NotificationType.INFO,
        title:  'Your order has been delivered',
        body:   'EasyPost shows your card as delivered. Please confirm receipt to release payment to the seller.',
        linkUrl: `/orders/${order.id}`,
        meta:   { orderId: order.id, trackingCode: tracking.trackingCode },
      }).catch(() => {});
    }
  } catch (err) {
    logger.error(`EasyPost webhook error: ${err.message}`);
  }

  res.json({ ok: true });
});

export default router;
