// Ingest a single set from TCGdex into m_sets, m_cards, m_card_variants.

import { Op } from 'sequelize';
import { getSequelize } from '@sbf/database';
import { Card, CardVariant } from '../models/index.js';
import { fetchSetAndCards } from '../adapters/tcgdex.adapter.js';
import { upsertSet } from '../services/upsert.service.js';
import { invalidateSetCache } from '../services/search.service.js';

export async function ingestSet({ input, refresh = false, dryRun = false } = {}) {
  if (!input) throw new Error('ingestSet: input is required');
  const started = Date.now();

  const { set, cards, variantsByCardId } = await fetchSetAndCards(input);

  const result = {
    ok: true,
    setCode: set.code,
    counts: {
      cards: { scanned: cards.length, inserted: 0, updated: 0, deleted: 0 },
      variants: { upserted: 0, deletedStale: 0 },
    },
    ms: 0,
  };

  if (dryRun) {
    result.ms = Date.now() - started;
    return result;
  }

  const sequelize = getSequelize();
  await sequelize.transaction(async t => {
    await upsertSet(set, { transaction: t });

    // Card diff
    const existingRows = await Card.findAll({
      where: { set_code: set.code },
      attributes: ['id'],
      transaction: t,
    });
    const existingIds = new Set(existingRows.map(r => r.get('id')));
    const desiredIds = new Set(cards.filter(c => c?.id).map(c => c.id));

    const toInsert = cards.filter(c => c?.id && !existingIds.has(c.id));
    const toUpdate = cards.filter(c => c?.id && existingIds.has(c.id));
    const toDelete = Array.from(existingIds).filter(id => !desiredIds.has(id));

    if (toDelete.length) {
      await CardVariant.destroy({ where: { card_id: { [Op.in]: toDelete } }, transaction: t });
      await Card.destroy({ where: { id: { [Op.in]: toDelete } }, transaction: t });
    }

    const upsertFields = ['name', 'rarity', 'supertype', 'subtype',
      'regulation_mark', 'image_small', 'image_large', 'set_code', 'number'];

    const cardRowsClean = [...toInsert, ...toUpdate].map(c => {
      const { _raw, ...row } = c;
      return row;
    });

    if (cardRowsClean.length) {
      await Card.bulkCreate(cardRowsClean, {
        transaction: t,
        updateOnDuplicate: upsertFields,
      });
    }

    // Variant sync
    const allCardIds = Object.keys(variantsByCardId).filter(id => id.startsWith(`${set.code}-`));
    const desired = [];
    for (const card_id of allCardIds) {
      for (const v of (variantsByCardId[card_id] || [])) {
        desired.push({
          card_id,
          variant: String(v.variant || v).toLowerCase(),
          display_name: v.display_name || v.variant || v,
        });
      }
    }

    if (desired.length) {
      await CardVariant.bulkCreate(desired, {
        transaction: t,
        updateOnDuplicate: ['display_name'],
      });
    }

    // Delete stale variants
    if (allCardIds.length) {
      const existingVariants = await CardVariant.findAll({
        where: { card_id: { [Op.in]: allCardIds } },
        attributes: ['card_id', 'variant'],
        transaction: t,
      });
      const desiredSet = new Set(desired.map(v => `${v.card_id}::${v.variant}`));
      const stale = existingVariants.filter(r => !desiredSet.has(`${r.card_id}::${r.variant}`));
      if (stale.length) {
        await CardVariant.destroy({
          where: { [Op.or]: stale.map(r => ({ card_id: r.card_id, variant: r.variant })) },
          transaction: t,
        });
      }
      result.counts.variants.deletedStale = stale.length;
    }

    result.counts.cards.inserted = toInsert.length;
    result.counts.cards.updated = toUpdate.length;
    result.counts.cards.deleted = toDelete.length;
    result.counts.variants.upserted = desired.length;
  });

  invalidateSetCache();
  result.ms = Date.now() - started;
  return result;
}
