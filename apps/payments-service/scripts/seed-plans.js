/**
 * Seed subscription plans.
 * Run once after the DB is up:
 *   node scripts/seed-plans.js
 *
 * Creates Stripe Products + Prices automatically when STRIPE_SECRET_KEY is set.
 * If Stripe is not configured, records are created without Stripe IDs (useful for dev).
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

const PLANS = [
  {
    name: 'Free',
    description: 'Get started with the basics.',
    price: 0,
    currency: 'GBP',
    interval: 'month',
    platformFeePercent: 8,
    feeDiscount: 0,
    maxBinders: 3,
    maxCollectionCards: 500,
    maxActiveListings: 5,
    maxActiveTrades: 3,
    featuresJson: [
      '3 binders',
      '500 collection cards',
      '5 active listings',
      '3 active trades',
      '8% marketplace fee',
    ],
    sortOrder: 0,
  },
  {
    name: 'Collector',
    description: 'Perfect for serious collectors who want more room to grow.',
    price: 4.99,
    currency: 'GBP',
    interval: 'month',
    platformFeePercent: 7,
    feeDiscount: 13,
    maxBinders: 15,
    maxCollectionCards: null,
    maxActiveListings: 25,
    maxActiveTrades: 15,
    featuresJson: [
      '15 binders',
      'Unlimited collection cards',
      '25 active listings',
      '15 active trades',
      '7% marketplace fee',
      'Price alerts',
      'Value export',
    ],
    sortOrder: 1,
  },
  {
    name: 'Pro',
    description: 'For power users and active traders who need no limits.',
    price: 9.99,
    currency: 'GBP',
    interval: 'month',
    platformFeePercent: 5,
    feeDiscount: 38,
    maxBinders: null,
    maxCollectionCards: null,
    maxActiveListings: 50,
    maxActiveTrades: null,
    featuresJson: [
      'Unlimited binders',
      'Unlimited collection cards',
      '50 active listings',
      'Unlimited trades',
      '5% marketplace fee',
      'Bulk tools',
      'Analytics',
    ],
    sortOrder: 2,
  },
  {
    name: 'Vendor',
    description: 'Built for professional sellers. Maximum exposure, minimum fees.',
    price: 24.99,
    currency: 'GBP',
    interval: 'month',
    platformFeePercent: 2,
    feeDiscount: 75,
    maxBinders: null,
    maxCollectionCards: null,
    maxActiveListings: null,
    maxActiveTrades: null,
    featuresJson: [
      'Everything in Pro',
      'Unlimited listings',
      '2% marketplace fee',
      'Priority support',
      'Verified seller badge',
      'Early access to new features',
    ],
    sortOrder: 3,
  },
];

async function createStripeProductAndPrice(name, description, priceGbp, interval) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey || priceGbp === 0) return { productId: null, priceId: null };

  try {
    const stripe = (await import('stripe')).default(stripeKey);

    const product = await stripe.products.create({ name, description: description || name });

    if (priceGbp === 0) return { productId: product.id, priceId: null };

    const price = await stripe.prices.create({
      product:    product.id,
      unit_amount: Math.round(priceGbp * 100),
      currency:   'gbp',
      recurring:  { interval },
    });

    return { productId: product.id, priceId: price.id };
  } catch (err) {
    console.warn(`  Stripe error for ${name}: ${err.message} — skipping Stripe IDs`);
    return { productId: null, priceId: null };
  }
}

async function main() {
  await sequelize.authenticate();
  await SubscriptionPlan.sync({ alter: true });

  for (const plan of PLANS) {
    const existing = await SubscriptionPlan.findOne({ where: { name: plan.name } });

    if (existing) {
      await existing.update({
        platformFeePercent: plan.platformFeePercent,
        feeDiscount:        plan.feeDiscount,
        maxBinders:         plan.maxBinders,
        maxCollectionCards: plan.maxCollectionCards,
        maxActiveListings:  plan.maxActiveListings,
        maxActiveTrades:    plan.maxActiveTrades,
        featuresJson:       plan.featuresJson,
        sortOrder:          plan.sortOrder,
        description:        plan.description,
      });
      console.log(`  Updated: ${plan.name}`);
      continue;
    }

    const { productId, priceId } = await createStripeProductAndPrice(
      plan.name, plan.description, plan.price, plan.interval,
    );

    await SubscriptionPlan.create({
      ...plan,
      stripeProductId: productId,
      stripePriceId:   priceId,
      active: true,
    });

    console.log(`  Created: ${plan.name}${productId ? ' (+ Stripe)' : ''}`);
  }

  await sequelize.close();
  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
