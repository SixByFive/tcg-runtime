// Scryfall adapter — fetch set metadata, cards, and bulk-data dumps.
// Uses native fetch (Node 20+). API reference: https://scryfall.com/docs/api
//
// Scryfall asks every integration to identify itself via User-Agent and to
// stay under 10 req/sec with 50–100 ms between requests. We bake that into
// `fetchJson` below. Bulk files are hosted on data.scryfall.io (CDN) and
// aren't rate-limited.

import { backoffDelay } from '@sbf/utils';
import {
  normalizeSetFromScryfall,
  synthesizeSetFromCard,
  normalizeCardFromScryfall,
  detectVariantsFromScryfall,
  normalizeLegalitiesFromScryfall,
  normalizeMtgFieldsFromScryfall,
  prefixSetCode,
} from '../services/scryfallNormalizer.service.js';

const API = process.env.SCRYFALL_API_BASE || 'https://api.scryfall.com';

// Scryfall asks ~50–100 ms between requests. 100 ms keeps us at ≤10 rps.
const REQUEST_DELAY_MS = Number(process.env.SCRYFALL_REQUEST_DELAY_MS || 100);

const FETCH_TIMEOUT_MS = Number(process.env.SCRYFALL_FETCH_TIMEOUT_MS || 30000);

// Bulk download timeout — 10 minutes. 450 MB on a slow link.
const BULK_FETCH_TIMEOUT_MS = Number(process.env.SCRYFALL_BULK_TIMEOUT_MS || 10 * 60 * 1000);

const USER_AGENT =
  process.env.SCRYFALL_USER_AGENT ||
  'tcg-runtime-catalog/0.1 (+https://sixbyfive.app)';

const DEFAULT_HEADERS = {
  'User-Agent': USER_AGENT,
  'Accept': 'application/json',
};

async function fetchJson(url, { tries = 3, headers = {}, timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { ...DEFAULT_HEADERS, ...headers },
      });
      clearTimeout(to);
      if (!res.ok) {
        if (res.status === 404) return null;
        if (res.status === 429) {
          // Rate-limited — honor Retry-After then retry.
          const retryAfter = Number(res.headers.get('retry-after') || 1);
          await new Promise(r => setTimeout(r, Math.max(1000, retryAfter * 1000)));
          continue;
        }
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await backoffDelay(i);
    }
  }
  if (lastErr) throw lastErr;
  return null;
}

async function throttle() {
  if (REQUEST_DELAY_MS > 0) await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all MTG sets' metadata.
 * @returns {Promise<object[]>} normalized Set rows (with mtg- prefix on code)
 */
export async function fetchSets() {
  // /sets returns all sets paged via has_more + next_page. In practice the
  // whole list fits in one response, but we loop defensively.
  const out = [];
  let url = `${API}/sets`;
  while (url) {
    const page = await fetchJson(url);
    if (!page?.data) break;
    for (const raw of page.data) {
      out.push(normalizeSetFromScryfall(raw));
    }
    url = page.has_more ? page.next_page : null;
    if (url) await throttle();
  }
  return out;
}

/**
 * Fetch one set's metadata by its raw Scryfall code (unprefixed) or
 * our prefixed code (`mtg-xxx`). Returns null if the set is unknown.
 */
export async function fetchSet(input) {
  const scryfallCode = String(input || '').replace(/^mtg-/i, '').toLowerCase();
  if (!scryfallCode) return null;
  const raw = await fetchJson(`${API}/sets/${encodeURIComponent(scryfallCode)}`);
  if (!raw) return null;
  return normalizeSetFromScryfall(raw);
}

/**
 * Fetch one set + all its printings (paged via /cards/search).
 *
 * Mirrors the shape returned by the TCGdex adapter so the ingest job can
 * reuse the same pipeline.
 *
 * @param {string} input - prefixed ('mtg-mkm') or raw ('mkm') set code
 * @returns {{
 *   set: object,
 *   cards: object[],
 *   variantsByCardId: Record<string, object[]>,
 *   legalitiesByCardId: Record<string, object[]>,
 *   mtgByCardId: Record<string, object>
 * }}
 */
export async function fetchSetAndCards(input) {
  const scryfallCode = String(input || '').replace(/^mtg-/i, '').toLowerCase();
  if (!scryfallCode) throw new Error('scryfall: set code required');

  const set = await fetchSet(scryfallCode);
  if (!set) throw new Error(`scryfall: set not found for code '${scryfallCode}'`);

  const rawCards = [];
  // unique=prints returns every printing (one row per m_cards row we want).
  // order=set + dir=asc keeps results stable for diffing.
  let url = `${API}/cards/search?q=${encodeURIComponent('set:' + scryfallCode)}` +
            `&unique=prints&order=set&dir=asc&include_extras=true&include_variations=true`;
  while (url) {
    const page = await fetchJson(url);
    if (!page?.data) break;
    for (const c of page.data) rawCards.push(c);
    url = page.has_more ? page.next_page : null;
    if (url) await throttle();
  }

  return splitScryfallCards(set, rawCards);
}

/**
 * Download Scryfall's `default_cards` bulk file.
 *
 * Returns the full card array. Scryfall ships ~90k printings; the raw file
 * is ~450 MB JSON. Node happily parses it in-process on a server with 2+ GB
 * free RAM; swap this for a streaming parser if memory ever gets tight.
 *
 * @param {object} [opts]
 * @param {('default_cards'|'oracle_cards'|'all_cards'|'unique_artwork'|'rulings')} [opts.type]
 */
export async function fetchBulkCards({ type = 'default_cards' } = {}) {
  const catalog = await fetchJson(`${API}/bulk-data`);
  if (!catalog?.data) throw new Error('scryfall: bulk-data index returned no data');

  const entry = catalog.data.find(d => d.type === type);
  if (!entry) throw new Error(`scryfall: bulk type '${type}' not found`);

  // The bulk file is served from data.scryfall.io (CDN) — no rate limit.
  const cards = await fetchJson(entry.download_uri, {
    tries: 2,
    timeoutMs: BULK_FETCH_TIMEOUT_MS,
    headers: { 'Accept': 'application/json' },
  });
  if (!Array.isArray(cards)) throw new Error('scryfall: bulk file did not deserialize to an array');

  return { cards, meta: entry };
}

/**
 * Group a flat array of Scryfall cards (from a bulk download) by their
 * set code. For each group yields the per-set bundle the ingest job
 * expects, synthesizing an m_sets row from the first card when a dedicated
 * /sets fetch wasn't made.
 *
 * Optionally overlay full set metadata (icon, card_count, block) from a
 * prior fetchSets() call via `setsByCode` keyed on the PREFIXED code.
 *
 * @param {object[]} cards
 * @param {object} [opts]
 * @param {Record<string, object>} [opts.setsByCode] - prefixed code → set row
 * @param {(group:{setCode:string, count:number}) => void} [opts.onGroup]
 */
export function* groupBulkCardsBySet(cards, { setsByCode = {}, onGroup } = {}) {
  // Partition into { prefixedCode → rawCards[] }
  const byCode = new Map();
  for (const c of cards) {
    if (!c?.set) continue;
    if (c.lang && c.lang !== 'en') continue;  // English-only for first pass
    const prefixed = prefixSetCode(c.set);
    if (!byCode.has(prefixed)) byCode.set(prefixed, []);
    byCode.get(prefixed).push(c);
  }

  for (const [prefixedCode, rawCards] of byCode) {
    const set = setsByCode[prefixedCode] || synthesizeSetFromCard(rawCards[0]);
    if (!set) continue;
    if (onGroup) onGroup({ setCode: prefixedCode, count: rawCards.length });
    yield splitScryfallCards(set, rawCards);
  }
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

/**
 * Walk an array of Scryfall card payloads and split them into the
 * {cards, variants, legalities, mtg} shape the ingest job writes to DB.
 */
function splitScryfallCards(set, rawCards) {
  const cards = [];
  const variantsByCardId = {};
  const legalitiesByCardId = {};
  const mtgByCardId = {};

  for (const raw of rawCards) {
    const card = normalizeCardFromScryfall(raw);
    if (!card?.id) continue;
    if (card.set_code !== set.code) continue;  // defensive — mixed-set payload
    cards.push(card);

    variantsByCardId[card.id] = detectVariantsFromScryfall(raw).map(v => ({
      card_id: card.id,
      variant: v.variant,
      display_name: v.display_name,
    }));

    legalitiesByCardId[card.id] = normalizeLegalitiesFromScryfall(raw).map(l => ({
      card_id: card.id,
      format: l.format,
      status: l.status,
    }));

    const mtg = normalizeMtgFieldsFromScryfall(raw);
    if (mtg) mtgByCardId[card.id] = { card_id: card.id, ...mtg };
  }

  return { set, cards, variantsByCardId, legalitiesByCardId, mtgByCardId };
}
