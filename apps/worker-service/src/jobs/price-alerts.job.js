/**
 * Price Alert Checker
 *
 * Reads enabled price alerts from the catalog-service's price_alerts table,
 * fetches the current market price for each card from the catalog price table,
 * and fires a notification when the alert condition is met.
 *
 * Supported conditions: below, above, pct_down, pct_up
 *
 * An alert that fires is marked with triggeredAt and will not fire again until
 * cooldownHours have passed (default: 24h).
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
const PRICE_TABLE = process.env.PRICE_TABLE || 'm_prices';

// Helper: get the price from N hours ago for percentage-change calculations
async function getPriceAtHoursAgo(cardId, variant, currency, hoursAgo) {
  const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  try {
    const [rows] = await sequelize.query(
      `SELECT price FROM \`${PRICE_TABLE}\`
       WHERE card_id = :cardId
         AND (variant = :variant OR (:variant IS NULL AND variant IS NULL))
         AND currency = :currency
         AND updated_at <= :since
       ORDER BY updated_at DESC LIMIT 1`,
      { replacements: { cardId, variant: variant ?? null, currency, since } },
    );
    return rows.length ? Number(rows[0].price) : null;
  } catch { return null; }
}

function shouldFire(alert, currentPrice, historicalPrice) {
  const condition = alert.condition ?? 'below';
  const value     = Number(alert.value ?? alert.targetPrice ?? 0);

  switch (condition) {
    case 'below':   return currentPrice <= value;
    case 'above':   return currentPrice >= value;
    case 'pct_down': {
      if (!historicalPrice) return false;
      const drop = (historicalPrice - currentPrice) / historicalPrice * 100;
      return drop >= value;
    }
    case 'pct_up': {
      if (!historicalPrice) return false;
      const rise = (currentPrice - historicalPrice) / historicalPrice * 100;
      return rise >= value;
    }
    default: return false;
  }
}

function buildNotificationBody(alert, currentPrice) {
  const condition = alert.condition ?? 'below';
  const value     = Number(alert.value ?? alert.targetPrice ?? 0);
  const currency  = alert.currency;
  const cardId    = alert.cardId;

  switch (condition) {
    case 'below':
      return `${cardId} is now ${currency} ${currentPrice.toFixed(2)} — at or below your target of ${currency} ${value.toFixed(2)}.`;
    case 'above':
      return `${cardId} is now ${currency} ${currentPrice.toFixed(2)} — at or above your target of ${currency} ${value.toFixed(2)}.`;
    case 'pct_down':
      return `${cardId} has dropped ${value}% or more over the last ${alert.windowHours ?? 24}h. Current price: ${currency} ${currentPrice.toFixed(2)}.`;
    case 'pct_up':
      return `${cardId} has risen ${value}% or more over the last ${alert.windowHours ?? 24}h. Current price: ${currency} ${currentPrice.toFixed(2)}.`;
    default:
      return `${cardId} price alert triggered. Current price: ${currency} ${currentPrice.toFixed(2)}.`;
  }
}

export async function runPriceAlertsJob() {
  logger.info('Running price alert check…');
  let fired = 0;

  try {
    // Use the longest possible cooldown as the rearm cutoff for the query —
    // per-alert cooldown is then enforced individually below
    const maxCooldownMs  = 7 * 24 * 60 * 60 * 1000; // 7 days upper bound
    const rearmCutoff    = new Date(Date.now() - maxCooldownMs);

    const alerts = await PriceAlert.findAll({
      where: {
        [Op.and]: [
          { [Op.or]: [{ enabled: true }, { isActive: true }] },
          { [Op.or]: [{ triggeredAt: null }, { triggeredAt: { [Op.lt]: rearmCutoff } }] },
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

      // Enforce per-alert cooldown
      if (alert.triggeredAt) {
        const cooldownMs = Number(alert.cooldownHours ?? 24) * 60 * 60 * 1000;
        if (Date.now() - new Date(alert.triggeredAt).getTime() < cooldownMs) continue;
      }

      // Fetch historical price for pct_up / pct_down conditions
      const condition = alert.condition ?? 'below';
      let historicalPrice = null;
      if (condition === 'pct_up' || condition === 'pct_down') {
        const windowHours = Number(alert.windowHours ?? 24);
        historicalPrice = await getPriceAtHoursAgo(alert.cardId, alert.variant, alert.currency, windowHours);
      }

      if (shouldFire(alert, currentPrice, historicalPrice)) {
        await notifyUser({
          userId:  alert.userId,
          type:    NotificationType.PRICE_ALERT,
          title:   'Price alert hit!',
          body:    buildNotificationBody(alert, currentPrice),
          linkUrl: `/catalog/cards/${alert.cardId}`,
          meta:    { cardId: alert.cardId, currentPrice, condition, value: alert.value ?? alert.targetPrice },
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
