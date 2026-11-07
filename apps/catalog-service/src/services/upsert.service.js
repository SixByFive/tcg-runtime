// Idempotent DB upserts for catalog entities.

import { Op } from 'sequelize';
import { getSequelize } from '@sbf/database';
import { Set, Card, CardVariant, CardLegality, CardMtg, PriceObservation, PriceLatest } from '../models/index.js';

export async function upsertSet(setRow, { transaction } = {}) {
  const t = transaction || null;
  const existing = await Set.findOne({ where: { code: setRow.code }, transaction: t });
  if (!existing) {
    await Set.create(setRow, { transaction: t });
    return { inserted: true, updated: false };
  }

  const next = {};
  const updateFields = ['abbreviation', 'name', 'era', 'release_date', 'total_cards',
    'official_count', 'set_logo', 'set_symbol', 'source_at', 'generator_version'];
  let dirty = false;
  for (const f of updateFields) {
    const nv = setRow[f] ?? null;
    if ((existing.get(f) ?? null) !== nv && nv !== null) {
      next[f] = nv;
      dirty = true;
    }
  }
  if (dirty) {
    await existing.update(next, { transaction: t });
    return { inserted: false, updated: true };
  }
  return { inserted: false, updated: false };
}

export async function bulkUpsertCards(cardRows, { transaction } = {}) {
  const t = transaction || null;
  if (!cardRows?.length) return { inserted: 0, updated: 0 };

  await Card.bulkCreate(
    cardRows.map(r => ({ ...r, _raw: undefined })),
    {
      transaction: t,
      updateOnDuplicate: ['name', 'rarity', 'supertype', 'subtype',
        'regulation_mark', 'image_small', 'image_large', 'set_code', 'number'],
    },
  );

  return { inserted: cardRows.length, updated: 0 };
}

export async function syncVariantsForSet(setCode, variantsByCardId, { transaction } = {}) {
  const t = transaction || null;
  const cardIds = Object.keys(variantsByCardId).filter(id => id.startsWith(`${setCode}-`));
  if (!cardIds.length) return { upserted: 0, deletedStale: 0 };

  const desired = [];
  for (const card_id of cardIds) {
    for (const v of (variantsByCardId[card_id] || [])) {
      desired.push({
        card_id,
        variant: String(v.variant || v).toLowerCase(),
        display_name: v.display_name || v.variant || v,
      });
    }
  }

  await CardVariant.bulkCreate(desired, {
    transaction: t,
    updateOnDuplicate: ['display_name'],
  });

  // Delete stale variants
  const existingRows = await CardVariant.findAll({
    where: { card_id: { [Op.in]: cardIds } },
    attributes: ['card_id', 'variant'],
    transaction: t,
  });
  const desiredSet = new Set(desired.map(v => `${v.card_id}::${v.variant}`));
  const toDelete = existingRows
    .filter(r => !desiredSet.has(`${r.card_id}::${r.variant}`))
    .map(r => ({ card_id: r.card_id, variant: r.variant }));

  if (toDelete.length) {
    await CardVariant.destroy({
      where: { [Op.or]: toDelete },
      transaction: t,
    });
  }

  return { upserted: desired.length, deletedStale: toDelete.length };
}

/**
 * Bulk-upsert the m_card_mtg side table rows for a batch of MTG cards.
 * Expects each row to carry `card_id` as the primary key.
 */
export async function bulkUpsertCardMtg(mtgRows, { transaction } = {}) {
  const t = transaction || null;
  if (!mtgRows?.length) return { upserted: 0 };

  await CardMtg.bulkCreate(mtgRows, {
    transaction: t,
    updateOnDuplicate: [
      'scryfall_id', 'oracle_id', 'lang', 'layout', 'mana_cost', 'cmc',
      'type_line', 'oracle_text', 'power', 'toughness', 'loyalty',
      'colors', 'color_identity', 'keywords', 'produced_mana',
      'card_faces', 'promo_types', 'frame_effects',
      'border_color', 'collector_number', 'released_at',
    ],
  });

  return { upserted: mtgRows.length };
}

/**
 * Sync legality rows for a set of cards. Behaves like syncVariantsForSet:
 * upserts the desired rows, deletes anything stale for the same card_ids.
 *
 * @param {string[]} cardIds - card_ids whose legalities are being replaced
 * @param {Array<{card_id,format,status}>} desired
 */
export async function syncLegalitiesForCards(cardIds, desired, { transaction } = {}) {
  const t = transaction || null;
  if (!cardIds?.length) return { upserted: 0, deletedStale: 0 };

  if (desired.length) {
    await CardLegality.bulkCreate(desired, {
      transaction: t,
      updateOnDuplicate: ['status'],
    });
  }

  const existingRows = await CardLegality.findAll({
    where: { card_id: { [Op.in]: cardIds } },
    attributes: ['card_id', 'format'],
    transaction: t,
  });
  const desiredSet = new Set(desired.map(l => `${l.card_id}::${l.format}`));
  const toDelete = existingRows
    .filter(r => !desiredSet.has(`${r.card_id}::${r.format}`))
    .map(r => ({ card_id: r.card_id, format: r.format }));

  if (toDelete.length) {
    await CardLegality.destroy({
      where: { [Op.or]: toDelete },
      transaction: t,
    });
  }

  return { upserted: desired.length, deletedStale: toDelete.length };
}

export async function upsertPriceObservation(row, { transaction } = {}) {
  const t = transaction || null;
  await PriceObservation.create(row, { transaction: t });
}

export async function upsertPriceLatest(row, { transaction } = {}) {
  const t = transaction || null;
  await PriceLatest.upsert(row, { transaction: t });
}

export async function runInTransaction(fn, opts = {}) {
  if (opts.transaction) return fn(opts.transaction);
  return getSequelize().transaction(t => fn(t));
}
