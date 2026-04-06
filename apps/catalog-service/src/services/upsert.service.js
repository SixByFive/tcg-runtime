// Idempotent DB upserts for catalog entities.

import { Op } from 'sequelize';
import { getSequelize } from '@sbf/database';
import { Set, Card, CardVariant, PriceObservation, PriceLatest } from '../models/index.js';

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
