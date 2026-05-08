// Collect latest prices for a set from one or more price providers.
//
// No price adapters are currently active. To add a provider:
//   1. Create apps/catalog-service/src/adapters/<name>.adapter.js
//      It must export: fetchPrices({ set, cardNumbers, variantsByNumber })
//      returning: Array<{ card_id, variant, currency, amount, observed_at, source }>
//   2. Import it below and add a branch in the fetch section.

import { Op } from 'sequelize';
import { getSequelize } from '@sbf/database';
import { Card, CardVariant, PriceObservation } from '../models/index.js';
import { resolveSet } from '../services/set.service.js';
import { toGBP, getFx } from '../services/fx.service.js';
import { fxDaily } from './fxDaily.job.js';

export async function collectPrices({ set, since, dryRun = false, prewarmFx = false, backfillFxDays, logger = console } = {}) {
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

  const fx = await getFx({});
  const fxDate = fx.date;

  const cards = await Card.findAll({
    where: { set_code: tcgdexCode },
    attributes: ['id', 'number'],
    order: [['number', 'ASC']],
  });

  if (!cards.length) {
    return { ok: true, setCode: tcgdexCode, counts: { cards: 0, variants: 0, observations: { collected: 0, written: 0 } }, ms: Date.now() - started };
  }

  const numbers = cards.map(r => r.get('number'));
  const ids     = cards.map(r => r.get('id'));

  const varRows = await CardVariant.findAll({
    where: { card_id: { [Op.in]: ids } },
    attributes: ['card_id', 'variant'],
  });

  const variantsByNumber = new Map();
  for (const r of varRows) {
    const parts = String(r.card_id).split('-');
    const num = parts.slice(1).join('-');
    if (!num) continue;
    const list = variantsByNumber.get(num) || [];
    list.push(r.variant); // already canonical — stored by ingestSet with full compound key
    variantsByNumber.set(num, list);
  }
  const varByNumObj = Object.fromEntries(variantsByNumber);

  // ── Fetch from providers ────────────────────────────────────────────────────
  // Add adapter imports + branches here as providers become available.
  const rawObs = [];

  // ── Normalise + convert to GBP ─────────────────────────────────────────────
  const setPrefix = `${tcgdexCode}-`;
  const sinceStr  = since ? String(since).slice(0, 10) : null;
  const valid = rawObs.filter(o => o.amount != null && Number.isFinite(Number(o.amount)));
  const filtered = sinceStr ? valid.filter(o => (o.observed_at || '').slice(0, 10) >= sinceStr) : valid;

  const seen = new Set();
  const converted = [];
  for (const o of filtered) {
    const day = (o.observed_at || '').slice(0, 10) || fxDate;
    const gbp = await toGBP(Number(o.amount), o.currency || 'USD', { date: day, round: 4 });
    if (gbp == null) continue;
    const canonCardId = o.card_id.startsWith(setPrefix)
      ? o.card_id
      : `${tcgdexCode}-${o.card_id.split('-').slice(1).join('-')}`;
    if (!canonCardId.startsWith(setPrefix)) continue;
    const k = `${canonCardId}::${o.variant}::${day}::${o.source}`;
    if (seen.has(k)) continue;
    seen.add(k);
    converted.push({ card_id: canonCardId, variant: o.variant, source: o.source, day, amount_gbp: gbp });
  }

  if (dryRun || !converted.length) {
    return {
      ok: true,
      setCode: tcgdexCode,
      counts: { cards: cards.length, variants: varRows.length, observations: { collected: converted.length, written: 0 } },
      ms: Date.now() - started,
    };
  }

  // ── Write observations ──────────────────────────────────────────────────────
  const sequelize = getSequelize();
  let wrote = 0;
  await sequelize.transaction(async t => {
    for (const row of converted) {
      const rounded = Math.round((row.amount_gbp + Number.EPSILON) * 100) / 100;
      await PriceObservation.create({
        card_id:    row.card_id,
        variant:    row.variant,
        source:     row.source,
        currency:   'GBP',
        amount:     rounded,
        amount_gbp: rounded,
        observed_at: new Date(row.day),
      }, { transaction: t });
      wrote++;
    }
  });

  return {
    ok: true,
    setCode: tcgdexCode,
    counts: { cards: cards.length, variants: varRows.length, observations: { collected: converted.length, written: wrote } },
    ms: Date.now() - started,
    notes: { fxDate },
  };
}
