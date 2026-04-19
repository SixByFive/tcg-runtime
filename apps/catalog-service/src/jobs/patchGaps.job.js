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
      SELECT card_id, variant, currency, MIN(observed_date) AS first_date, MAX(observed_date) AS last_date,
             COUNT(*) AS obs_count, DATEDIFF(MAX(observed_date), MIN(observed_date)) + 1 AS expected_days
      FROM price_observations
      GROUP BY card_id, variant, currency
      HAVING expected_days > obs_count
      LIMIT 5000
    `);

    log.info(`patchGaps: found ${combos.length} combos with gaps`);

    for (const combo of combos) {
      const { card_id, variant, currency } = combo;

      // Get all existing observations for this combo
      const [obs] = await sequelize.query(`
        SELECT observed_date, market_price
        FROM price_observations
        WHERE card_id = :cardId AND (variant = :variant OR (:variant IS NULL AND variant IS NULL)) AND currency = :currency
        ORDER BY observed_date ASC
      `, { replacements: { cardId: card_id, variant: variant ?? null, currency } });

      if (obs.length < 2) continue;

      // Find gaps and fill by linear interpolation
      for (let i = 0; i < obs.length - 1; i++) {
        const dateA = new Date(obs[i].observed_date);
        const dateB = new Date(obs[i + 1].observed_date);
        const diffDays = Math.round((dateB - dateA) / 86_400_000);
        if (diffDays <= 1) continue;

        // Fill gap days
        for (let d = 1; d < diffDays; d++) {
          const gapDate = new Date(dateA.getTime() + d * 86_400_000);
          const gapDateStr = gapDate.toISOString().slice(0, 10);
          const t = d / diffDays;
          const interpolatedPrice = obs[i].market_price + t * (obs[i + 1].market_price - obs[i].market_price);

          if (!dryRun) {
            await sequelize.query(`
              INSERT IGNORE INTO price_observations (card_id, variant, currency, observed_date, market_price, source)
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
