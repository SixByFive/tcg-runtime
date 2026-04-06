// TCGdex adapter — fetch set metadata + cards from TCGdex v2 API.
// Uses native fetch (Node 20+). No file cache in new service (DB is source of truth).

import { normalizeSetFromTcgdex, normalizeCardFromTcgdex, detectVariantsForCard } from '../services/normalizer.service.js';
import { resolveSet } from '../services/set.service.js';

const BASE = process.env.TCGDEX_BASE || 'https://api.tcgdex.net/v2';
const LANG = 'en';
const DETAIL_CONCURRENCY = 8;
const DETAIL_DELAY_MS = 120;

async function fetchJson(url, { tries = 3 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(to);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await new Promise(r => setTimeout(r, 400 * Math.pow(1.6, i)));
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

  // Hydrate detail for cards lacking variant metadata
  const needsDetail = cardList.filter(c => !c?.variants && !c?.Variants);
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
    variantsByCardId[card.id] = detectVariantsForCard(raw).map(v => ({
      card_id: card.id,
      variant: v,
      display_name: v,
    }));
  }

  return { set, cards, variantsByCardId };
}
