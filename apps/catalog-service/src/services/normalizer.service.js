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
  ['wpromo', 'wPromo'],
]);

// ---- Variant detail helpers ----

// Foils: slug → display label
const FOIL_LABELS = {
  pokeball:       'Poké Ball',
  greatball:      'Great Ball',
  ultraball:      'Ultra Ball',
  masterball:     'Master Ball',
  gold:           'Gold',
  cosmos:         'Cosmos',
  galaxy:         'Galaxy',
  starlight:      'Starlight',
  energy:         'Energy',
  crackedice:     'Cracked Ice',
  mirror:         'Mirror',
  league:         'League',
  playerreward:   'Player Reward',
  professorprogram: 'Professor Program',
  tinsel:         'Tinsel',
  loveball:       'Love Ball',
  friendball:     'Friend Ball',
  quickball:      'Quick Ball',
  teamrocket:     'Team Rocket',
  duskball:       'Dusk Ball',
};

// Stamps: raw TCGdex stamp → display label
const STAMP_LABELS = {
  '1st-edition':             '1st Edition',
  'w-promo':                 'W Promo',
  'pre-release':             'Pre-Release',
  'pokemon-center':          'Pokémon Center',
  'set-logo':                'Set Logo',
  'staff':                   'Staff',
  'pikachu-tail':            'Pikachu Tail',
  'wotc':                    'WotC',
  'd-edition-error':         'D-Edition Error',
  '1st-edition-scratch-error': '1st Edition Scratch Error',
  '1st-edition-error':       '1st Edition Error',
  '1st-movie':               '1st Movie',
  '1st-movie-inverted':      '1st Movie (Inverted)',
  'pokemon-4-ever':          'Pokémon 4Ever',
  'pokemon-center-ny':       'Pokémon Center NY',
  'winner':                  'Winner',
  '25th-celebration':        '25th Celebration',
  'snowflake':               'Snowflake',
  'trick-or-trade':          'Trick or Trade',
  'gamestop':                'GameStop',
  'eb-games':                'EB Games',
  'illustration-contest-2024': 'Illustration Contest 2024',
  'worlds-2025':             'Worlds 2025',
  'top-eight':               'Top 8',
  'champion':                'Champion',
  'master-ball-league':      'Master Ball League',
  'ultra-ball-league':       'Ultra Ball League',
  'judge':                   'Judge',
  'asia-promo':              'Asia Promo',
  'international-championship-europe': 'Intl Championship (Europe)',
  'international-championship-latin-america': 'Intl Championship (Latin America)',
  'international-championship-north-america': 'Intl Championship (North America)',
  'ace-trainer':             'Ace Trainer',
  'pokemon-day':             'Pokémon Day',
  'state-championships':     'State Championships',
  'national-championships':  'National Championships',
  'city-championships':      'City Championships',
  'gym-challenge':           'Gym Challenge',
  'regional-championships':  'Regional Championships',
  'international-championships': 'International Championships',
  'stadium-challenge':       'Stadium Challenge',
  '10th-anniversary':        '10th Anniversary',
  'player-rewards-program':  'Player Rewards Program',
  'top-sixteen':             'Top 16',
  'top-thirty-two':          'Top 32',
  'quarter-finalist':        'Quarter-Finalist',
  'semi-finalist':           'Semi-Finalist',
  'finalist':                'Finalist',
  'horizons':                'Horizons',
  'pikachu':                 'Pikachu',
  'bulbasaur':               'Bulbasaur',
  'squirtle':                'Squirtle',
  'charmander':              'Charmander',
  'pokeball':                'Poké Ball',
  'mcdonalds':               "McDonald's",
  'professor-program':       'Professor Program',
};

// Subtypes: raw TCGdex subtype → display label  (skip 'unlimited' — it's the default)
const SUBTYPE_LABELS = {
  'shadowless':              'Shadowless',
  '1999-2000-copyright':     '1999-2000 Copyright',
  'missing-expansion-symbol': 'Missing Expansion Symbol',
  'gold-border':             'Gold Border',
  'missing-hp':              'Missing HP',
  'aoki-error':              'Aoki Error',
  '1999-copyright':          '1999 Copyright',
  'evolution-box-error':     'Evolution Box Error',
  'no-holo-error':           'No Holo Error',
  'd-ink-dot-error':         'D-Ink Dot Error',
  'energy-symbol-error':     'Energy Symbol Error',
  'text-error':              'Text Error',
  'shifted-energy-cost':     'Shifted Energy Cost',
  'japanese-back':           'Japanese Back',
  'no-e-reader':             'No E-Reader',
  'rarity-error':            'Rarity Error',
  'cosmos':                  'Cosmos',
  'blue-border':             'Blue Border',
};

// Base type → display label
const TYPE_LABELS = {
  normal:    'Normal',
  holo:      'Holo',
  reverse:   'Reverse Holo',
  metal:     'Metal',
  lenticular: 'Lenticular',
};

/**
 * Slugify any raw string to a safe lowercase_underscore token.
 * Used for foil names and subtype names (which may contain hyphens/spaces).
 */
function slugify(raw) {
  return String(raw).trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '')   // strip non-alphanumeric entirely (pokeball, masterball, etc.)
}

/**
 * Slugify a stamp value, preserving multi-word structure with underscores.
 * Uses a lookup for special renames (1st-edition → first_edition).
 */
const STAMP_SLUG_OVERRIDES = {
  '1st-edition': 'first_edition',
  '1st-edition-error': 'first_edition_error',
  '1st-edition-scratch-error': 'first_edition_scratch_error',
  '1st-movie': 'first_movie',
  '1st-movie-inverted': 'first_movie_inverted',
};

function stampSlug(stamp) {
  const raw = String(stamp).trim().toLowerCase();
  return STAMP_SLUG_OVERRIDES[raw] ||
    raw.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function subtypeSlug(subtype) {
  return String(subtype).trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/**
 * Build a display name for a variant entry.
 * Format: "{BaseLabel} ({mod1}, {mod2}, …)" or just "{BaseLabel}"
 */
function variantDisplayName(entry) {
  const baseType = canonicalVariantKey(entry.type || 'normal', { fallback: 'normal' });
  const baseLabel = TYPE_LABELS[baseType] || baseType;

  const mods = [];

  // stamps (sorted for consistency)
  if (Array.isArray(entry.stamp) && entry.stamp.length) {
    for (const s of [...entry.stamp].sort()) {
      mods.push(
        STAMP_LABELS[s] ||
        s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      );
    }
  }

  // foil
  if (entry.foil) {
    const slug = slugify(entry.foil);
    mods.push(FOIL_LABELS[slug] || entry.foil.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
  }

  // subtype (skip 'unlimited' — that's the baseline)
  if (entry.subtype && entry.subtype !== 'unlimited') {
    mods.push(
      SUBTYPE_LABELS[entry.subtype] ||
      entry.subtype.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    );
  }

  return mods.length ? `${baseLabel} (${mods.join(', ')})` : baseLabel;
}

/**
 * Build a stable, unique variant key for a variant_detailed entry.
 *
 * Format: "{type}[-{mod1}[-{mod2}…]]"
 *  - Component separator:  "-"  (so formatVariation can split on it)
 *  - Within a component:   "_"  (e.g. "pre_release", "first_edition")
 *
 * Modifiers in order: stamps (sorted) → foil → subtype
 * Subtype "unlimited" is skipped (it's the default).
 */
function variantKey(entry) {
  const baseType = canonicalVariantKey(entry.type || 'normal', { fallback: 'normal' });
  const parts = [baseType];

  if (Array.isArray(entry.stamp) && entry.stamp.length) {
    for (const s of [...entry.stamp].sort()) parts.push(stampSlug(s));
  }

  if (entry.foil) parts.push(slugify(entry.foil));

  if (entry.subtype && entry.subtype !== 'unlimited') parts.push(subtypeSlug(entry.subtype));

  return parts.join('-');
}

/**
 * Build a { variant, display_name }[] list from TCGdex's variants_detailed array.
 * Handles all variant dimensions: type, stamp, foil, subtype.
 * De-duplicates by variant key (first wins).
 */
function buildFromDetailed(detailed) {
  const seen = new Set();
  const out  = [];

  for (const entry of detailed) {
    // Skip jumbo-only variants — they're collector items, not tradeable variants
    if (entry.size === 'jumbo') continue;

    const variant      = variantKey(entry);
    const display_name = variantDisplayName(entry);

    if (seen.has(variant)) continue;
    seen.add(variant);
    out.push({ variant, display_name });
  }

  return out;
}

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

/**
 * Returns [{ variant: string, display_name: string }] for a TCGdex card.
 *
 * Priority:
 *  1. variants_detailed  — most granular; handles foil sub-variants
 *  2. variants bool map  — e.g. { normal: true, holo: true, reverse: true }
 *  3. Rarity heuristics  — last resort
 */
export function detectVariantsWithNames(card) {
  // 1. variants_detailed  — separate field, most granular
  const detailed = card?.variants_detailed;
  if (Array.isArray(detailed) && detailed.length > 0) {
    const result = buildFromDetailed(detailed);
    if (result.length > 0) return result;
  }

  // 2. variants field — can be EITHER a boolean map OR Array<variant_detailed>
  const variantsField = card?.variants || card?.Variants;

  if (Array.isArray(variantsField) && variantsField.length > 0) {
    // variant_detailed array inside the variants field itself
    const result = buildFromDetailed(variantsField);
    if (result.length > 0) return result;
  }

  if (variantsField && typeof variantsField === 'object' && !Array.isArray(variantsField)) {
    // Boolean map: { normal: true, holo: false, reverse: true, … }
    const out = [];
    for (const [key, value] of Object.entries(variantsField)) {
      if (value === false || value == null) continue;
      const k = canonicalVariantKey(key, { fallback: null });
      if (!k) continue;
      const display_name = TYPE_LABELS[k] || (k.charAt(0).toUpperCase() + k.slice(1));
      out.push({ variant: k, display_name });
    }
    if (out.length > 0) return out;
  }

  // 3. Rarity heuristics — last resort
  const out = [{ variant: 'normal', display_name: 'Normal' }];
  const rarity = norm(card?.rarity, { lower: true });
  if (rarity.includes('reverse')) out.push({ variant: 'reverse', display_name: 'Reverse Holo' });
  if (rarity.includes('holo') || card?.holo === true) out.push({ variant: 'holo', display_name: 'Holo' });
  return out;
}

/** @deprecated Use detectVariantsWithNames instead */
export function detectVariantsForCard(card) {
  return detectVariantsWithNames(card).map(v => v.variant);
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
