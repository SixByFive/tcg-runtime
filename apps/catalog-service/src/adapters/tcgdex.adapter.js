// TCGdex adapter — fetch set metadata + cards from TCGdex v2 API.
// Uses native fetch (Node 20+). No file cache in new service (DB is source of truth).

import { backoffDelay } from '@sbf/utils';
import { normalizeSetFromTcgdex, normalizeCardFromTcgdex, detectVariantsWithNames } from '../services/normalizer.service.js';
import { resolveSet } from '../services/set.service.js';

const BASE = process.env.TCGDEX_BASE || 'https://api.tcgdex.net/v2';
const LANG = 'en';

// Parallel card-detail fetches per batch. TCGdex public API tolerates ~8
// concurrent; reduce if you see 429s during ingestion.
const DETAIL_CONCURRENCY = Number(process.env.TCGDEX_DETAIL_CONCURRENCY || 8);

// Inter-batch pause between card-detail groups. 120 ms keeps request rate
// below ~67 rps — empirically safe for TCGdex's rate limiter.
const DETAIL_DELAY_MS = Number(process.env.TCGDEX_DETAIL_DELAY_MS || 120);

// Abort a single TCGdex fetch after this many ms. 15 s covers TCGdex's
// occasional slow responses without blocking ingestion indefinitely.
const FETCH_TIMEOUT_MS = Number(process.env.TCGDEX_FETCH_TIMEOUT_MS || 15000);

async function fetchJson(url, { tries = 3 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(to);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`HTTP ${res.status} for ${url}`);
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

async function hydrateCardDetails(cards, setCode) {
  const ids = cards.map(c => {
    if (c?.id) return c.id;
    const local = c?.localId ?? c?.number;
    return local ? `${setCode}-${String(local).trim()}` : null;
  }).filter(Boolean);

  const detailed = [];
  for (const group of chunk(ids, DETAIL_CONCURRENCY)) {
    const fetched = await Promise.all(
      group.map(id => fetchJson(`${BASE}/${LANG}/cards/${encodeURIComponent(id)}`)),
    );
    for (const c of fetched) if (c) detailed.push(c);
    if (group.length === DETAIL_CONCURRENCY) await new Promise(r => setTimeout(r, DETAIL_DELAY_MS));
  }
  return detailed.length ? detailed : cards;
}

/**
 * Fetch set + cards from TCGdex.
 * @param {string} input - tcgdex code or abbreviation (e.g. 'sv08' or 'SSP')
 * @returns {{ set: object, cards: object[], variantsByCardId: Record<string, object[]> }}
 */
export async function fetchSetAndCards(input) {
  const setRow = await resolveSet(input);
  const tcgdexCode = setRow?.code || String(input).trim().toLowerCase();

  const rawSet = await fetchJson(`${BASE}/${LANG}/sets/${encodeURIComponent(tcgdexCode)}`);
  if (!rawSet) throw new Error(`TCGdex: set not found for code '${tcgdexCode}'`);

  let rawCards = await fetchJson(`${BASE}/${LANG}/sets/${encodeURIComponent(tcgdexCode)}/cards`);
  if (!rawCards) {
    rawCards = await fetchJson(`${BASE}/${LANG}/cards?set.id=${encodeURIComponent(tcgdexCode)}`);
  }

  const cardList = Array.isArray(rawCards)
    ? rawCards
    : Array.isArray(rawCards?.results)
      ? rawCards.results
      : Array.isArray(rawCards?.cards)
        ? rawCards.cards
        : [];

  // Hydrate detail for cards lacking full variant metadata (need variants_detailed for foil sub-variants)
  const needsDetail = cardList.filter(c => !c?.variants_detailed && !c?.variants && !c?.Variants);
  const hydratedMap = new Map();
  if (needsDetail.length) {
    const detailed = await hydrateCardDetails(needsDetail, tcgdexCode);
    for (const c of detailed) {
      const id = c?.id || null;
      if (id) hydratedMap.set(id, c);
    }
  }

  const fullCards = cardList.map(c => {
    const id = c?.id;
    return (id && hydratedMap.has(id)) ? hydratedMap.get(id) : c;
  });

  const set = normalizeSetFromTcgdex(rawSet, { abbr: setRow?.abbreviation });

  const cards = [];
  const variantsByCardId = {};

  for (const raw of fullCards) {
    const card = normalizeCardFromTcgdex(raw, set.code);
    if (!card?.id) continue;
    // Exclude cards that resolved to a different set
    if (!card.id.startsWith(`${set.code}-`)) continue;
    cards.push(card);
    variantsByCardId[card.id] = detectVariantsWithNames(raw).map(({ variant, display_name }) => ({
      card_id: card.id,
      variant,
      display_name,
    }));
  }

  return { set, cards, variantsByCardId };
}
