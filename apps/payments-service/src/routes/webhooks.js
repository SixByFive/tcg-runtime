import { Router } from 'express';
import { Op } from 'sequelize';
import { UserSubscription, SubscriptionPlan, Transaction } from '../models/index.js';
import { constructWebhookEvent } from '../services/stripe.service.js';
import { notifyUser, NotificationType } from '@sbf/contracts';
import { createLogger } from '@sbf/logger';

const logger = createLogger('payments-service:webhooks');
const router = Router();

// Mounted with express.raw() in index.js
router.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).json({ error: 'Missing stripe-signature' });

  let event;
  try {
    event = constructWebhookEvent(req.body, sig);
  } catch (err) {
    logger.warn(`Stripe webhook signature failure: ${err.message}`);
    return res.status(400).json({ error: err.message });
  }

  try {
    switch (event.type) {

      // ── Subscription checkout completed ───────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode !== 'subscription' && session.mode !== 'payment') break;

        if (session.mode === 'subscription') {
          const { userId, planId } = session.metadata ?? {};
          if (!userId || !planId) break;

          const plan = await SubscriptionPlan.findByPk(planId);

          // Activate the pending subscription record
          const sub = await UserSubscription.findOne({
            where: { stripeCheckoutSessionId: session.id },
          });

          if (sub) {
            await sub.update({
              status:               'active',
              stripeSubscriptionId: session.subscription,
              stripeCustomerId:     session.customer,
            });
          } else {
            // Fallback: create from scratch (e.g. direct API call)
            await UserSubscription.create({
              userId,
              planId,
              status:               'active',
              stripeCustomerId:     session.customer,
              stripeSubscriptionId: session.subscription,
            });
          }

          await notifyUser({
            userId,
            type:    NotificationType.SUBSCRIPTION,
            title:   `You're subscribed to ${plan?.name ?? 'a plan'}!`,
            body:    'Your subscription is now active. Enjoy your benefits.',
            linkUrl: '/account/subscription',
          }).catch(() => {});
        }

        if (session.mode === 'payment') {
          // Mark pending product transaction as completed
          await Transaction.update(
            { status: 'completed', stripePaymentIntentId: session.payment_intent },
            { where: { sourceId: session.id, status: 'pending' } },
          );
        }
        break;
      }

      // ── Subscription renewed ──────────────────────────────────────────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        if (invoice.billing_reason !== 'subscription_cycle') break;

        const sub = await UserSubscription.findOne({
          where: { stripeSubscriptionId: invoice.subscription },
          include: [{ model: SubscriptionPlan, as: 'plan' }],
        });
        if (!sub) break;

        // Record renewal transaction
        await Transaction.create({
          userId:          sub.userId,
          type:            'subscription_payment',
          status:          'completed',
          amount:          invoice.amount_paid / 100,
          currency:        invoice.currency.toUpperCase(),
          description:     `${sub.plan?.name ?? 'Subscription'} renewal`,
          stripeInvoiceId: invoice.id,
          stripeChargeId:  invoice.charge,
          sourceType:      'subscription',
          sourceId:        sub.id,
        });

        // Update period dates
        await sub.update({
          currentPeriodStart: new Date(invoice.period_start * 1000),
          currentPeriodEnd:   new Date(invoice.period_end   * 1000),
          status:             'active',
        });
        break;
      }

      // ── Renewal payment failed ────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const sub = await UserSubscription.findOne({
          where: { stripeSubscriptionId: invoice.subscription },
        });
        if (!sub) break;

        await sub.update({ status: 'past_due' });

        await notifyUser({
          userId:  sub.userId,
          type:    NotificationType.PAYMENT_FAILURE,
          title:   'Subscription payment failed',
          body:    'We couldn\'t charge your card for your subscription renewal. Please update your payment method.',
          linkUrl: '/account/subscription',
        }).catch(() => {});
        break;
      }

      // ── Subscription updated (plan change, cancel toggle, etc.) ──────────
      case 'customer.subscription.updated': {
        const stripeSub = event.data.object;
        const sub = await UserSubscription.findOne({
          where: { stripeSubscriptionId: stripeSub.id },
        });
        if (!sub) break;

        await sub.update({
          status:             stripeSub.status,
          cancelAtPeriodEnd:  stripeSub.cancel_at_period_end,
          currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
          currentPeriodEnd:   new Date(stripeSub.current_period_end   * 1000),
        });
        break;
      }

      // ── Subscription deleted (expired or immediately cancelled) ───────────
      case 'customer.subscription.deleted': {
        const stripeSub = event.data.object;
        const sub = await UserSubscription.findOne({
          where: { stripeSubscriptionId: stripeSub.id },
          include: [{ model: SubscriptionPlan, as: 'plan' }],
        });
        if (!sub) break;

        await sub.update({ status: 'cancelled', cancelledAt: new Date() });

        await notifyUser({
          userId:  sub.userId,
          type:    NotificationType.SUBSCRIPTION,
          title:   'Subscription ended',
          body:    `Your ${sub.plan?.name ?? ''} subscription has ended. You've been moved to the free tier.`,
          linkUrl: '/account/subscription',
        }).catch(() => {});
        break;
      }

      default:
        break;
    }
  } catch (err) {
    logger.error(`Webhook handler error (${event.type}): ${err.message}`);
    // Still return 200 — Stripe retries on non-2xx
  }

  res.json({ received: true });
});

export default router;
