import Stripe from 'stripe';
import { createLogger } from '@sbf/logger';

const logger = createLogger('marketplace-service:stripe');

const FEE_PCT = Number(process.env.PLATFORM_FEE_PCT ?? 5) / 100;

let _stripe;
function getStripe() {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set');
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });
  }
  return _stripe;
}

/** Calculate platform fee in pence. */
export function calculateFee(amountPence) {
  return Math.round(amountPence * FEE_PCT);
}

// ─── Stripe Connect ───────────────────────────────────────────────────────────

/**
 * Initiate Stripe Connect Express onboarding for a seller.
 * Returns { accountId, url } — store accountId, redirect seller to url.
 */
export async function createConnectOnboardingUrl(userId) {
  const s = getStripe();
  const account = await s.accounts.create({
    type: 'express',
    country: 'GB',
    capabilities: { transfers: { requested: true } },
    metadata: { userId },
  });
  const link = await s.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.APP_URL}/seller/connect/refresh`,
    return_url:  `${process.env.APP_URL}/seller/connect/complete`,
    type: 'account_onboarding',
  });
  return { accountId: account.id, url: link.url };
}

/** Generate a fresh onboarding link for an existing account (e.g. after session expiry). */
export async function createConnectRefreshUrl(stripeAccountId) {
  const s = getStripe();
  const link = await s.accountLinks.create({
    account:     stripeAccountId,
    refresh_url: `${process.env.APP_URL}/seller/connect/refresh`,
    return_url:  `${process.env.APP_URL}/seller/connect/complete`,
    type: 'account_onboarding',
  });
  return link.url;
}

/** Check if a Stripe Connect account is fully onboarded (charges_enabled). */
export async function getAccountStatus(stripeAccountId) {
  const account = await getStripe().accounts.retrieve(stripeAccountId);
  return {
    complete:          account.charges_enabled,
    detailsSubmitted:  account.details_submitted,
    payoutsEnabled:    account.payouts_enabled,
  };
}

// ─── Escrow payments ──────────────────────────────────────────────────────────

/**
 * Create a manual-capture PaymentIntent (escrow).
 *
 * The buyer's card is authorised but NOT charged until capturePaymentIntent() is called.
 * Stripe authorisations expire after 7 days — worker-service sends a day-5 warning.
 *
 * @returns {Stripe.PaymentIntent}
 */
export async function createEscrowPaymentIntent({
  amountPence,
  currency = 'gbp',
  sellerStripeAccountId,
  orderId,
  platformFeePence,   // Pass the pre-calculated fee; falls back to calculateFee if omitted
  metadata = {},
}) {
  const s   = getStripe();
  const fee = platformFeePence ?? calculateFee(amountPence);

  const params = {
    amount:         amountPence,
    currency,
    capture_method: 'manual',
    metadata: { orderId, ...metadata },
  };

  if (sellerStripeAccountId) {
    params.application_fee_amount = fee;
    params.transfer_data = { destination: sellerStripeAccountId };
  }

  return s.paymentIntents.create(params);
}

/**
 * Capture an authorised PaymentIntent — funds move from buyer to seller.
 * Call this when the buyer confirms receipt.
 */
export async function capturePaymentIntent(paymentIntentId) {
  return getStripe().paymentIntents.capture(paymentIntentId);
}

/**
 * Cancel an authorised PaymentIntent — buyer is never charged.
 * Use for disputes raised before capture, or cancellations.
 */
export async function cancelPaymentIntent(paymentIntentId) {
  return getStripe().paymentIntents.cancel(paymentIntentId);
}

/**
 * Refund a captured PaymentIntent (dispute after capture).
 * @param {string}  paymentIntentId
 * @param {number=} amountPence  If omitted, full refund.
 */
export async function refundPaymentIntent(paymentIntentId, amountPence) {
  const params = { payment_intent: paymentIntentId };
  if (amountPence) params.amount = amountPence;
  return getStripe().refunds.create(params);
}

/** Verify and construct a Stripe webhook event from raw body + signature. */
export function constructWebhookEvent(rawBody, sig) {
  return getStripe().webhooks.constructEvent(
    rawBody,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET,
  );
}
