/**
 * Catalog table migration: old monolith schema → new catalog-service schema.
 *
 * Safe to re-run at any point — each step checks its own state before acting.
 *
 * Usage (from repo root):
 *   node --env-file=env/.env.shared apps/catalog-service/scripts/migrate-catalog-tables.js
 */

import mysql2 from 'mysql2/promise';

const DB = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT || 3306),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASS     || '',
  database: process.env.DB_NAME     || 'sixbyfive_tcg',
  multipleStatements: true,
};

async function tableExists(conn, name) {
  const [[{ n }]] = await conn.query(
    `SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ? AND table_name = ?`,
    [DB.database, name],
  );
  return n > 0;
}

async function columnExists(conn, table, column) {
  const [[{ n }]] = await conn.query(
    `SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
    [DB.database, table, column],
  );
  return n > 0;
}

async function rowCount(conn, table) {
  const [[{ n }]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${table}\``);
  return n;
}

function log(msg)  { console.log(`[migrate] ${msg}`); }
function skip(msg) { console.log(`[migrate] SKIP  ${msg}`); }
function ok(msg)   { console.log(`[migrate] OK    ${msg}`); }

/**
 * Generic migration step:
 *  1. Rename source table to BAK (if not already done)
 *  2. Create new table (if not already done)
 *  3. Run INSERT (if new table is empty)
 */
async function migrateTable(conn, { src, bak, createSql, insertFn, label }) {
  const bakExists = await tableExists(conn, bak);
  const srcExists = await tableExists(conn, src);
  const newExists = await tableExists(conn, src); // after migration 'src' name is reused for new table

  // Step 1: ensure backup
  if (!bakExists) {
    if (!srcExists) { skip(`${label} (source table not found)`); return; }
    log(`${label} — backing up to ${bak} …`);
    await conn.query(`RENAME TABLE \`${src}\` TO \`${bak}\``);
  }

  // Step 2: create new table if missing
  if (!await tableExists(conn, src)) {
    log(`${label} — creating new table …`);
    await conn.query(createSql);
  }

  // Step 3: insert if empty
  const existing = await rowCount(conn, src);
  if (existing > 0) {
    skip(`${label} (new table already has ${existing} rows)`);
    return;
  }

  log(`${label} — inserting data …`);
  await insertFn(conn, bak);
  const n = await rowCount(conn, src);
  ok(`${label} — ${n} rows migrated`);
}

// ---------------------------------------------------------------------------

async function migrateSets(conn) {
  await migrateTable(conn, {
    src:  'm_sets',
    bak:  '_bak_m_sets',
    label: 'm_sets',
    createSql: `
      CREATE TABLE m_sets (
        code              VARCHAR(32)  NOT NULL PRIMARY KEY,
        name              VARCHAR(200),
        era               VARCHAR(100),
        release_date      DATE,
        abbreviation      VARCHAR(32),
        official_count    INT,
        total_cards       INT,
        set_logo          TEXT,
        set_symbol        TEXT,
        source_at         DATETIME,
        generator_version VARCHAR(64),
        enabled           TINYINT(1) NOT NULL DEFAULT 1,
        updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_abbreviation (abbreviation)
      )`,
    insertFn: async (conn, bak) => {
      const eraCol     = await columnExists(conn, bak, 'series')     ? 'series'     : 'era';
      const relDateCol = await columnExists(conn, bak, 'releasedAt') ? 'releasedAt' : 'release_date';
      const abbrCol    = await columnExists(conn, bak, 'abbr')       ? 'abbr'       : 'abbreviation';
      const totalCol   = await columnExists(conn, bak, 'total')      ? 'total'      : 'total_cards';
      const hasOff     = await columnExists(conn, bak, 'official_count');
      const hasLogo    = await columnExists(conn, bak, 'set_logo');
      const hasSymbol  = await columnExists(conn, bak, 'set_symbol');
      const hasGenVer  = await columnExists(conn, bak, 'generator_version');

      await conn.query(`
        INSERT INTO m_sets (code, name, era, release_date, abbreviation,
                            official_count, total_cards, set_logo, set_symbol,
                            generator_version, updated_at)
        SELECT code, name, ${eraCol}, ${relDateCol}, ${abbrCol},
               ${hasOff    ? 'official_count'    : 'NULL'},
               ${totalCol},
               ${hasLogo   ? 'set_logo'          : 'NULL'},
               ${hasSymbol ? 'set_symbol'        : 'NULL'},
               ${hasGenVer ? 'generator_version' : 'NULL'},
               NOW()
        FROM \`${bak}\`
      `);
    },
  });
}

// ---------------------------------------------------------------------------

async function migrateCards(conn) {
  await migrateTable(conn, {
    src:  'm_cards',
    bak:  '_bak_m_cards',
    label: 'm_cards',
    createSql: `
      CREATE TABLE m_cards (
        id               VARCHAR(80)  NOT NULL PRIMARY KEY,
        set_code         VARCHAR(32),
        number           VARCHAR(16),
        name             VARCHAR(200),
        rarity           VARCHAR(80),
        image_small      TEXT,
        image_large      TEXT,
        supertype        VARCHAR(40),
        subtype          VARCHAR(80),
        image_url_remote TEXT,
        regulation_mark  VARCHAR(8),
        legality_std     TINYINT,
        legality_exp     TINYINT,
        legality_unl     TINYINT,
        updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_set_code (set_code),
        INDEX idx_number   (number),
        INDEX idx_name     (name)
      )`,
    insertFn: async (conn, bak) => {
      const pkCol         = await columnExists(conn, bak, 'cardId')       ? 'cardId'       : 'id';
      const regMarkExpr   = await columnExists(conn, bak, 'regulationMark') ? 'regulationMark' : 'regulation_mark';
      const hasImagesJson = await columnExists(conn, bak, 'images');
      const hasSmall      = await columnExists(conn, bak, 'image_small');
      const hasLarge      = await columnExists(conn, bak, 'image_large');

      const smallExpr = hasImagesJson
        ? `JSON_UNQUOTE(JSON_EXTRACT(images, '$.small'))`
        : hasSmall ? 'image_small' : 'NULL';
      const largeExpr = hasImagesJson
        ? `JSON_UNQUOTE(JSON_EXTRACT(images, '$.large'))`
        : hasLarge ? 'image_large' : 'NULL';

      await conn.query(`
        INSERT INTO m_cards (id, set_code, number, name, rarity,
                             supertype, subtype, regulation_mark,
                             image_small, image_large, updated_at)
        SELECT ${pkCol}, set_code, number, name, rarity,
               supertype, subtype, ${regMarkExpr},
               ${smallExpr}, ${largeExpr}, NOW()
        FROM \`${bak}\`
      `);
    },
  });
}

// ---------------------------------------------------------------------------

async function migrateCardVariants(conn) {
  await migrateTable(conn, {
    src:  'm_card_variants',
    bak:  '_bak_m_card_variants',
    label: 'm_card_variants',
    createSql: `
      CREATE TABLE m_card_variants (
        id           INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        card_id      VARCHAR(80),
        variant      VARCHAR(40),
        display_name VARCHAR(80),
        UNIQUE KEY uk_card_variant (card_id, variant),
        INDEX idx_card_id (card_id)
      )`,
    insertFn: async (conn, bak) => {
      const cardIdCol      = await columnExists(conn, bak, 'cardId')      ? 'cardId'      : 'card_id';
      const displayNameCol = await columnExists(conn, bak, 'displayName') ? 'displayName'
                           : await columnExists(conn, bak, 'display_name') ? 'display_name'
                           : 'variant';
      await conn.query(`
        INSERT INTO m_card_variants (card_id, variant, display_name)
        SELECT ${cardIdCol}, variant, ${displayNameCol} FROM \`${bak}\`
      `);
    },
  });
}

// ---------------------------------------------------------------------------

async function migratePriceObservations(conn) {
  await migrateTable(conn, {
    src:  'm_price_observations',
    bak:  '_bak_m_price_observations',
    label: 'm_price_observations',
    createSql: `
      CREATE TABLE m_price_observations (
        id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        card_id     VARCHAR(80),
        variant     VARCHAR(40),
        source      VARCHAR(64),
        currency    VARCHAR(8),
        amount      DECIMAL(10,4),
        amount_gbp  DECIMAL(10,4),
        observed_at DATETIME,
        INDEX idx_card_variant      (card_id, variant),
        INDEX idx_observed_at       (observed_at),
        INDEX idx_card_variant_date (card_id, variant, observed_at)
      )`,
    insertFn: async (conn, bak) => {
      const cardIdCol  = await columnExists(conn, bak, 'cardId')     ? 'cardId'     : 'card_id';
      const srcCol     = await columnExists(conn, bak, 'provider')   ? 'provider'   : 'source';
      const obsAtCol   = await columnExists(conn, bak, 'observedAt') ? 'observedAt' : 'observed_at';
      const amountExpr = await columnExists(conn, bak, 'market') ? 'market'
                       : await columnExists(conn, bak, 'mid')    ? 'mid'
                       : await columnExists(conn, bak, 'price')  ? 'price'
                       : await columnExists(conn, bak, 'amount') ? 'amount'
                       : await columnExists(conn, bak, 'low')    ? 'low'
                       : null;

      if (!amountExpr) {
        log(`m_price_observations — no price column found, skipping data (table created empty)`);
        return;
      }

      await conn.query(`
        INSERT INTO m_price_observations (card_id, variant, source, currency, amount, amount_gbp, observed_at)
        SELECT ${cardIdCol}, COALESCE(variant, 'normal'), ${srcCol},
               COALESCE(currency, 'USD'), ${amountExpr}, NULL, ${obsAtCol}
        FROM \`${bak}\`
        WHERE ${amountExpr} IS NOT NULL
      `);
    },
  });
}

// ---------------------------------------------------------------------------

async function migratePriceLatest(conn) {
  await migrateTable(conn, {
    src:  'm_price_latest',
    bak:  '_bak_m_price_latest',
    label: 'm_price_latest',
    createSql: `
      CREATE TABLE m_price_latest (
        id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        card_id    VARCHAR(80),
        variant    VARCHAR(40),
        price_gbp  DECIMAL(10,4),
        median_gbp DECIMAL(10,4),
        p10_gbp    DECIMAL(10,4),
        p90_gbp    DECIMAL(10,4),
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_card_variant (card_id, variant),
        INDEX idx_card_id (card_id)
      )`,
    insertFn: async (conn, bak) => {
      // Old table already uses card_id, price_gbp, median_gbp, p10_gbp, p90_gbp, updated_at
      await conn.query(`
        INSERT INTO m_price_latest (card_id, variant, price_gbp, median_gbp, p10_gbp, p90_gbp, updated_at)
        SELECT card_id, COALESCE(variant, 'normal'),
               price_gbp, median_gbp, p10_gbp, p90_gbp, updated_at
        FROM \`${bak}\`
        WHERE price_gbp IS NOT NULL
      `);
    },
  });
}

// ---------------------------------------------------------------------------

async function migratePriceDaily(conn) {
  await migrateTable(conn, {
    src:  'm_price_daily',
    bak:  '_bak_m_price_daily',
    label: 'm_price_daily',
    createSql: `
      CREATE TABLE m_price_daily (
        id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        card_id    VARCHAR(80),
        variant    VARCHAR(40),
        price_date DATE,
        open_gbp   DECIMAL(10,4),
        close_gbp  DECIMAL(10,4),
        high_gbp   DECIMAL(10,4),
        low_gbp    DECIMAL(10,4),
        avg_gbp    DECIMAL(10,4),
        volume     INT,
        UNIQUE KEY uk_card_variant_date (card_id, variant, price_date),
        INDEX idx_price_date (price_date)
      )`,
    insertFn: async (conn, bak) => {
      // Old table: card_id, variant, as_of, median_gbp, p10_gbp, p90_gbp, sample_size
      await conn.query(`
        INSERT INTO m_price_daily (card_id, variant, price_date,
                                   open_gbp, close_gbp, high_gbp, low_gbp, avg_gbp, volume)
        SELECT card_id, COALESCE(variant, 'normal'), as_of,
               median_gbp, median_gbp, p90_gbp, p10_gbp, median_gbp,
               COALESCE(sample_size, 0)
        FROM \`${bak}\`
        WHERE median_gbp IS NOT NULL
      `);
    },
  });
}

// ---------------------------------------------------------------------------

async function migratePriceRollups(conn) {
  await migrateTable(conn, {
    src:  'm_price_rollups',
    bak:  '_bak_m_price_rollups',
    label: 'm_price_rollups',
    createSql: `
      CREATE TABLE m_price_rollups (
        id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        card_id     VARCHAR(80),
        variant     VARCHAR(40),
        days        INT,
        avg_gbp     DECIMAL(10,4),
        min_gbp     DECIMAL(10,4),
        max_gbp     DECIMAL(10,4),
        last_gbp    DECIMAL(10,4),
        computed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_card_variant_days (card_id, variant, days),
        INDEX idx_card_id (card_id)
      )`,
    insertFn: async (conn, bak) => {
      // Old table already matches: card_id, variant, days, avg_gbp, min_gbp, max_gbp, last_gbp, computed_at
      await conn.query(`
        INSERT INTO m_price_rollups (card_id, variant, days, avg_gbp, min_gbp, max_gbp, last_gbp, computed_at)
        SELECT card_id, COALESCE(variant, 'normal'), days,
               avg_gbp, min_gbp, max_gbp, last_gbp, computed_at
        FROM \`${bak}\`
      `);
    },
  });
}

// ---------------------------------------------------------------------------

async function createSchedulerTasks(conn) {
  if (await tableExists(conn, 'scheduler_tasks')) { skip('scheduler_tasks (already exists)'); return; }
  log('creating scheduler_tasks …');
  await conn.query(`
    CREATE TABLE scheduler_tasks (
      id          VARCHAR(64)  NOT NULL PRIMARY KEY,
      name        VARCHAR(80),
      cron_exp    VARCHAR(80),
      payload     TEXT,
      timezone    VARCHAR(64),
      description VARCHAR(200),
      enabled     TINYINT(1)   DEFAULT 1,
      status      VARCHAR(20)  DEFAULT 'idle',
      last_run_at DATETIME,
      last_error  TEXT,
      tries       INT          DEFAULT 0
    )
  `);
  ok('scheduler_tasks — created');
}

// ---------------------------------------------------------------------------

async function main() {
  console.log('[migrate] connecting to', `${DB.host}:${DB.port}/${DB.database}`);
  const conn = await mysql2.createConnection(DB);

  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    await migrateSets(conn);
    await migrateCards(conn);
    await migrateCardVariants(conn);
    await migratePriceObservations(conn);
    await migratePriceLatest(conn);
    await migratePriceDaily(conn);
    await migratePriceRollups(conn);
    await createSchedulerTasks(conn);

    // Patch: add enabled column to m_sets if missing (for already-migrated tables)
    if (!await columnExists(conn, 'm_sets', 'enabled')) {
      log('m_sets — adding enabled column …');
      await conn.query(`ALTER TABLE m_sets ADD COLUMN enabled TINYINT(1) NOT NULL DEFAULT 1`);
      ok('m_sets — enabled column added');
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('\n[migrate] done.');
    console.log('[migrate] Backup tables retained. Drop after verification:');
    console.log('  DROP TABLE _bak_m_sets, _bak_m_cards, _bak_m_card_variants,');
    console.log('             _bak_m_price_observations, _bak_m_price_latest,');
    console.log('             _bak_m_price_daily, _bak_m_price_rollups;');
  } catch (err) {
    await conn.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
    console.error('[migrate] FAILED:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();
