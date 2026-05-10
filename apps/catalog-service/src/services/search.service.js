// Card search service — queries m_cards + m_sets with optional price join.

import { Op, QueryTypes } from 'sequelize';
import { getSequelize } from '@sbf/database';
import { Card, Set, CardVariant } from '../models/index.js';

// ── In-process set cache (TTL = 5 min) ───────────────────────────────────────
const SET_CACHE_TTL_MS = 5 * 60 * 1000;
const _setCache = new Map(); // key → { value, expiresAt }

function cacheGet(key) {
  const entry = _setCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) { _setCache.delete(key); return undefined; }
  return entry.value;
}
function cacheSet(key, value) {
  _setCache.set(key, { value, expiresAt: Date.now() + SET_CACHE_TTL_MS });
}
/** Call after any ingest/update so the next request re-reads from DB. */
export function invalidateSetCache() { _setCache.clear(); }

/**
 * Search cards with optional filters.
 * @param {object} params
 * @param {string} [params.q]        - Name search (partial, case-insensitive)
 * @param {string} [params.setCode]  - Filter by set code
 * @param {string} [params.rarity]   - Filter by rarity
 * @param {string} [params.supertype]
 * @param {boolean} [params.withPrices] - Include latest price snapshot
 * @param {number} [params.page]
 * @param {number} [params.pageSize]
 */
export async function searchCards({ q, setCode, rarity, supertype, withPrices = false, page = 1, pageSize = 50 } = {}) {
  const where = {};

  if (q) {
    where.name = { [Op.like]: `%${q}%` };
  }
  if (setCode) {
    // Accept either the internal set code (e.g. "sv08") or its abbreviation (e.g. "SSP")
    const resolvedSet = await Set.findOne({
      where: { [Op.or]: [{ code: setCode }, { abbreviation: setCode }] },
      attributes: ['code'],
    });
    where.set_code = resolvedSet ? resolvedSet.code : setCode;
  }
  if (rarity) {
    where.rarity = { [Op.like]: `%${rarity}%` };
  }
  if (supertype) {
    where.supertype = supertype;
  }

  const offset = (Math.max(1, page) - 1) * pageSize;
  const limit = Math.min(1500, Math.max(1, pageSize));

  const SET_PUBLIC_ATTRS = ['code', 'name', 'era', 'release_date', 'set_logo', 'set_symbol'];
  const include = [
    { model: Set, attributes: SET_PUBLIC_ATTRS },
    { model: CardVariant, attributes: ['variant', 'display_name'] },
  ];

  const { count, rows } = await Card.findAndCountAll({
    where,
    include,
    limit,
    offset,
    order: [['set_code', 'ASC'], ['number', 'ASC']],
  });

  let cards = rows.map(r => r.toJSON());

  if (withPrices && cards.length) {
    const ids = cards.map(c => c.id);
    // Query the latest observation per (card_id, variant, source) so every
    // provider (tcgplayer, cardmarket, …) is returned as a separate entry.
    const sequelize = getSequelize();
    const prices = await sequelize.query(
      `SELECT po.card_id, po.variant, po.source,
              COALESCE(po.amount_gbp, po.amount) AS amount_gbp,
              po.observed_at
       FROM m_price_observations po
       INNER JOIN (
         SELECT card_id, variant, source, MAX(observed_at) AS max_at
         FROM m_price_observations
         WHERE card_id IN (:ids)
         GROUP BY card_id, variant, source
       ) latest
         ON po.card_id  = latest.card_id
        AND po.variant  = latest.variant
        AND po.source   = latest.source
        AND po.observed_at = latest.max_at`,
      { replacements: { ids }, type: QueryTypes.SELECT },
    );
    const priceMap = {};
    for (const p of prices) {
      if (!priceMap[p.card_id]) priceMap[p.card_id] = [];
      priceMap[p.card_id].push({
        variant:    p.variant,
        source:     p.source,
        amount_gbp: p.amount_gbp,
        updated_at: p.observed_at,
      });
    }
    cards = cards.map(c => ({ ...c, prices: priceMap[c.id] || [] }));
  }

  return {
    total: count,
    page,
    pageSize: limit,
    pages: Math.ceil(count / limit),
    cards,
  };
}

/**
 * Fetch multiple cards by ID in a single query (for gateway hydration).
 * Returns the same shape as searchCards rows (with variants + prices).
 * @param {string[]} ids
 */
export async function getCardsByIds(ids) {
  if (!Array.isArray(ids) || !ids.length) return [];
  const safeIds = ids.slice(0, 500); // hard cap

  const SET_PUBLIC_ATTRS_BATCH = ['code', 'name', 'era', 'release_date', 'set_logo', 'set_symbol'];
  const rows = await Card.findAll({
    where: { id: { [Op.in]: safeIds } },
    include: [
      { model: Set, attributes: SET_PUBLIC_ATTRS_BATCH },
      { model: CardVariant, attributes: ['variant', 'display_name'] },
    ],
  });

  let cards = rows.map(r => r.toJSON());

  if (cards.length) {
    const sequelize = getSequelize();
    const prices = await sequelize.query(
      `SELECT po.card_id, po.variant, po.source,
              COALESCE(po.amount_gbp, po.amount) AS amount_gbp,
              po.observed_at
       FROM m_price_observations po
       INNER JOIN (
         SELECT card_id, variant, source, MAX(observed_at) AS max_at
         FROM m_price_observations
         WHERE card_id IN (:ids)
         GROUP BY card_id, variant, source
       ) latest
         ON po.card_id  = latest.card_id
        AND po.variant  = latest.variant
        AND po.source   = latest.source
        AND po.observed_at = latest.max_at`,
      { replacements: { ids: safeIds }, type: QueryTypes.SELECT },
    );
    const priceMap = {};
    for (const p of prices) {
      if (!priceMap[p.card_id]) priceMap[p.card_id] = [];
      priceMap[p.card_id].push({
        variant:    p.variant,
        source:     p.source,
        amount_gbp: p.amount_gbp,
        updated_at: p.observed_at,
      });
    }
    cards = cards.map(c => ({ ...c, prices: priceMap[c.id] || [] }));
  }

  return cards;
}

/**
 * Get a single card with full details.
 */
const SET_PUBLIC_ATTRS = ['code', 'name', 'era', 'release_date', 'set_logo', 'set_symbol'];

export async function getCard(cardId) {
  const card = await Card.findByPk(cardId, {
    include: [{ model: Set, attributes: SET_PUBLIC_ATTRS }],
  });
  if (!card) return null;

  const variants = await CardVariant.findAll({ where: { card_id: cardId } });

  const sequelize = getSequelize();
  const prices = await sequelize.query(
    `SELECT po.card_id, po.variant, po.source,
            COALESCE(po.amount_gbp, po.amount) AS amount_gbp,
            po.observed_at
     FROM m_price_observations po
     INNER JOIN (
       SELECT card_id, variant, source, MAX(observed_at) AS max_at
       FROM m_price_observations
       WHERE card_id = :cardId
       GROUP BY card_id, variant, source
     ) latest
       ON po.card_id      = latest.card_id
      AND po.variant      = latest.variant
      AND po.source       = latest.source
      AND po.observed_at  = latest.max_at`,
    { replacements: { cardId }, type: QueryTypes.SELECT },
  );

  return {
    ...card.toJSON(),
    variants: variants.map(v => ({ variant: v.variant, display_name: v.display_name })),
    prices: prices.map(p => ({
      variant:    p.variant,
      source:     p.source,
      amount_gbp: p.amount_gbp,
      updated_at: p.observed_at,
    })),
  };
}

/**
 * List all sets.
 */
const SET_PUBLIC_ATTRS_LIST = ['code', 'name', 'era', 'release_date', 'abbreviation',
  'official_count', 'total_cards', 'set_logo', 'set_symbol', 'updated_at'];

export async function listSets({ era, page = 1, pageSize = 100 } = {}) {
  const limit = Math.min(500, Math.max(1, pageSize));
  const offset = (Math.max(1, page) - 1) * limit;
  const cacheKey = `list:${era || ''}:${limit}:${offset}`;

  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const where = era ? { era: { [Op.like]: `%${era}%` } } : {};
  const { count, rows } = await Set.findAndCountAll({
    where,
    attributes: SET_PUBLIC_ATTRS_LIST,
    limit,
    offset,
    order: [['release_date', 'DESC']],
  });

  const result = {
    total: count,
    page,
    pageSize: limit,
    pages: Math.ceil(count / limit),
    sets: rows.map(r => r.toJSON()),
  };
  cacheSet(cacheKey, result);
  return result;
}

/**
 * Get a single set with card count.
 */
export async function getSet(code) {
  const cacheKey = `set:${code}`;

  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const set = await Set.findByPk(code, { attributes: SET_PUBLIC_ATTRS_LIST });
  if (!set) return null;
  const cardCount = await Card.count({ where: { set_code: code } });
  const result = { ...set.toJSON(), cardCount };
  cacheSet(cacheKey, result);
  return result;
}
