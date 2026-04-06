// Collect latest prices for a set from multiple providers, convert to GBP,
// and upsert observations + latest snapshot.

import { Op } from 'sequelize';
import { getSequelize } from '@sbf/database';
import { Card, CardVariant, PriceObservation, PriceLatest } from '../models/index.js';
import { resolveSet } from '../services/set.service.js';
import { canonicalVariantKey } from '../services/normalizer.service.js';
import { fetchPricesPPT } from '../adapters/ppt.adapter.js';
import { toGBP, getFx } from '../services/fx.service.js';
import { fxDaily } from './fxDaily.job.js';

export async function collectPrices({ set, since, dryRun = false, prewarmFx = false, backfillFxDays, providers, logger = console } = {}) {
  const started = Date.now();
  if (!set) throw new Error('collectPrices: set is required');

  const setRow = await resolveSet(set);
  const tcgdexCode = setRow?.code;
  if (!tcgdexCode) throw new Error(`collectPrices: unable to resolve set '${set}'`);

  if (prewarmFx || backfillFxDays) {
    try {
      await fxDaily({ backfillDays: backfillFxDays, prewarm90d: !backfillFxDays, logger });
    } catch (e) {
      logger.warn?.(`collectPrices: fxDaily prewarm failed: ${e?.message}`);
    }
  }

  const providerList = Array.isArray(providers) && providers.length
    ? providers.map(s => String(s).toLowerCase())
    : ['ppt'];

  const fx = await getFx({});
  const fxDate = fx.date;

  const cards = await Card.findAll({
    where: { set_code: tcgdexCode },
    attributes: ['id', 'number'],
    order: [['number', 'ASC']],
  });

  if (!cards.length) {
    return { ok: true, setCode: tcgdexCode, counts: { cards: 0, variants: 0, observations: { collected: 0, written: 0 }, latest: 0 }, ms: Date.now() - started };
  }

  const numbers = cards.map(r => r.get('number'));
  const ids = cards.map(r => r.get('id'));

  const varRows = await CardVariant.findAll({
    where: { card_id: { [Op.in]: ids } },
    attributes: ['card_id', 'variant'],
  });

  // Build variantsByNumber map (card number -> variant list)
  const variantsByNumber = new Map();
  for (const r of varRows) {
    const parts = String(r.card_id).split('-');
    const num = parts.slice(1).join('-');
    if (!num) continue;
    const list = variantsByNumber.get(num) || [];
    list.push(canonicalVariantKey(r.variant));
    variantsByNumber.set(num, list);
  }
  const varByNumObj = Object.fromEntries(variantsByNumber);

  // Fetch from providers
  let rawObs = [];
  if (providerList.includes('ppt')) {
    const obs = await fetchPricesPPT({ set: tcgdexCode, cardNumbers: numbers, variantsByNumber: varByNumObj }).catch(() => []);
    rawObs.push(...obs);
  }

  // Normalize to canonical IDs
  const setPrefix = `${tcgdexCode}-`;
  const observations = rawObs.filter(o => o.amount != null && Number.isFinite(Number(o.amount)));

  // Optional since filter
  const sinceStr = since ? String(since).slice(0, 10) : null;
  const filtered = sinceStr ? observations.filter(o => (o.observed_at || '').slice(0, 10) >= sinceStr) : observations;

  // Convert to GBP, dedupe by (card_id, variant, day, source)
  const seen = new Set();
  const converted = [];
  for (const o of filtered) {
    const day = (o.observed_at || '').slice(0, 10) || fxDate;
    const gbp = await toGBP(Number(o.amount), o.currency || 'USD', { date: day, round: 4 });
    if (gbp == null) continue;
    const canonCardId = o.card_id.startsWith(setPrefix) ? o.card_id : `${tcgdexCode}-${o.card_id.split('-').slice(1).join('-')}`;
    if (!canonCardId.startsWith(setPrefix)) continue;
    const k = `${canonCardId}::${o.variant}::${day}::${o.source}`;
    if (seen.has(k)) continue;
    seen.add(k);
    converted.push({ card_id: canonCardId, variant: o.variant, day, amount_gbp: gbp, source: o.source || 'blend' });
  }

  // Aggregate daily (mean per card/variant/day)
  const dailyMap = new Map();
  for (const r of converted) {
    const k = `${r.card_id}::${r.variant}::${r.day}`;
    const list = dailyMap.get(k) || [];
    list.push(r.amount_gbp);
    dailyMap.set(k, list);
  }
  const daily = [];
  for (const [k, list] of dailyMap) {
    const [card_id, variant, day] = k.split('::');
    const avg = list.reduce((a, b) => a + b, 0) / list.length;
    daily.push({ card_id, variant, day, amount_gbp: avg });
  }

  if (dryRun) {
    return { ok: true, setCode: tcgdexCode, counts: { cards: cards.length, variants: varRows.length, observations: { collected: daily.length, written: 0 }, latest: 0 }, ms: Date.now() - started };
  }

  // Write
  const sequelize = getSequelize();
  const { wrote, latestCount } = await sequelize.transaction(async t => {
    let wrote = 0;
    const latestKeys = new Set();
    for (const row of daily) {
      const rounded = Math.round((row.amount_gbp + Number.EPSILON) * 100) / 100;
      await PriceObservation.create({
        card_id: row.card_id,
        variant: row.variant,
        source: row.source || 'blend',
        currency: 'GBP',
        amount: rounded,
        amount_gbp: rounded,
        observed_at: new Date(row.day),
      }, { transaction: t });

      await PriceLatest.upsert({
        card_id: row.card_id,
        variant: row.variant,
        price_gbp: rounded,
        median_gbp: rounded,
        p10_gbp: rounded,
        p90_gbp: rounded,
        updated_at: new Date(),
      }, { transaction: t });

      wrote++;
      latestKeys.add(`${row.card_id}::${row.variant}`);
    }
    return { wrote, latestCount: latestKeys.size };
  });

  return {
    ok: true,
    setCode: tcgdexCode,
    counts: {
      cards: cards.length,
      variants: varRows.length,
      observations: { collected: converted.length, written: wrote },
      latest: latestCount,
    },
    ms: Date.now() - started,
    notes: { fxDate, providersTried: providerList },
  };
}
