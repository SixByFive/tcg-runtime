/**
 * Seed subscription plans.
 * Run once after the DB is up:
 *   node scripts/seed-plans.js
 *
 * Creates Stripe Products + Prices automatically when STRIPE_SECRET_KEY is set.
 * If Stripe is not configured, records are created without Stripe IDs (useful for dev).
 *
 * Plans match what's configured in Stripe:
 *   Collector — £4.99/mo · £49.99/yr
 *   Elite Collector — £9.99/mo · £99.99/yr
 *   Vendor — £19.99/mo · £199.99/yr
 */
import 'dotenv/config';
import { Sequelize } from 'sequelize';
import defineSubscriptionPlan from '../src/models/SubscriptionPlan.js';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sequelize = new Sequelize(DB_URL, { logging: false });
const SubscriptionPlan = defineSubscriptionPlan(sequelize);

// Each paid plan has monthly + yearly variants with identical capabilities.
// feeDiscount = percentage-point reduction off the 8% base platform fee.
const PLANS = [
  {
    name: 'Free',
    description: 'Core collecting features — no payment required.',
    price: 0,
    currency: 'GBP',
    interval: 'month',
    platformFeePercent: 8,
    feeDiscount: 0,
    maxBinders: 3,
    maxCollectionCards: null,
    maxActiveListings: 5,
    maxActiveTrades: 3,
    featuresJson: [
      'Collection tracking (unlimited cards)',
      'Digital binders (up to 3)',
      'Advanced card search',
      'Wishlist',
      'Public profile & shareable binders',
      'Price tracking (regular refresh)',
      'Discord community access',
    ],
    sortOrder: 0,
  },

  // ── Collector ────────────────────────────────────────────────────────────────
  {
    name: 'Collector',
    description: 'Unlimited binders and power features for everyday collectors.',
    price: 4.99,
    currency: 'GBP',
    interval: 'month',
    platformFeePercent: 7,
    feeDiscount: 1,
    maxBinders: null,
    maxCollectionCards: null,
    maxActiveListings: 10,
    maxActiveTrades: 5,
    featuresJson: [
      'Everything in Free',
      'Digital binders (unlimited)',
      'Saved searches & filters',
      'CSV import (enhanced) & export',
      'Price change alerts (daily)',
      'Early access to new features',
      'Trading access priority',
      'Marketplace fee reduction (–1%)',
      'Priority support (Discord role)',
    ],
    sortOrder: 1,
  },
  {
    name: 'Collector',
    description: 'Unlimited binders and power features for everyday collectors.',
    price: 49.99,
    currency: 'GBP',
    interval: 'year',
    platformFeePercent: 7,
    feeDiscount: 1,
    maxBinders: null,
    maxCollectionCards: null,
    maxActiveListings: 10,
    maxActiveTrades: 5,
    featuresJson: [
      'Everything in Free',
      'Digital binders (unlimited)',
      'Saved searches & filters',
      'CSV import (enhanced) & export',
      'Price change alerts (daily)',
      'Early access to new features',
      'Trading access priority',
      'Marketplace fee reduction (–1%)',
      'Priority support (Discord role)',
    ],
    sortOrder: 1,
  },

  // ── Elite Collector ──────────────────────────────────────────────────────────
  {
    name: 'Elite Collector',
    description: 'Advanced insights for serious collectors.',
    price: 9.99,
    currency: 'GBP',
    interval: 'month',
    platformFeePercent: 6,
    feeDiscount: 2,
    maxBinders: null,
    maxCollectionCards: null,
    maxActiveListings: 25,
    maxActiveTrades: 10,
    featuresJson: [
      'Everything in Collector',
      'Historical value charts & stats',
      'Price change alerts (hourly)',
      'Custom binder themes & covers',
      'Marketplace fee reduction (–2%)',
      'Priority betas & feedback sessions',
    ],
    sortOrder: 2,
  },
  {
    name: 'Elite Collector',
    description: 'Advanced insights for serious collectors.',
    price: 99.99,
    currency: 'GBP',
    interval: 'year',
    platformFeePercent: 6,
    feeDiscount: 2,
    maxBinders: null,
    maxCollectionCards: null,
    maxActiveListings: 25,
    maxActiveTrades: 10,
    featuresJson: [
      'Everything in Collector',
      'Historical value charts & stats',
      'Price change alerts (hourly)',
      'Custom binder themes & covers',
      'Marketplace fee reduction (–2%)',
      'Priority betas & feedback sessions',
    ],
    sortOrder: 2,
  },

  // ── Vendor ───────────────────────────────────────────────────────────────────
  {
    name: 'Vendor',
    description: 'Tools for sellers and shops.',
    price: 19.99,
    currency: 'GBP',
    interval: 'month',
    platformFeePercent: 5,
    feeDiscount: 3,
    maxBinders: null,
    maxCollectionCards: null,
    maxActiveListings: null,
    maxActiveTrades: null,
    featuresJson: [
      'Seller profile & storefront',
      'Inventory tools & bulk import',
      'List-from-collection (1-click)',
      'Order management & shipping labels',
      'Seller analytics & insights',
      'Marketplace fee reduction (–3%)',
      'Priority support',
    ],
    sortOrder: 3,
  },
  {
    name: 'Vendor',
    description: 'Tools for sellers and shops.',
    price: 199.99,
    currency: 'GBP',
    interval: 'year',
    platformFeePercent: 5,
    feeDiscount: 3,
    maxBinders: null,
    maxCollectionCards: null,
    maxActiveListings: null,
    maxActiveTrades: null,
    featuresJson: [
      'Seller profile & storefront',
      'Inventory tools & bulk import',
      'List-from-collection (1-click)',
      'Order management & shipping labels',
      'Seller analytics & insights',
      'Marketplace fee reduction (–3%)',
      'Priority support',
    ],
    sortOrder: 3,
  },
];

async function getOrCreateStripeProduct(stripe, name, description) {
  const existing = await stripe.products.search({ query: `name:'${name}'`, limit: 1 });
  if (existing.data.length) return existing.data[0].id;
  const product = await stripe.products.create({ name, description: description || name });
  return product.id;
}

async function createStripePrice(stripe, productId, amountPence, interval) {
  return stripe.prices.create({
    product:    productId,
    unit_amount: amountPence,
    currency:   'gbp',
    recurring:  { interval },
  });
}

async function main() {
  await sequelize.authenticate();
  await SubscriptionPlan.sync({ alter: true });

  let stripe = null;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey) {
    stripe = new (await import('stripe')).default(stripeKey);
    console.log('Stripe configured — will create/reuse products and prices.');
  } else {
    console.log('No STRIPE_SECRET_KEY — skipping Stripe, saving DB rows only.');
  }

  // Cache product IDs per plan name so monthly + yearly share the same Stripe product
  const stripeProductIds = {};

  for (const plan of PLANS) {
    const existing = await SubscriptionPlan.findOne({
      where: { name: plan.name, interval: plan.interval },
    });

    let stripeProductId = null;
    let stripePriceId   = null;

    if (stripe && plan.price > 0) {
      try {
        if (!stripeProductIds[plan.name]) {
          stripeProductIds[plan.name] = await getOrCreateStripeProduct(
            stripe, plan.name, plan.description
          );
        }
        stripeProductId = stripeProductIds[plan.name];

        const price = await createStripePrice(
          stripe, stripeProductId, Math.round(plan.price * 100), plan.interval
        );
        stripePriceId = price.id;
        console.log(`  Stripe price created: ${plan.name} ${plan.interval} → ${price.id}`);
      } catch (err) {
        console.warn(`  Stripe error for ${plan.name} (${plan.interval}): ${err.message}`);
      }
    }

    if (existing) {
      await existing.update({
        price:              plan.price,
        platformFeePercent: plan.platformFeePercent,
        feeDiscount:        plan.feeDiscount,
        maxBinders:         plan.maxBinders,
        maxCollectionCards: plan.maxCollectionCards,
        maxActiveListings:  plan.maxActiveListings,
        maxActiveTrades:    plan.maxActiveTrades,
        featuresJson:       plan.featuresJson,
        sortOrder:          plan.sortOrder,
        description:        plan.description,
        ...(stripeProductId ? { stripeProductId } : {}),
        ...(stripePriceId   ? { stripePriceId }   : {}),
      });
      console.log(`  Updated: ${plan.name} (${plan.interval})`);
    } else {
      await SubscriptionPlan.create({
        ...plan,
        stripeProductId,
        stripePriceId,
        active: true,
      });
      console.log(`  Created: ${plan.name} (${plan.interval})${stripeProductId ? ' + Stripe' : ''}`);
    }
  }

  await sequelize.close();
  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
