/**
 * patchGaps — fills price observation gaps in the time series.
 * A "gap" is a card+variant+currency combo that has observations on day N and day N+2
 * but nothing on day N+1. We fill with the average of neighbours.
 *
 * Runs: daily at 02:00
 */
import { getSequelize } from '@sbf/database';
import { createLogger } from '@sbf/logger';

const logger = createLogger('catalog:patch-gaps');

export async function patchGaps({ dryRun = false, logger: log = logger } = {}) {
  const sequelize = getSequelize();
  log.info(`patchGaps starting (dryRun=${dryRun})`);

  let patched = 0;

  try {
    // Find combos that have at least 2 observations but gaps in between
    const [combos] = await sequelize.query(`
      SELECT card_id, variant, currency,
             MIN(DATE(observed_at)) AS first_date, MAX(DATE(observed_at)) AS last_date,
             COUNT(*) AS obs_count, DATEDIFF(MAX(DATE(observed_at)), MIN(DATE(observed_at))) + 1 AS expected_days
      FROM m_price_observations
      GROUP BY card_id, variant, currency
      HAVING expected_days > obs_count
      LIMIT 5000
    `);

    log.info(`patchGaps: found ${combos.length} combos with gaps`);

    for (const combo of combos) {
      const { card_id, variant, currency } = combo;

      // Get all existing observations for this combo
      const [obs] = await sequelize.query(`
        SELECT DATE(observed_at) AS observed_date, amount AS market_price
        FROM m_price_observations
        WHERE card_id = :cardId AND (variant = :variant OR (:variant IS NULL AND variant IS NULL)) AND currency = :currency
        ORDER BY observed_at ASC
      `, { replacements: { cardId: card_id, variant: variant ?? null, currency } });

      // Drop rows where amount was null
      const validObs = obs.filter((o) => o.market_price != null && !isNaN(Number(o.market_price)));
      if (validObs.length < 2) continue;

      // Find gaps and fill by linear interpolation
      for (let i = 0; i < validObs.length - 1; i++) {
        const dateA = new Date(validObs[i].observed_date);
        const dateB = new Date(validObs[i + 1].observed_date);
        const diffDays = Math.round((dateB - dateA) / 86_400_000);
        if (diffDays <= 1) continue;

        // Fill gap days
        for (let d = 1; d < diffDays; d++) {
          const gapDate = new Date(dateA.getTime() + d * 86_400_000);
          const gapDateStr = gapDate.toISOString().slice(0, 10);
          const t = d / diffDays;
          const interpolatedPrice = Number(validObs[i].market_price) + t * (Number(validObs[i + 1].market_price) - Number(validObs[i].market_price));

          if (!dryRun) {
            await sequelize.query(`
              INSERT IGNORE INTO m_price_observations (card_id, variant, currency, observed_at, amount, source)
              VALUES (:cardId, :variant, :currency, :gapDate, :price, 'gap_fill')
            `, { replacements: { cardId: card_id, variant: variant ?? null, currency, gapDate: gapDateStr, price: interpolatedPrice.toFixed(4) } });
          }
          patched++;
        }
      }
    }

    log.info(`patchGaps complete: ${patched} rows ${dryRun ? 'would be' : ''} filled`);
    return { patched };
  } catch (err) {
    log.error(`patchGaps error: ${err.message}`);
    throw err;
  }
}
