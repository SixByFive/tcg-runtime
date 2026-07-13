// TCGDex price adapter — extract price observations from TCGDex card detail responses.
//
// Each card detail from the TCGDex API may carry a `prices` object with cardmarket
// (EUR) and/or tcgplayer (USD) data. This adapter fetches details in batches and
// returns observations in the shape collectPrices.job.js expects.

import { backoffDelay } from '@sbf/utils';

const BASE             = process.env.TCGDEX_BASE || 'https://api.tcgdex.net/v2';
const LANG             = 'en';
const FETCH_TIMEOUT_MS = Number(process.env.TCGDEX_FETCH_TIMEOUT_MS || 15000);
const CONCURRENCY      = Number(process.env.TCGDEX_DETAIL_CONCURRENCY || 8);
const DELAY_MS         = Number(process.env.TCGDEX_DETAIL_DELAY_MS || 120);

async function fetchJson(url, { tries = 3 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const to   = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      const res  = await fetch(url, { signal: ctrl.signal });
      clearTimeout(to);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await backoffDelay(i);
    }
  }
  return null;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function firstFinite(...vals) {
  for (const v of vals) {
    if (v != null) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

// TCGPlayer variant names → canonical variant keys
const TP_VARIANT = {
  normal:              'normal',
  holofoil:            'holo',
  reverseholofoil:     'reverse',
  '1steditionholofoil': 'holo',
  '1stedition':        'normal',
  unlimited:           'normal',
};

function canonTpVariant(raw) {
  const key = String(raw).toLowerCase().replace(/[^a-z0-9]/g, '');
  return TP_VARIANT[key] || key;
}

/**
 * Extract price observations from a single TCGDex card detail object.
 * Returns Array<{ card_id, variant, currency, amount, observed_at, source }>
 */
function extractPriceObs(card, today) {
  const cardId = card?.id;
  if (!cardId) return [];

  const prices = card?.prices;
  if (!prices || typeof prices !== 'object') return [];

  const obs = [];

  // ── CardMarket (EUR) ──────────────────────────────────────────────────────
  const cm = prices.cardmarket;
  if (cm) {
    const p = (cm.prices && typeof cm.prices === 'object') ? cm.prices : cm;

    const normalAmt = firstFinite(p.averageSellPrice, p.trendPrice, p.lowPrice, p.avg1);
    if (normalAmt !== null) {
      obs.push({ card_id: cardId, variant: 'normal', currency: 'EUR', amount: normalAmt, observed_at: today, source: 'tcgdex:cardmarket' });
    }

    const reverseAmt = firstFinite(p.reverseHoloSell, p.reverseHoloTrend, p.reverseHoloLow, p.reverseHoloAvg1);
    if (reverseAmt !== null) {
      obs.push({ card_id: cardId, variant: 'reverse', currency: 'EUR', amount: reverseAmt, observed_at: today, source: 'tcgdex:cardmarket' });
    }
  }

  // ── TCGPlayer (USD) ───────────────────────────────────────────────────────
  const tp = prices.tcgplayer;
  if (tp) {
    const variantMap = (tp.prices && typeof tp.prices === 'object') ? tp.prices : tp;
    for (const [rawVariant, vData] of Object.entries(variantMap)) {
      if (!vData || typeof vData !== 'object') continue;
      // Skip metadata keys
      if (!('market' in vData) && !('low' in vData) && !('mid' in vData)) continue;
      const amount = firstFinite(vData.market, vData.mid, vData.low);
      if (amount === null) continue;
      obs.push({
        card_id:     cardId,
        variant:     canonTpVariant(rawVariant),
        currency:    'USD',
        amount,
        observed_at: today,
        source:      'tcgdex:tcgplayer',
      });
    }
  }

  return obs;
}

/**
 * Fetch price observations for all cards in a set from TCGDex.
 *
 * @param {{ set: string, cardNumbers: string[], variantsByNumber: object }} params
 * @returns {Promise<Array<{ card_id, variant, currency, amount, observed_at, source }>>}
 */
export async function fetchPrices({ set, cardNumbers = [], variantsByNumber = {} }) {
  const setCode = String(set).trim().toLowerCase();
  const today   = new Date().toISOString().slice(0, 10);

  // Build TCGDex card IDs from ingested card numbers
  const cardIds = cardNumbers
    .map(n => (n ? `${setCode}-${n}` : null))
    .filter(Boolean);

  if (!cardIds.length) return [];

  const allObs = [];

  for (const group of chunk(cardIds, CONCURRENCY)) {
    const cards = await Promise.all(
      group.map(id => fetchJson(`${BASE}/${LANG}/cards/${encodeURIComponent(id)}`)),
    );
    for (const card of cards) {
      if (!card) continue;
      allObs.push(...extractPriceObs(card, today));
    }
    if (group.length === CONCURRENCY) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  return allObs;
}
