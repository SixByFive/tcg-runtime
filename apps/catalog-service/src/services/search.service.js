// Card search service — queries m_cards + m_sets with optional price join.

import { Op } from 'sequelize';
import { Card, Set, CardVariant, PriceLatest } from '../models/index.js';

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
    where.set_code = setCode;
  }
  if (rarity) {
    where.rarity = { [Op.like]: `%${rarity}%` };
  }
  if (supertype) {
    where.supertype = supertype;
  }

  const offset = (Math.max(1, page) - 1) * pageSize;
  const limit = Math.min(200, Math.max(1, pageSize));

  const SET_PUBLIC_ATTRS = ['code', 'name', 'era', 'release_date', 'set_logo', 'set_symbol'];
  const include = [{ model: Set, attributes: SET_PUBLIC_ATTRS }];

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
    const prices = await PriceLatest.findAll({
      where: { card_id: { [Op.in]: ids } },
      attributes: ['card_id', 'variant', 'price_gbp', 'median_gbp', 'updated_at'],
    });
    const priceMap = {};
    for (const p of prices) {
      const cid = p.card_id;
      if (!priceMap[cid]) priceMap[cid] = [];
      priceMap[cid].push({
        variant: p.variant,
        price_gbp: p.price_gbp,
        median_gbp: p.median_gbp,
        updated_at: p.updated_at,
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
 * Get a single card with full details.
 */
const SET_PUBLIC_ATTRS = ['code', 'name', 'era', 'release_date', 'set_logo', 'set_symbol'];

export async function getCard(cardId) {
  const card = await Card.findByPk(cardId, {
    include: [{ model: Set, attributes: SET_PUBLIC_ATTRS }],
  });
  if (!card) return null;

  const variants = await CardVariant.findAll({ where: { card_id: cardId } });
  const prices = await PriceLatest.findAll({ where: { card_id: cardId } });

  return {
    ...card.toJSON(),
    variants: variants.map(v => ({ variant: v.variant, display_name: v.display_name })),
    prices: prices.map(p => ({
      variant: p.variant,
      price_gbp: p.price_gbp,
      median_gbp: p.median_gbp,
      p10_gbp: p.p10_gbp,
      p90_gbp: p.p90_gbp,
      updated_at: p.updated_at,
    })),
  };
}

/**
 * List all sets.
 */
const SET_PUBLIC_ATTRS_LIST = ['code', 'name', 'era', 'release_date', 'abbreviation',
  'official_count', 'total_cards', 'set_logo', 'set_symbol', 'updated_at'];

export async function listSets({ era, page = 1, pageSize = 100 } = {}) {
  const where = era ? { era: { [Op.like]: `%${era}%` } } : {};
  const limit = Math.min(500, Math.max(1, pageSize));
  const offset = (Math.max(1, page) - 1) * limit;

  const { count, rows } = await Set.findAndCountAll({
    where,
    attributes: SET_PUBLIC_ATTRS_LIST,
    limit,
    offset,
    order: [['release_date', 'DESC']],
  });

  return {
    total: count,
    page,
    pageSize: limit,
    pages: Math.ceil(count / limit),
    sets: rows.map(r => r.toJSON()),
  };
}

/**
 * Get a single set with card count.
 */
export async function getSet(code) {
  const set = await Set.findByPk(code, { attributes: SET_PUBLIC_ATTRS_LIST });
  if (!set) return null;
  const cardCount = await Card.count({ where: { set_code: code } });
  return { ...set.toJSON(), cardCount };
}
