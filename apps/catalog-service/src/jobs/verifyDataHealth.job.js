/**
 * verifyDataHealth — checks catalog data integrity and logs anomalies.
 * Does NOT mutate data — read-only diagnostic report.
 *
 * Checks:
 * 1. Cards with no price observations in the last 30 days
 * 2. Price observations with NULL or zero amount
 * 3. Orphaned variants (variant key exists in card_variants but no parent card)
 *
 * Runs: daily at 03:00
 */
import { getSequelize } from '@sbf/database';
import { createLogger } from '@sbf/logger';

const logger = createLogger('catalog:verify-health');

export async function verifyDataHealth({ logger: log = logger } = {}) {
  const sequelize = getSequelize();
  log.info('verifyDataHealth starting…');

  const report = { staleCards: 0, nullPrices: 0, orphanedVariants: 0 };

  try {
    // 1. Cards with no recent prices
    const [stale] = await sequelize.query(`
      SELECT COUNT(*) AS cnt FROM cards c
      WHERE NOT EXISTS (
        SELECT 1 FROM m_price_observations po
        WHERE po.card_id = c.id AND po.observed_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      )
    `);
    report.staleCards = Number(stale[0]?.cnt ?? 0);

    // 2. Null/zero price observations
    const [nullPrices] = await sequelize.query(`
      SELECT COUNT(*) AS cnt FROM m_price_observations WHERE amount IS NULL OR amount = 0
    `);
    report.nullPrices = Number(nullPrices[0]?.cnt ?? 0);

    // 3. Orphaned card variants
    const [orphans] = await sequelize.query(`
      SELECT COUNT(*) AS cnt FROM card_variants cv WHERE NOT EXISTS (SELECT 1 FROM cards c WHERE c.id = cv.card_id)
    `);
    report.orphanedVariants = Number(orphans[0]?.cnt ?? 0);

    log.info(`verifyDataHealth report: staleCards=${report.staleCards} nullPrices=${report.nullPrices} orphanedVariants=${report.orphanedVariants}`);

    if (report.staleCards > 100) log.warn(`verifyDataHealth: ${report.staleCards} cards have no price data in 30 days`);
    if (report.nullPrices > 0)  log.warn(`verifyDataHealth: ${report.nullPrices} observations have null/zero price`);
    if (report.orphanedVariants > 0) log.warn(`verifyDataHealth: ${report.orphanedVariants} orphaned card variants`);

    return report;
  } catch (err) {
    log.error(`verifyDataHealth error: ${err.message}`);
    throw err;
  }
}
