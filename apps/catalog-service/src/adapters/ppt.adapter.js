// PPT gap-filler price adapter.
// Silently returns [] if PPT_BASE is not set — feature-flag style.

import { canonicalVariantKey, canonicalVariantSet } from '../services/normalizer.service.js';
import { resolveSet } from '../services/set.service.js';

const PPT_BASE = process.env.PPT_BASE || '';

async function fetchJsonSafe(url, { retries = 2 } = {}) {
  if (!PPT_BASE) return null;
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        if (res.status === 404) return null;
        if (res.status === 429 && i < retries) {
          await new Promise(r => setTimeout(r, 800 * (i + 1)));
          continue;
        }
        return null;
      }
      const json = await res.json();
      return json?.data ?? json;
    } catch (e) {
      lastErr = e;
      if (i < retries) await new Promise(r => setTimeout(r, 450 * Math.pow(1.6, i)));
    }
  }
  return null;
}

function num(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function collectVariantPayloads(section, { fallbackCurrency = 'USD' } = {}) {
  if (!section || typeof section !== 'object') return [];

  const payloads = [];
  const variants = new Map();

  for (const [key, value] of Object.entries(section)) {
    if (!value || typeof value !== 'object') continue;
    const variant = canonicalVariantKey(key, { fallback: null });
    if (!variant) continue;
    const market = num(value.market ?? value.price ?? value.mid ?? value.avg ?? value.value);
    if (market == null) continue;
    const currency = typeof value.currency === 'string' ? value.currency.toUpperCase() : fallbackCurrency;
    if (!variants.has(variant)) variants.set(variant, { market, currency, meta: value });
  }

  for (const [variant, entry] of variants) {
    payloads.push({ variant, ...entry, source: 'ppt' });
  }

  if (!variants.has('normal')) {
    const market = num(section.market ?? section.price ?? section.mid ?? section.avg ?? section.value);
    if (market != null) {
      const currency = typeof section.currency === 'string' ? section.currency.toUpperCase() : fallbackCurrency;
      payloads.push({ variant: 'normal', market, currency, meta: section, source: 'ppt' });
    }
  }

  return payloads;
}

export async function fetchPricesPPT({ set, cardNumbers, variantsByNumber = {} }) {
  if (!PPT_BASE) return [];

  const setRow = await resolveSet(set);
  const tcgdex = setRow?.code;
  if (!tcgdex || !cardNumbers?.length) return [];

  const nowISO = new Date().toISOString();
  const out = [];

  for (const number of cardNumbers) {
    const id = `${tcgdex}-${String(number)}`;
    const candidateUrls = [
      `${PPT_BASE}/v1/prices/${encodeURIComponent(id)}`,
      `${PPT_BASE}/prices/${encodeURIComponent(tcgdex)}/${encodeURIComponent(number)}`,
    ];

    let raw = null;
    for (const url of candidateUrls) {
      raw = await fetchJsonSafe(url);
      if (raw) break;
    }
    if (!raw) continue;

    const section = raw?.prices || raw?.price || raw;
    const variantSet = canonicalVariantSet(variantsByNumber[number]);
    const payloads = collectVariantPayloads(section);

    for (const p of payloads) {
      if (!variantSet.has(p.variant)) continue;
      out.push({
        card_id: id,
        variant: p.variant,
        currency: p.currency || 'USD',
        amount: p.market,
        observed_at: nowISO,
        source: p.source || 'ppt',
        meta: p.meta,
      });
    }
  }

  return out;
}
