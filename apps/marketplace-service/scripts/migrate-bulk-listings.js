/**
 * Add bulk-listing support to card_listings + create card_listing_items.
 * Safe to re-run — each step checks state first.
 *
 * Usage (from repo root):
 *   node --env-file=env/.env.shared apps/marketplace-service/scripts/migrate-bulk-listings.js
 */

import mysql2 from 'mysql2/promise';

const DB = {
  host:     process.env.DB_HOST || 'localhost',
  port:     Number(process.env.DB_PORT || 3306),
  user:     process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'sixbyfive_tcg',
  multipleStatements: true,
};

async function columnExists(conn, table, column) {
  const [[{ n }]] = await conn.query(
    `SELECT COUNT(*) AS n FROM information_schema.columns
     WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
    [DB.database, table, column],
  );
  return n > 0;
}

async function tableExists(conn, name) {
  const [[{ n }]] = await conn.query(
    `SELECT COUNT(*) AS n FROM information_schema.tables
     WHERE table_schema = ? AND table_name = ?`,
    [DB.database, name],
  );
  return n > 0;
}

async function indexExists(conn, table, indexName) {
  const [[{ n }]] = await conn.query(
    `SELECT COUNT(*) AS n FROM information_schema.statistics
     WHERE table_schema = ? AND table_name = ? AND index_name = ?`,
    [DB.database, table, indexName],
  );
  return n > 0;
}

function log(m)  { console.log(`[migrate] ${m}`); }
function skip(m) { console.log(`[migrate] SKIP  ${m}`); }
function ok(m)   { console.log(`[migrate] OK    ${m}`); }

async function addColumnIfMissing(conn, table, column, ddl) {
  if (await columnExists(conn, table, column)) { skip(`${table}.${column} (exists)`); return; }
  await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
  ok(`${table}.${column} added`);
}

async function main() {
  const conn = await mysql2.createConnection(DB);
  try {
    const CONDITION_ENUM = `ENUM('M','NM','LP','MP','HP','DMG')`;

    if (!(await tableExists(conn, 'card_listings'))) {
      skip('card_listings table not found — run service once to create it, then re-run this migration');
      return;
    }

    // 1. Make existing single-card columns nullable
    //    Random-bulk lots have no cardId; both bulk kinds use conditionMin/Max instead of condition.
    await conn.query(`ALTER TABLE card_listings MODIFY COLUMN cardId VARCHAR(80) NULL`);
    await conn.query(`ALTER TABLE card_listings MODIFY COLUMN \`condition\` ${CONDITION_ENUM} NULL`);
    ok('card_listings.cardId + condition now nullable');

    // 2. Bulk-specific columns
    await addColumnIfMissing(conn, 'card_listings', 'listingKind',
      `listingKind ENUM('SINGLE','BULK_TRACKED','BULK_RANDOM') NOT NULL DEFAULT 'SINGLE'`);
    await addColumnIfMissing(conn, 'card_listings', 'conditionMin',
      `conditionMin ${CONDITION_ENUM} NULL`);
    await addColumnIfMissing(conn, 'card_listings', 'conditionMax',
      `conditionMax ${CONDITION_ENUM} NULL`);
    await addColumnIfMissing(conn, 'card_listings', 'cardCount',
      `cardCount INT NULL`);
    await addColumnIfMissing(conn, 'card_listings', 'guaranteedInclusionsJson',
      `guaranteedInclusionsJson JSON NULL`);
    await addColumnIfMissing(conn, 'card_listings', 'lotPhotoPath',
      `lotPhotoPath VARCHAR(255) NULL`);
    await addColumnIfMissing(conn, 'card_listings', 'isReturnable',
      `isReturnable BOOLEAN NOT NULL DEFAULT TRUE`);

    // 3. Index on listingKind for the Bulk tab query
    if (!(await indexExists(conn, 'card_listings', 'card_listings_listingkind'))) {
      await conn.query(`CREATE INDEX card_listings_listingkind ON card_listings(listingKind)`);
      ok('card_listings(listingKind) indexed');
    } else {
      skip('card_listings(listingKind) index exists');
    }

    // 4. card_listing_items (BULK_TRACKED only)
    //
    // No DB-level FK on listingId — project convention is app-level enforcement
    // via Sequelize associations (CardListing.hasMany with onDelete: 'CASCADE').
    // Mirrors how Order.listingId / Offer.listingId are declared.
    if (!(await tableExists(conn, 'card_listing_items'))) {
      await conn.query(`
        CREATE TABLE card_listing_items (
          id          CHAR(36)     NOT NULL,
          listingId   CHAR(36)     NOT NULL,
          cardId      VARCHAR(80)  NOT NULL,
          variant     VARCHAR(80)  NULL,
          \`condition\` ${CONDITION_ENUM} NULL,
          quantity    INT          NOT NULL DEFAULT 1,
          createdAt   DATETIME     NOT NULL,
          updatedAt   DATETIME     NOT NULL,
          PRIMARY KEY (id),
          INDEX card_listing_items_listingid (listingId),
          INDEX card_listing_items_cardid    (cardId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      ok('card_listing_items created');
    } else {
      skip('card_listing_items (exists)');
    }

    // ── 5. marketplace_orders.cardId → nullable + itemsJson snapshot ──
    //
    // Bulk-tracked orders have no single cardId; the per-item snapshot is
    // stored as JSON (same convention as buyerAddressJson, imagesJson, etc.).
    if (await tableExists(conn, 'marketplace_orders')) {
      await conn.query(`ALTER TABLE marketplace_orders MODIFY COLUMN cardId VARCHAR(80) NULL`);
      ok('marketplace_orders.cardId now nullable');
      await addColumnIfMissing(conn, 'marketplace_orders', 'itemsJson',
        `itemsJson JSON NULL`);
    } else {
      skip('marketplace_orders (not found — run service once to create it)');
    }

    log('done');
  } finally {
    await conn.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
