// Scryfall → catalog normalization. Pure functions, no I/O, no DB.
//
// Scryfall data shape reference: https://scryfall.com/docs/api/cards
//
// MTG set codes are stored with an `mtg-` prefix in m_sets.code to avoid
// collisions with Pokémon TCGdex set codes. Card IDs follow the same
// convention: `mtg-${scryfallSet}-${collectorNumber}`.

import {
  toNullableString,
  toInt,
  toNum,
  safeDateISO,
  normalizeNumber,
} from './normalizer.service.js';

export const MTG_SET_PREFIX = 'mtg-';

/** Add the mtg- prefix to a raw Scryfall set code (idempotent). */
export function prefixSetCode(code) {
  const c = String(code || '').trim().toLowerCase();
  if (!c) return '';
  return c.startsWith(MTG_SET_PREFIX) ? c : `${MTG_SET_PREFIX}${c}`;
}

/** Build a prefixed card id from a Scryfall card. */
export function deriveMtgCardId(scryfallCard) {
  const setCode = prefixSetCode(scryfallCard?.set);
  const number = normalizeNumber(scryfallCard?.collector_number);
  if (!setCode || !number) return null;
  return `${setCode}-${number}`;
}

// ---- Set normalizer ----

/**
 * Shape returned by GET /sets/{code} or GET /sets.
 * We also accept a card payload (bulk file) to synthesize a set row when
 * the dedicated /sets call wasn't made.
 */
export function normalizeSetFromScryfall(raw) {
  const prefixedCode = prefixSetCode(raw?.code);
  return {
    code: prefixedCode,
    game: 'mtg',
    abbreviation: toNullableString(raw?.code?.toUpperCase?.()),
    name: toNullableString(raw?.name) || prefixedCode.toUpperCase(),
    era: toNullableString(raw?.block || raw?.set_type) || null,
    release_date: safeDateISO(raw?.released_at),
    official_count: toInt(raw?.card_count),
    total_cards: toInt(raw?.card_count ?? raw?.printed_size),
    set_logo: toNullableString(raw?.icon_svg_uri),
    set_symbol: toNullableString(raw?.icon_svg_uri),
    source_at: new Date().toISOString(),
    generator_version: 'scryfall-v1',
  };
}

/**
 * Synthesize a set row from a card entry (useful when iterating the bulk
 * file without a separate /sets fetch).
 */
export function synthesizeSetFromCard(card) {
  if (!card?.set) return null;
  return normalizeSetFromScryfall({
    code: card.set,
    name: card.set_name,
    released_at: card.released_at,
    set_type: card.set_type,
    card_count: null,       // not present on card payload
    icon_svg_uri: null,
  });
}

// ---- Card normalizer ----

/**
 * Returns the Card row (fields in m_cards) for a Scryfall card.
 * `game` is set to 'mtg'. The `_raw` field passes the full card through for
 * downstream variant/legality/MTG-side-table normalization in the ingest job.
 */
export function normalizeCardFromScryfall(raw) {
  const id = deriveMtgCardId(raw);
  if (!id) return null;

  const setCode = prefixSetCode(raw.set);
  const number = normalizeNumber(raw.collector_number);

  // Double-faced cards (transform/modal_dfc/meld) carry image_uris on each
  // face, not on the top-level card. Use face 0's images for the summary row.
  const faces = Array.isArray(raw.card_faces) ? raw.card_faces : null;
  const imgSource = raw.image_uris || faces?.[0]?.image_uris || {};

  // Pick 'normal' for small (488px wide) and 'large' (672px) to roughly
  // match the TCGdex small/large resolutions downstream code expects.
  const image_small = toNullableString(imgSource.normal || imgSource.small);
  const image_large = toNullableString(imgSource.large || imgSource.png || imgSource.normal);

  return {
    id,
    game: 'mtg',
    set_code: setCode,
    number,
    name: toNullableString(raw.name) || id,
    rarity: toNullableString(raw.rarity),
    supertype: deriveSupertype(raw.type_line),
    subtype: deriveSubtypeString(raw.type_line),
    regulation_mark: null,
    image_small,
    image_large,
    _raw: raw,
  };
}

/**
 * MTG supertypes are the words before the em-dash in `type_line` and before
 * the primary card type. Scryfall's type_line uses an em-dash (—).
 *
 * Examples:
 *   "Legendary Creature — Human Wizard"     → "Legendary Creature"
 *   "Basic Land — Forest"                   → "Basic Land"
 *   "Instant"                               → "Instant"
 *   "Legendary Snow Creature — Human"       → "Legendary Snow Creature"
 */
function deriveSupertype(typeLine) {
  if (!typeLine) return null;
  const left = String(typeLine).split('—')[0]?.trim() || '';
  return left || null;
}

/**
 * Join everything right of the em-dash as a single space-separated subtype
 * string. The full array lives in m_card_mtg.type_line; this is a lossy
 * compat with the Pokémon-shaped m_cards.subtype column.
 *
 * Examples:
 *   "Legendary Creature — Human Wizard"  → "Human Wizard"
 *   "Instant"                            → null
 */
function deriveSubtypeString(typeLine) {
  if (!typeLine) return null;
  const parts = String(typeLine).split('—');
  if (parts.length < 2) return null;
  const right = parts.slice(1).join('—').trim();
  return right || null;
}

// ---- Variant detection ----

/**
 * Scryfall `finishes` is an array like ["nonfoil","foil","etched"].
 * One row per finish; display labels follow MTG player terminology.
 */
const FINISH_TO_VARIANT = {
  nonfoil: { variant: 'normal',  display_name: 'Normal' },
  foil:    { variant: 'foil',    display_name: 'Foil' },
  etched:  { variant: 'etched',  display_name: 'Foil Etched' },
};

export function detectVariantsFromScryfall(card) {
  const finishes = Array.isArray(card?.finishes) && card.finishes.length
    ? card.finishes
    : ['nonfoil'];
  const out = [];
  const seen = new Set();
  for (const f of finishes) {
    const entry = FINISH_TO_VARIANT[f];
    if (!entry || seen.has(entry.variant)) continue;
    seen.add(entry.variant);
    out.push(entry);
  }
  if (!out.length) out.push(FINISH_TO_VARIANT.nonfoil);
  return out;
}

// ---- Legalities ----

/**
 * Scryfall's `legalities` map has ~20 formats, each mapped to one of:
 *   'legal' | 'not_legal' | 'restricted' | 'banned'.
 *
 * Returns [{ format, status }] with every entry preserved so downstream
 * code can decide what to surface. Formats come through lowercased.
 */
export function normalizeLegalitiesFromScryfall(card) {
  const map = card?.legalities;
  if (!map || typeof map !== 'object') return [];
  const out = [];
  for (const [format, status] of Object.entries(map)) {
    if (!format || !status) continue;
    out.push({
      format: String(format).toLowerCase(),
      status: String(status).toLowerCase(),
    });
  }
  return out;
}

// ---- MTG side-table fields ----

export function normalizeMtgFieldsFromScryfall(card) {
  if (!card) return null;
  return {
    scryfall_id: toNullableString(card.id),
    oracle_id: toNullableString(card.oracle_id),
    lang: toNullableString(card.lang) || 'en',
    layout: toNullableString(card.layout),
    mana_cost: toNullableString(card.mana_cost),
    cmc: toNum(card.cmc),
    type_line: toNullableString(card.type_line),
    oracle_text: toNullableString(card.oracle_text),
    power: toNullableString(card.power),
    toughness: toNullableString(card.toughness),
    loyalty: toNullableString(card.loyalty),
    colors: Array.isArray(card.colors) ? card.colors : null,
    color_identity: Array.isArray(card.color_identity) ? card.color_identity : null,
    keywords: Array.isArray(card.keywords) ? card.keywords : null,
    produced_mana: Array.isArray(card.produced_mana) ? card.produced_mana : null,
    card_faces: Array.isArray(card.card_faces) && card.card_faces.length ? card.card_faces : null,
    promo_types: Array.isArray(card.promo_types) && card.promo_types.length ? card.promo_types : null,
    frame_effects: Array.isArray(card.frame_effects) && card.frame_effects.length ? card.frame_effects : null,
    border_color: toNullableString(card.border_color),
    collector_number: toNullableString(card.collector_number),
    released_at: safeDateISO(card.released_at),
  };
}

// ---- Price observations ----

/**
 * Scryfall provides prices across variants in a single `prices` object.
 * Returns an array of observations ready for m_price_observations, one per
 * (variant, currency) that has a non-null amount.
 *
 * Shape:
 *   { card_id, variant, source: 'scryfall', currency, amount, observed_at }
 *
 * amount_gbp stays null — the fx-daily job backfills GBP conversions.
 */
export function normalizePriceObservationsFromScryfall(card, cardId, { observedAt } = {}) {
  const p = card?.prices;
  if (!p || typeof p !== 'object') return [];
  const stamp = observedAt || new Date().toISOString();
  const rows = [];

  const pushIf = (variant, currency, amount) => {
    const n = toNum(amount);
    if (n == null) return;
    rows.push({
      card_id: cardId,
      variant,
      source: 'scryfall',
      currency,
      amount: n,
      amount_gbp: null,
      observed_at: stamp,
    });
  };

  pushIf('normal', 'USD', p.usd);
  pushIf('foil',   'USD', p.usd_foil);
  pushIf('etched', 'USD', p.usd_etched);
  pushIf('normal', 'EUR', p.eur);
  pushIf('foil',   'EUR', p.eur_foil);
  // tix (MTGO tickets) intentionally skipped — different market.

  return rows;
}
