// Normalization utilities for sets, cards, variants, and prices.
// Pure functions — no I/O, no DB.

export function norm(input, { collapse = false, lower = false } = {}) {
  if (input == null) return '';
  let s = String(input).trim();
  if (collapse) s = s.replace(/\s+/g, ' ');
  if (lower) s = s.toLowerCase();
  return s;
}

export function toNullableString(v) {
  const s = norm(v);
  return s === '' ? null : s;
}

export function toInt(v) {
  const n = typeof v === 'number' ? v : Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

export function toNum(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function safeDateISO(v) {
  if (!v) return null;
  const d = new Date(v);
  const t = d.getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

export function normalizeNumber(v) {
  if (v == null) return '';
  return String(v).trim();
}

export function deriveCardId(setCode, number) {
  return `${norm(setCode)}-${normalizeNumber(number)}`;
}

// ---- Variant ----

const VARIANT_CANON_MAP = new Map([
  ['normal', 'normal'],
  ['standard', 'normal'],
  ['default', 'normal'],
  ['regular', 'normal'],
  ['reverse', 'reverse'],
  ['reverseholo', 'reverse'],
  ['reverseholofoil', 'reverse'],
  ['holoreverse', 'reverse'],
  ['reversefoil', 'reverse'],
  ['holo', 'holo'],
  ['holfoil', 'holo'],
  ['holofoil', 'holo'],
  ['shiny', 'holo'],
  ['foil', 'foil'],
  ['firstedition', 'firstEdition'],
  ['1stedition', 'firstEdition'],
  ['firsteditionholo', 'firstEdition'],
]);

export function canonicalVariantKey(raw, { fallback = 'normal' } = {}) {
  if (!raw) return fallback;
  const key = String(raw).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return VARIANT_CANON_MAP.get(key) || fallback;
}

export function canonicalVariantSet(variants) {
  if (!variants) return new Set(['normal']);
  const arr = Array.isArray(variants) ? variants : [variants];
  const out = new Set();
  for (const v of arr) {
    const k = canonicalVariantKey(v, { fallback: null });
    if (k) out.add(k);
  }
  if (out.size === 0) out.add('normal');
  return out;
}

export function detectVariantsForCard(card) {
  const out = new Set(['normal']);
  const rarity = norm(card?.rarity, { lower: true });
  if (rarity.includes('reverse')) out.add('reverse');
  if (rarity.includes('holo')) out.add('holo');
  if (card?.holo === true) out.add('holo');

  const variantsObj = card?.variants || card?.Variants;
  if (variantsObj && typeof variantsObj === 'object') {
    for (const [key, value] of Object.entries(variantsObj)) {
      if (value === false || value == null) continue;
      const k = canonicalVariantKey(key, { fallback: null });
      if (k) out.add(k);
    }
  }

  return Array.from(out);
}

// ---- Set normalizer (TCGdex shape) ----

export function normalizeSetFromTcgdex(raw, { abbr } = {}) {
  const code = norm(raw?.id || raw?.code);
  return {
    code,
    abbreviation: toNullableString(abbr || raw?.abbreviation),
    name: toNullableString(raw?.name) || code.toUpperCase(),
    era: toNullableString(raw?.serie?.name || raw?.serie) || null,
    release_date: safeDateISO(raw?.releasedAt || raw?.releaseDate),
    official_count: toInt(raw?.officialCount),
    total_cards: toInt(raw?.cardCount ?? raw?.total) || toInt(raw?.officialCount),
    set_logo: toNullableString(raw?.images?.logo || raw?.logo),
    set_symbol: toNullableString(raw?.images?.symbol || raw?.symbol),
    source_at: new Date().toISOString(),
    generator_version: 'tcgdex-v2',
  };
}

// ---- Card normalizer (TCGdex card shape) ----

export function normalizeCardFromTcgdex(raw, setCode) {
  const rawId = raw?.id || raw?.cardId || null;
  let id, number;

  if (rawId && String(rawId).includes('-')) {
    const parts = String(rawId).split('-');
    const inferredSet = parts[0];
    const inferredNum = parts.slice(1).join('-');
    id = `${inferredSet || setCode}-${inferredNum}`;
    number = inferredNum;
  } else {
    const local = raw?.localId ?? raw?.number ?? raw?.no ?? '';
    number = normalizeNumber(local);
    id = deriveCardId(setCode, number);
  }

  const images = {
    small: toNullableString(raw?.images?.small || raw?.image),
    large: toNullableString(raw?.images?.large || raw?.image),
  };

  return {
    id,
    set_code: setCode,
    number,
    name: toNullableString(raw?.name) || id,
    rarity: toNullableString(raw?.rarity),
    supertype: toNullableString(raw?.supertype),
    subtype: Array.isArray(raw?.subtypes) && raw.subtypes.length
      ? toNullableString(raw.subtypes[0])
      : toNullableString(raw?.subtype),
    regulation_mark: toNullableString(raw?.regulationMark || raw?.regulation),
    image_small: images.small,
    image_large: images.large,
    // pass-through for variant detection
    _raw: raw,
  };
}

// ---- Price blob normalizer ----

export function normalizePriceBlob(p, { defaultCurrency } = {}) {
  if (!p || typeof p !== 'object') {
    return { currency: null, market: null, low: null, mid: null, high: null };
  }

  const currency =
    normCcy(p.currency || p.curr || p.ccy) ||
    (p.usd ? 'USD' : p.eur ? 'EUR' : p.gbp ? 'GBP' : null) ||
    defaultCurrency || null;

  const low = firstNum(p.low, p.floor, p.min, p.p10, p.lowest, p.cheapest);
  const mid = firstNum(p.mid, p.median, p.avg, p.average);
  const high = firstNum(p.high, p.ceiling, p.max, p.p90, p.highest);
  const market = firstNum(p.market, p.price, p.value, mid, low, high);

  return { currency, market, low, mid, high };
}

function normCcy(x) {
  if (!x) return null;
  const s = String(x).trim().toUpperCase();
  return s || null;
}

function firstNum(...vals) {
  for (const v of vals) {
    const n = toNum(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}
