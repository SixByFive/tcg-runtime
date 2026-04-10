/**
 * Price Alert Checker
 *
 * Reads enabled price alerts from the catalog-service's price_alerts table,
 * fetches the current market price for each card from the catalog price table,
 * and fires a notification when the current price drops to or below the user's
 * target price.
 *
 * An alert that fires is marked with triggeredAt and will not fire again for
 * 24 hours (re-arms itself once the price moves back above the target).
 *
 * Schedule: every 15 minutes
 *
 * Note: PRICE_TABLE env var controls which catalog table holds current prices.
 *       Default: m_prices. Columns expected: card_id, variant, currency, price.
 */
import { Op } from 'sequelize';
import { PriceAlert, sequelize } from '../models/index.js';
import { notifyUser, NotificationType } from '@sbf/contracts';
import { createLogger } from '@sbf/logger';

const logger = createLogger('worker:price-alerts');
const PRICE_TABLE   = process.env.PRICE_TABLE || 'm_prices';
const REARM_HOURS   = 24;
const REARM_MS      = REARM_HOURS * 60 * 60 * 1000;

export async function runPriceAlertsJob() {
  logger.info('Running price alert check…');
  let fired = 0;

  try {
    // Find enabled alerts that haven't triggered recently
    const rearmCutoff = new Date(Date.now() - REARM_MS);
    const alerts = await PriceAlert.findAll({
      where: {
        enabled: true,
        [Op.or]: [
          { triggeredAt: null },
          { triggeredAt: { [Op.lt]: rearmCutoff } },
        ],
      },
      limit: 1000,
    });

    if (!alerts.length) {
      logger.info('Price alerts: no alerts to check');
      return;
    }

    // Deduplicate cardId+variant+currency combos to minimise DB queries
    const combos = new Map();
    for (const alert of alerts) {
      const key = `${alert.cardId}::${alert.variant ?? ''}::${alert.currency}`;
      if (!combos.has(key)) combos.set(key, { cardId: alert.cardId, variant: alert.variant, currency: alert.currency });
    }

    // Fetch current prices in bulk using raw SQL
    const priceMap = new Map();
    for (const { cardId, variant, currency } of combos.values()) {
      try {
        const [rows] = await sequelize.query(
          `SELECT price FROM \`${PRICE_TABLE}\`
           WHERE card_id = :cardId
             AND (variant = :variant OR (:variant IS NULL AND variant IS NULL))
             AND currency = :currency
           ORDER BY updated_at DESC LIMIT 1`,
          { replacements: { cardId, variant: variant ?? null, currency } },
        );
        if (rows.length) {
          const key = `${cardId}::${variant ?? ''}::${currency}`;
          priceMap.set(key, Number(rows[0].price));
        }
      } catch {
        // Price table may not exist yet — skip silently
      }
    }

    // Check each alert
    for (const alert of alerts) {
      const key          = `${alert.cardId}::${alert.variant ?? ''}::${alert.currency}`;
      const currentPrice = priceMap.get(key);
      if (currentPrice === undefined) continue;

      if (currentPrice <= Number(alert.targetPrice)) {
        await notifyUser({
          userId:  alert.userId,
          type:    NotificationType.PRICE_ALERT,
          title:   'Price alert hit!',
          body:    `${alert.cardId} is now ${alert.currency} ${currentPrice.toFixed(2)} — at or below your target of ${alert.currency} ${Number(alert.targetPrice).toFixed(2)}.`,
          linkUrl: `/catalog/cards/${alert.cardId}`,
          meta:    { cardId: alert.cardId, currentPrice, targetPrice: alert.targetPrice },
        }).catch(() => {});

        await alert.update({ triggeredAt: new Date() });
        fired++;
      }
    }

    logger.info(`Price alerts: ${fired} fired out of ${alerts.length} checked`);
  } catch (err) {
    logger.error(`Price alert job failed: ${err.message}`);
  }
}
