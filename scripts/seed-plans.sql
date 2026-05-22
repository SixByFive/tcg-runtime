-- Seed subscription plans
-- Run once on the server after first deploy:
--   mysql -u sixbyfiv_tcgstand -p'...' sixbyfiv_tcgstand < scripts/seed-plans.sql
--
-- After running, update Stripe IDs for each row:
--   UPDATE subscription_plans SET stripeProductId='prod_xxx', stripePriceId='price_xxx'
--   WHERE name='Collector' AND `interval`='month';
--
-- Free plan has no Stripe product — implicit fallback when user has no subscription.

SET NAMES utf8mb4;

INSERT INTO subscription_plans
  (id, name, description, price, currency, `interval`,
   stripeProductId, stripePriceId,
   feeDiscount, platformFeePercent,
   maxBinders, maxCollectionCards, maxActiveListings, maxActiveTrades,
   featuresJson, active, sortOrder,
   createdAt, updatedAt)
VALUES

-- Free ─────────────────────────────────────────────────────────────────────────
(
  UUID(), 'Free', 'Core collecting features — no payment required.',
  0.00, 'GBP', 'month',
  NULL, NULL,
  0, 8.00,
  3, NULL, 5, 3,
  '["Collection tracking (unlimited cards)","Digital binders (up to 3)","Advanced card search","Wishlist","Public profile & shareable binders","Price tracking (regular refresh)","Discord community access"]',
  TRUE, 0,
  NOW(), NOW()
),

-- Collector — monthly ──────────────────────────────────────────────────────────
(
  UUID(), 'Collector', 'Unlimited binders and power features for everyday collectors.',
  4.99, 'GBP', 'month',
  NULL, NULL,
  1, 7.00,
  NULL, NULL, 10, 5,
  '["Everything in Free","Digital binders (unlimited)","Saved searches & filters","CSV import (enhanced) & export","Price change alerts (daily)","Early access to new features","Trading access priority","Marketplace fee reduction (–1%)","Priority support (Discord role)"]',
  TRUE, 1,
  NOW(), NOW()
),

-- Collector — yearly ───────────────────────────────────────────────────────────
(
  UUID(), 'Collector', 'Unlimited binders and power features for everyday collectors.',
  49.99, 'GBP', 'year',
  NULL, NULL,
  1, 7.00,
  NULL, NULL, 10, 5,
  '["Everything in Free","Digital binders (unlimited)","Saved searches & filters","CSV import (enhanced) & export","Price change alerts (daily)","Early access to new features","Trading access priority","Marketplace fee reduction (–1%)","Priority support (Discord role)"]',
  TRUE, 1,
  NOW(), NOW()
),

-- Elite Collector — monthly ────────────────────────────────────────────────────
(
  UUID(), 'Elite Collector', 'Advanced insights for serious collectors.',
  9.99, 'GBP', 'month',
  NULL, NULL,
  2, 6.00,
  NULL, NULL, 25, 10,
  '["Everything in Collector","Historical value charts & stats","Price change alerts (hourly)","Custom binder themes & covers","Marketplace fee reduction (–2%)","Priority betas & feedback sessions"]',
  TRUE, 2,
  NOW(), NOW()
),

-- Elite Collector — yearly ─────────────────────────────────────────────────────
(
  UUID(), 'Elite Collector', 'Advanced insights for serious collectors.',
  99.99, 'GBP', 'year',
  NULL, NULL,
  2, 6.00,
  NULL, NULL, 25, 10,
  '["Everything in Collector","Historical value charts & stats","Price change alerts (hourly)","Custom binder themes & covers","Marketplace fee reduction (–2%)","Priority betas & feedback sessions"]',
  TRUE, 2,
  NOW(), NOW()
),

-- Vendor — monthly ─────────────────────────────────────────────────────────────
(
  UUID(), 'Vendor', 'Tools for sellers and shops.',
  19.99, 'GBP', 'month',
  NULL, NULL,
  3, 5.00,
  NULL, NULL, NULL, NULL,
  '["Seller profile & storefront","Inventory tools & bulk import","List-from-collection (1-click)","Order management & shipping labels","Seller analytics & insights","Marketplace fee reduction (–3%)","Priority support"]',
  TRUE, 3,
  NOW(), NOW()
),

-- Vendor — yearly ──────────────────────────────────────────────────────────────
(
  UUID(), 'Vendor', 'Tools for sellers and shops.',
  199.99, 'GBP', 'year',
  NULL, NULL,
  3, 5.00,
  NULL, NULL, NULL, NULL,
  '["Seller profile & storefront","Inventory tools & bulk import","List-from-collection (1-click)","Order management & shipping labels","Seller analytics & insights","Marketplace fee reduction (–3%)","Priority support"]',
  TRUE, 3,
  NOW(), NOW()
)

ON DUPLICATE KEY UPDATE updatedAt = updatedAt; -- no-op if somehow already run
