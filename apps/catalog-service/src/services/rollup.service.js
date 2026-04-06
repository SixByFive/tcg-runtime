// Compute price rollups (1/7/30/90 day aggregates) from m_price_observations.

import { Op } from 'sequelize';
import { Card, CardVariant, PriceObservation, PriceRollup } from '../models/index.js';

const DEFAULT_WINDOWS = [1, 7, 30, 90];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function windowBounds(asOf, days) {
  const d = new Date(`${asOf}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return { start: d.toISOString().slice(0, 10), end: asOf };
}

function normalizeWindows(value) {
  if (!value) return DEFAULT_WINDOWS;
  const arr = Array.isArray(value) ? value : [value];
  const parsed = arr.map(Number).filter(n => Number.isInteger(n) && n > 0).map(n => Math.min(n, 365));
  return Array.from(new Set(parsed)).sort((a, b) => a - b).length
    ? Array.from(new Set(parsed)).sort((a, b) => a - b)
    : DEFAULT_WINDOWS;
}

async function aggregateWindow(cardId, variant, start, end) {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);

  const rows = await PriceObservation.findAll({
    where: {
      card_id: cardId,
      variant,
      observed_at: { [Op.gte]: startDate, [Op.lt]: endDate },
    },
    attributes: ['amount_gbp', 'observed_at'],
    order: [['observed_at', 'ASC']],
    raw: true,
  });

  if (!rows.length) return null;

  const byDay = new Map();
  for (const row of rows) {
    const d = row.observed_at ? new Date(row.observed_at) : null;
    if (!d || isNaN(d.getTime())) continue;
    const dayKey = d.toISOString().slice(0, 10);
    const amount = Number(row.amount_gbp);
    if (!Number.isFinite(amount)) continue;
    const existing = byDay.get(dayKey);
    if (!existing || d >= new Date(existing.ts)) {
      byDay.set(dayKey, { ts: d.toISOString(), amount });
    }
  }

  if (!byDay.size) return null;

  const prices = Array.from(byDay.values()).map(v => v.amount);
  const count = prices.length;
  const sum = prices.reduce((a, b) => a + b, 0);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = sum / count;
  const change = prices[prices.length - 1] - prices[0];
  const changePct = prices[0] !== 0 ? (change / prices[0]) * 100 : null;

  return { count, min, max, avg, change, changePct, latest: prices[prices.length - 1] };
}

async function computeRollupRows(cardId, variant, windows, asOf) {
  const out = [];
  for (const w of windows) {
    const bounds = windowBounds(asOf, w);
    const agg = await aggregateWindow(cardId, variant, bounds.start, bounds.end);
    out.push({
      card_id: cardId,
      variant,
      days: w,
      avg_gbp: agg?.avg ?? null,
      min_gbp: agg?.min ?? null,
      max_gbp: agg?.max ?? null,
      last_gbp: agg?.latest ?? null,
      computed_at: new Date(),
    });
  }
  return out;
}

export async function rebuildRollupsForVariant(cardId, variant, opts = {}) {
  const asOf = opts.asOf || todayISO();
  const windows = normalizeWindows(opts.windows);
  const rows = await computeRollupRows(cardId, variant, windows, asOf);

  for (const row of rows) {
    await PriceRollup.upsert(row);
  }

  return { ok: true, cardId, variant, windows, rows };
}

export async function rebuildRollupsForCard(cardId, opts = {}) {
  const asOf = opts.asOf || todayISO();
  const windows = normalizeWindows(opts.windows);

  const varRows = await CardVariant.findAll({
    where: { card_id: cardId },
    attributes: ['variant'],
  });
  const variants = Array.from(new Set(varRows.map(v => String(v.variant).toLowerCase())));

  const results = [];
  for (const variant of variants) {
    const rows = await computeRollupRows(cardId, variant, windows, asOf);
    for (const row of rows) await PriceRollup.upsert(row);
    results.push({ variant, rows });
  }

  return { ok: true, cardId, variants: variants.length, windows, results };
}

export async function rebuildRollupsForSet(setCode, opts = {}) {
  const asOf = opts.asOf || todayISO();
  const windows = normalizeWindows(opts.windows);
  const batchSize = opts.batchSize || 500;

  const cards = await Card.findAll({
    where: { set_code: setCode },
    attributes: ['id'],
    order: [['number', 'ASC']],
  });
  const ids = cards.map(c => c.get('id'));

  const results = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    for (const cardId of ids.slice(i, i + batchSize)) {
      const res = await rebuildRollupsForCard(cardId, { asOf, windows });
      results.push(res);
    }
  }

  return { ok: true, setCode, cards: ids.length, windows, results };
}

export async function rebuildRollupsAll(opts = {}) {
  const asOf = opts.asOf || todayISO();
  const windows = normalizeWindows(opts.windows);

  const pairs = await PriceObservation.findAll({
    attributes: [['card_id', 'card_id'], ['variant', 'variant']],
    group: ['card_id', 'variant'],
    raw: true,
  });

  const results = [];
  for (const { card_id, variant } of pairs) {
    const rows = await computeRollupRows(card_id, String(variant).toLowerCase(), windows, asOf);
    for (const row of rows) await PriceRollup.upsert(row);
    results.push({ card_id, variant, rows });
  }

  return { ok: true, pairs: pairs.length, windows, results };
}
