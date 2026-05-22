import Stripe from 'stripe';

let _stripe;
export function getStripe() {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set');
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });
  }
  return _stripe;
}

// ─── Customers ────────────────────────────────────────────────────────────────

export async function getOrCreateCustomer(userId, email) {
  const s = getStripe();
  // Search for an existing customer by metadata
  const existing = await s.customers.search({
    query: `metadata['userId']:'${userId}'`,
    limit: 1,
  });
  if (existing.data.length) return existing.data[0];
  return s.customers.create({ email, metadata: { userId } });
}

// ─── Subscription checkout ────────────────────────────────────────────────────

/**
 * Create a Stripe Checkout session for a subscription.
 * Returns the hosted checkout URL — redirect the user to this.
 */
export async function createSubscriptionCheckout({ customerId, stripePriceId, userId, planId }) {
  return getStripe().checkout.sessions.create({
    customer:   customerId,
    mode:       'subscription',
    line_items: [{ price: stripePriceId, quantity: 1 }],
    success_url: `${process.env.APP_URL}/subscriptions?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${process.env.APP_URL}/subscriptions?cancelled=true`,
    metadata:    { userId, planId },
    subscription_data: {
      metadata: { userId, planId },
    },
  });
}

/**
 * Open the Stripe Customer Portal — lets users manage their subscription,
 * update payment method, download invoices, and cancel.
 */
export async function createPortalSession(customerId) {
  return getStripe().billingPortal.sessions.create({
    customer:   customerId,
    return_url: `${process.env.APP_URL}/account/subscription`,
  });
}

/**
 * Cancel a subscription at the end of the current billing period.
 */
export async function cancelSubscription(stripeSubscriptionId) {
  return getStripe().subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: true,
  });
}

/**
 * Reactivate a subscription that was set to cancel at period end.
 */
export async function resumeSubscription(stripeSubscriptionId) {
  return getStripe().subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: false,
  });
}

// ─── Product checkout ─────────────────────────────────────────────────────────

/**
 * Create a one-off Stripe Checkout session for product purchase.
 *
 * @param {object[]} lineItems  Array of { name, amount (pence), quantity }
 */
export async function createProductCheckout({ customerId, lineItems, userId, description }) {
  const s = getStripe();
  return s.checkout.sessions.create({
    customer:   customerId || undefined,
    mode:       'payment',
    line_items: lineItems.map(({ name, amount, quantity = 1 }) => ({
      quantity,
      price_data: {
        currency:     'gbp',
        unit_amount:  amount,
        product_data: { name },
      },
    })),
    payment_intent_data: {
      description,
      metadata: { userId },
    },
    success_url: `${process.env.APP_URL}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${process.env.APP_URL}/shop`,
    metadata:    { userId },
  });
}

// ─── Stripe Products & Prices (for plan management) ──────────────────────────

export async function createStripeProduct(name, description) {
  return getStripe().products.create({ name, description });
}

export async function createStripePrice({ productId, unitAmount, currency = 'gbp', interval = 'month' }) {
  return getStripe().prices.create({
    product:     productId,
    unit_amount: unitAmount,
    currency,
    recurring:   { interval },
  });
}

export async function archiveStripePrice(priceId) {
  return getStripe().prices.update(priceId, { active: false });
}

// ─── Wallet top-up (PaymentIntent — custom Elements UI) ──────────────────────

/**
 * Creates a Stripe PaymentIntent for a wallet top-up.
 * Returns the PaymentIntent object; caller extracts client_secret for the frontend.
 * The webhook (payment_intent.succeeded) is responsible for crediting the wallet.
 */
export async function createWalletTopupIntent({ customerId, amountPence, userId }) {
  return getStripe().paymentIntents.create({
    amount:   amountPence,
    currency: 'gbp',
    customer: customerId || undefined,
    // Save the payment method for future use (card on file)
    setup_future_usage: 'on_session',
    metadata: { userId, type: 'wallet_topup' },
    automatic_payment_methods: { enabled: true },
  });
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────

export function constructWebhookEvent(rawBody, sig) {
  return getStripe().webhooks.constructEvent(
    rawBody,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET,
  );
}

// ─── Refunds ──────────────────────────────────────────────────────────────────

export async function refundPaymentIntent(paymentIntentId, amountPence) {
  const params = { payment_intent: paymentIntentId };
  if (amountPence) params.amount = amountPence;
  return getStripe().refunds.create(params);
}
