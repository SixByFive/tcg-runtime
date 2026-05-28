#!/usr/bin/env node
/**
 * Marketplace test-data seeder
 *
 * Usage (from repo root):
 *   node scripts/seed-marketplace.mjs
 *
 * What it does:
 *   - Picks the first 2 users from your local `users` table
 *     → user[0] = seller,  user[1] = buyer
 *   - Wipes existing seeded rows for those users (safe to re-run)
 *   - Inserts card listings, orders, reviews, seller profile, reputation
 *
 * Covers every UI state you need to test:
 *   ✓ Active listings (marketplace browsing)
 *   ✓ Completed orders with 5★ / 4★ / 3★ / 2★ / 1★ reviews
 *   ✓ Anomaly-held reviews (status = 'pending')
 *   ✓ Disputed review (status = 'disputed' with disputeReason)
 *   ✓ Order awaiting shipment (seller ships flow)
 *   ✓ Order shipped but not received (buyer confirm flow)
 *   ✓ Seller reputation + tier badge (Gold — 30 completed, 85%+ positive)
 *   ✓ Admin review queue (pending + disputed rows)
 */

import mysql from 'mysql2/promise';
import { randomUUID } from 'crypto';

// ── DB config (mirrors env/.env.shared dev values) ───────────────────────────
const DB = {
  host:     'localhost',
  port:     3306,
  user:     'root',
  password: 'theo',
  database: 'sixbyfive_tcg',
};

// ── Card IDs / titles (realistic-looking test data) ──────────────────────────
const CARDS = [
  { cardId: 'swsh9-1',   title: 'Brilliance Charizard VMAX'        },
  { cardId: 'base1-4',   title: 'Charizard (Base Set Holo)'        },
  { cardId: 'sv1-6',     title: 'Gardevoir ex (Scarlet & Violet)'  },
  { cardId: 'swsh4-18',  title: 'Pikachu VMAX (Rainbow Rare)'      },
  { cardId: 'xy12-52',   title: 'Umbreon GX (Alt Art)'             },
  { cardId: 'sv2-215',   title: 'Miraidon ex (Special Art)'        },
  { cardId: 'swsh7-74',  title: 'Espeon VMAX'                      },
  { cardId: 'base2-10',  title: 'Blastoise (Base Set 2)'           },
  { cardId: 'sm3-12',    title: 'Solgaleo GX'                      },
  { cardId: 'xy11-65',   title: 'Mewtwo GX (Full Art)'             },
  { cardId: 'sv3-197',   title: 'Charizard ex (Obsidian Flames)'   },
  { cardId: 'swsh8-22',  title: 'Gengar VMAX'                      },
];

const CONDITIONS  = ['NM', 'LP', 'MP', 'NM', 'NM', 'LP'];
const FAKE_STRIPE = 'acct_test_seed_seller_01';

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function price(p) { return p.toFixed(4); }

// ─────────────────────────────────────────────────────────────────────────────

async function seed() {
  const db = await mysql.createConnection(DB);
  console.log('✓ Connected to', DB.database);

  // 1. Resolve seller + buyer from --seller / --buyer args (or fall back to first 2 rows) ──
  const args         = process.argv.slice(2);
  const sellerArg    = args[args.indexOf('--seller') + 1];
  const buyerArg     = args[args.indexOf('--buyer')  + 1];

  async function findUser(username, fallbackIndex) {
    if (username) {
      const [[u]] = await db.query('SELECT id, username, email FROM users WHERE username = ? LIMIT 1', [username]);
      if (!u) { console.error(`✗ User "${username}" not found`); await db.end(); process.exit(1); }
      return u;
    }
    const [rows] = await db.query('SELECT id, username, email FROM users ORDER BY createdAt ASC LIMIT ?', [fallbackIndex + 1]);
    if (rows.length <= fallbackIndex) {
      console.error('✗ Not enough users in DB. Pass --seller <username> --buyer <username>.');
      await db.end(); process.exit(1);
    }
    return rows[fallbackIndex];
  }

  const seller = await findUser(sellerArg, 0);
  const buyer  = await findUser(buyerArg,  1);
  console.log(`✓ Seller: ${seller.username} (${seller.id})`);
  console.log(`✓ Buyer:  ${buyer.username}  (${buyer.id})`);

  // 2. Clean previous seed data for these users ──────────────────────────────
  console.log('\n→ Clearing previous seed data…');
  await db.query('DELETE FROM marketplace_orders WHERE sellerId = ? OR buyerId = ?', [seller.id, buyer.id]);
  await db.query('DELETE FROM card_listings WHERE sellerId = ?', [seller.id]);
  await db.query('DELETE FROM seller_profiles WHERE userId = ?', [seller.id]);
  await db.query('DELETE FROM user_reputations WHERE userId = ?', [seller.id]);
  console.log('  Cleared.');

  // 3. Seller profile ─────────────────────────────────────────────────────────
  await db.query(`
    INSERT INTO seller_profiles
      (userId, stripeAccountId, stripeOnboardingComplete,
       returnName, returnLine1, returnCity, returnPostcode, returnCountry,
       returnPhone, returnEmail, createdAt, updatedAt)
    VALUES (?, ?, 1, ?, ?, ?, ?, 'GB', ?, ?, NOW(), NOW())
  `, [
    seller.id, FAKE_STRIPE,
    seller.username, '12 Card Street', 'London', 'EC1A 1BB',
    '+44 7700 900123', seller.email,
  ]);
  console.log('✓ Seller profile created');

  // 4. Build listings + orders ────────────────────────────────────────────────
  console.log('\n→ Creating listings and orders…');

  /**
   * Each entry: { card, price, condition, listingStatus, orderState, rating, review, reviewStatus, disputeReason }
   * orderState: null | 'awaiting' | 'shipped' | 'completed'
   */
  const rows = [
    // ── Completed orders with visible (approved) reviews ─────────────────
    {
      card: CARDS[0], listingPrice: 89.99, condition: 'NM',
      listingStatus: 'SOLD', orderState: 'completed',
      rating: 5, review: 'Absolutely brilliant seller! Card arrived in perfect condition, well packaged and super fast shipping. Would buy from again without hesitation.',
      reviewStatus: null,
    },
    {
      card: CARDS[1], listingPrice: 249.99, condition: 'LP',
      listingStatus: 'SOLD', orderState: 'completed',
      rating: 5, review: 'Exactly as described. Base Set Charizard in great condition for the grade. Secure packaging, arrived within 2 days.',
      reviewStatus: null,
    },
    {
      card: CARDS[2], listingPrice: 34.50, condition: 'NM',
      listingStatus: 'SOLD', orderState: 'completed',
      rating: 5, review: 'Lovely card, fast postage. Seller was very communicative.',
      reviewStatus: null,
    },
    {
      card: CARDS[3], listingPrice: 55.00, condition: 'NM',
      listingStatus: 'SOLD', orderState: 'completed',
      rating: 4, review: 'Good transaction overall, card was as described. Shipping took a little longer than expected but no issues.',
      reviewStatus: null,
    },
    {
      card: CARDS[4], listingPrice: 120.00, condition: 'LP',
      listingStatus: 'SOLD', orderState: 'completed',
      rating: 4, review: 'Nice card, reasonable price. Would buy again.',
      reviewStatus: null,
    },
    {
      card: CARDS[5], listingPrice: 44.99, condition: 'NM',
      listingStatus: 'SOLD', orderState: 'completed',
      rating: 5, review: 'Perfect. No complaints at all.',
      reviewStatus: null,
    },
    {
      card: CARDS[6], listingPrice: 28.00, condition: 'NM',
      listingStatus: 'SOLD', orderState: 'completed',
      rating: 3, review: 'Card is fine but packaging was minimal — just a toploader in an envelope. Lucky it arrived undamaged.',
      reviewStatus: null,
    },

    // ── Anomaly-held reviews (status = 'pending', won't count to reputation) ─
    {
      card: CARDS[7], listingPrice: 15.00, condition: 'MP',
      listingStatus: 'SOLD', orderState: 'completed',
      rating: 1, review: 'Card arrived with a crease not mentioned in the listing description. Very disappointed.',
      reviewStatus: 'pending',
    },
    {
      card: CARDS[8], listingPrice: 22.00, condition: 'NM',
      listingStatus: 'SOLD', orderState: 'completed',
      rating: 2, review: 'Took 2 weeks to ship, no communication.',
      reviewStatus: 'pending',
    },
    {
      card: CARDS[9], listingPrice: 18.50, condition: 'LP',
      listingStatus: 'SOLD', orderState: 'completed',
      rating: 1, review: 'Not as described.',
      reviewStatus: 'pending',
    },

    // ── Disputed review (seller flagged it) ───────────────────────────────
    {
      card: CARDS[10], listingPrice: 67.00, condition: 'NM',
      listingStatus: 'SOLD', orderState: 'completed',
      rating: 1, review: "Seller never sent the card. Raised a dispute but got no response.",
      reviewStatus: 'disputed',
      disputeReason: "I 100% dispatched this order — tracking number was provided. The buyer has received it. This review is fraudulent.",
    },

    // ── Active listings (for browsing / buying) ───────────────────────────
    {
      card: CARDS[11], listingPrice: 38.99, condition: 'NM',
      listingStatus: 'ACTIVE', orderState: null,
      rating: null, review: null, reviewStatus: null,
    },
    {
      card: CARDS[0],  listingPrice: 79.00, condition: 'LP',
      listingStatus: 'ACTIVE', orderState: null,
      rating: null, review: null, reviewStatus: null,
    },
    {
      card: CARDS[2],  listingPrice: 29.99, condition: 'NM',
      listingStatus: 'ACTIVE', orderState: null,
      rating: null, review: null, reviewStatus: null,
    },

    // ── Order awaiting shipment ────────────────────────────────────────────
    {
      card: CARDS[5], listingPrice: 19.99, condition: 'NM',
      listingStatus: 'SOLD', orderState: 'awaiting',
      rating: null, review: null, reviewStatus: null,
    },

    // ── Order shipped, awaiting buyer confirmation ─────────────────────────
    {
      card: CARDS[6], listingPrice: 31.00, condition: 'LP',
      listingStatus: 'SOLD', orderState: 'shipped',
      rating: null, review: null, reviewStatus: null,
    },
  ];

  const listingIds = [];
  const orderIds   = [];

  for (let i = 0; i < rows.length; i++) {
    const r    = rows[i];
    const lid  = randomUUID();
    const oid  = r.orderState ? randomUUID() : null;
    const createdDaysAgo = rows.length - i + 1;

    listingIds.push(lid);

    // ── Card listing ──────────────────────────────────────────────────────
    await db.query(`
      INSERT INTO card_listings
        (id, sellerId, cardId, title, \`condition\`, price, currency, quantity,
         status, moderationResult, shippingType, shippingPrice, parcelSize,
         allowOffers, sellerStripeAccountId,
         rating, review, reviewStatus, disputeReason, soldAt,
         createdAt, updatedAt)
      VALUES
        (?, ?, ?, ?, ?, ?, 'GBP', 1,
         ?, 'approved', 'FIXED', 2.95, 'LARGE_LETTER',
         1, ?,
         ?, ?, ?, ?, ?,
         ?, ?)
    `, [
      lid, seller.id, r.card.cardId, r.card.title, r.condition,
      price(r.listingPrice),
      r.listingStatus,
      FAKE_STRIPE,
      r.rating, r.review, r.reviewStatus ?? null, r.disputeReason ?? null,
      r.orderState ? daysAgo(createdDaysAgo - 1) : null,
      daysAgo(createdDaysAgo + 7),
      daysAgo(createdDaysAgo),
    ]);

    if (!oid) continue;

    // ── Order ─────────────────────────────────────────────────────────────
    orderIds.push(oid);
    const salePrice    = r.listingPrice;
    const shipping     = 2.95;
    const platformFee  = parseFloat((salePrice * 0.05).toFixed(4));
    const totalAmount  = parseFloat((salePrice + shipping).toFixed(4));

    const paymentStatus    = 'captured';
    const fulfilmentStatus =
      r.orderState === 'completed' ? 'completed' :
      r.orderState === 'shipped'   ? 'shipped'   :
      'awaiting_shipment';

    const completedAt = r.orderState === 'completed' ? daysAgo(createdDaysAgo - 2) : null;
    const shippedAt   = r.orderState === 'completed' || r.orderState === 'shipped'
      ? daysAgo(createdDaysAgo - 1) : null;

    await db.query(`
      INSERT INTO marketplace_orders
        (id, listingId, buyerId, sellerId, cardId,
         salePrice, platformFee, shippingCost, totalAmount, currency,
         paymentStatus, fulfilmentStatus,
         stripePaymentIntentId,
         buyerAddressJson, sellerAddressJson,
         authorisedAt, capturedAt, shippedAt, completedAt,
         createdAt, updatedAt)
      VALUES
        (?, ?, ?, ?, ?,
         ?, ?, ?, ?, 'GBP',
         ?, ?,
         ?,
         ?, ?,
         ?, ?, ?, ?,
         ?, ?)
    `, [
      oid, lid, buyer.id, seller.id, r.card.cardId,
      price(salePrice), price(platformFee), price(shipping), price(totalAmount),
      paymentStatus, fulfilmentStatus,
      `pi_test_seed_${oid.slice(0, 8)}`,
      JSON.stringify({ name: buyer.username, line1: '45 Buyer Lane', city: 'Manchester', postcode: 'M1 1AA', country: 'GB' }),
      JSON.stringify({ name: seller.username, line1: '12 Card Street', city: 'London', postcode: 'EC1A 1BB', country: 'GB' }),
      daysAgo(createdDaysAgo + 7),
      daysAgo(createdDaysAgo + 6),
      shippedAt,
      completedAt,
      daysAgo(createdDaysAgo + 7),
      daysAgo(createdDaysAgo),
    ]);
  }

  console.log(`  ✓ ${listingIds.length} listings, ${orderIds.length} orders`);

  // 5. Seller reputation ──────────────────────────────────────────────────────
  // Approved reviews only (reviewStatus IS NULL):
  const approvedRows = rows.filter(r => r.rating != null && r.reviewStatus == null);
  const positive  = approvedRows.filter(r => r.rating >= 4).length;
  const neutral   = approvedRows.filter(r => r.rating === 3).length;
  const negative  = approvedRows.filter(r => r.rating <= 2).length;
  // Manually bump completedMarketplace to 30 so we land in Gold tier display
  const completed = 30;
  const score     = positive * 10 - negative * 10 + neutral * 2;

  await db.query(`
    INSERT INTO user_reputations
      (id, userId, score, positive, negative, neutral, completedTrades, completedMarketplace, flagged)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0)
    ON DUPLICATE KEY UPDATE
      score = VALUES(score),
      positive = VALUES(positive),
      negative = VALUES(negative),
      neutral = VALUES(neutral),
      completedMarketplace = VALUES(completedMarketplace)
  `, [randomUUID(), seller.id, score, positive, negative, neutral, completed]);

  console.log(`✓ Reputation: ${positive} positive, ${neutral} neutral, ${negative} negative | completedMarketplace=30 (Gold tier)`);

  // 6. Summary ────────────────────────────────────────────────────────────────
  const pendingCount  = rows.filter(r => r.reviewStatus === 'pending').length;
  const disputedCount = rows.filter(r => r.reviewStatus === 'disputed').length;
  const activeCount   = rows.filter(r => r.listingStatus === 'ACTIVE').length;

  console.log('\n─────────────────────────────────────────────');
  console.log('Seed complete! Summary:');
  console.log(`  Active listings:       ${activeCount}  (browsable in marketplace)`);
  console.log(`  Completed orders:      ${rows.filter(r => r.orderState === 'completed').length}  (visible in orders tab)`);
  console.log(`  Awaiting shipment:     ${rows.filter(r => r.orderState === 'awaiting').length}  (seller ships flow)`);
  console.log(`  Shipped (unconfirmed): ${rows.filter(r => r.orderState === 'shipped').length}  (buyer confirm flow)`);
  console.log(`  Pending reviews:       ${pendingCount}  → Admin › Review Queue › Anomaly holds`);
  console.log(`  Disputed reviews:      ${disputedCount}  → Admin › Review Queue › Disputed`);
  console.log(`  Seller tier:           Gold (30 sales, ${Math.round(positive/(positive+neutral+negative||1)*100)}% positive)`);
  console.log('─────────────────────────────────────────────');
  console.log(`\nLog in as:  ${seller.username}  to see seller views`);
  console.log(`Log in as:  ${buyer.username}   to see buyer/orders views`);

  await db.end();
}

seed().catch(err => {
  console.error('✗ Seed failed:', err.message);
  process.exit(1);
});
