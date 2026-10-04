// MTG ingestion from Scryfall into m_sets / m_cards / m_card_variants /
// m_card_legality / m_card_mtg (and m_price_observations).
//
// Two entry points:
//   ingestMtgSet({ input })  — one set at a time via /cards/search
//   ingestMtgBulk()          — the full catalog via /bulk-data default_cards

import { Op } from 'sequelize';
import { getSequelize } from '@sbf/database';
import { Card, CardVariant, CardLegality, CardMtg } from '../models/index.js';
import {
  fetchSetAndCards,
  fetchSets,
  fetchBulkCards,
  groupBulkCardsBySet,
} from '../adapters/scryfall.adapter.js';
import {
  upsertSet,
  bulkUpsertCardMtg,
  syncLegalitiesForCards,
} from '../services/upsert.service.js';
import { invalidateSetCache } from '../services/search.service.js';
import { createLogger } from '@sbf/logger';

const logger = createLogger('catalog:ingest-mtg');

function emptyResult(setCode) {
  return {
    ok: true,
    setCode,
    counts: {
      cards: { scanned: 0, inserted: 0, updated: 0, deleted: 0 },
      variants: { upserted: 0, deletedStale: 0 },
      legalities: { upserted: 0, deletedStale: 0 },
      mtg: { upserted: 0 },
    },
    ms: 0,
  };
}

/**
 * Shared transactional writer: given a Scryfall bundle (set + cards +
 * variants + legalities + mtg side-table rows), diff against DB and
 * sync in one transaction.
 */
async function writeBundleToDb(bundle) {
  const { set, cards, variantsByCardId, legalitiesByCardId, mtgByCardId } = bundle;
  const result = emptyResult(set.code);
  result.counts.cards.scanned = cards.length;

  const sequelize = getSequelize();
  await sequelize.transaction(async t => {
    await upsertSet(set, { transaction: t });

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
      await CardLegality.destroy({ where: { card_id: { [Op.in]: toDelete } }, transaction: t });
      await CardMtg.destroy({ where: { card_id: { [Op.in]: toDelete } }, transaction: t });
      await Card.destroy({ where: { id: { [Op.in]: toDelete } }, transaction: t });
    }

    const upsertFields = ['game', 'name', 'rarity', 'supertype', 'subtype',
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

    // Variants
    const allCardIds = Object.keys(variantsByCardId).filter(id => desiredIds.has(id));
    const desiredVariants = [];
    for (const card_id of allCardIds) {
      for (const v of (variantsByCardId[card_id] || [])) {
        desiredVariants.push({
          card_id,
          variant: String(v.variant || v).toLowerCase(),
          display_name: v.display_name || v.variant || v,
        });
      }
    }
    if (desiredVariants.length) {
      await CardVariant.bulkCreate(desiredVariants, {
        transaction: t,
        updateOnDuplicate: ['display_name'],
      });
    }
    if (allCardIds.length) {
      const existingVariants = await CardVariant.findAll({
        where: { card_id: { [Op.in]: allCardIds } },
        attributes: ['card_id', 'variant'],
        transaction: t,
      });
      const desiredSet = new Set(desiredVariants.map(v => `${v.card_id}::${v.variant}`));
      const stale = existingVariants.filter(r => !desiredSet.has(`${r.card_id}::${r.variant}`));
      if (stale.length) {
        await CardVariant.destroy({
          where: { [Op.or]: stale.map(r => ({ card_id: r.card_id, variant: r.variant })) },
          transaction: t,
        });
      }
      result.counts.variants.deletedStale = stale.length;
    }

    // Legalities
    const desiredLegalities = [];
    for (const card_id of Object.keys(legalitiesByCardId || {})) {
      if (!desiredIds.has(card_id)) continue;
      for (const l of (legalitiesByCardId[card_id] || [])) {
        desiredLegalities.push({ card_id, format: l.format, status: l.status });
      }
    }
    const legalityIds = Array.from(new Set(desiredLegalities.map(l => l.card_id)));
    const legSync = await syncLegalitiesForCards(legalityIds, desiredLegalities, { transaction: t });

    // MTG side table
    const mtgRows = Object.values(mtgByCardId || {}).filter(r => desiredIds.has(r.card_id));
    const mtgSync = await bulkUpsertCardMtg(mtgRows, { transaction: t });

    result.counts.cards.inserted = toInsert.length;
    result.counts.cards.updated = toUpdate.length;
    result.counts.cards.deleted = toDelete.length;
    result.counts.variants.upserted = desiredVariants.length;
    result.counts.legalities = legSync;
    result.counts.mtg = mtgSync;
  });

  invalidateSetCache();
  return result;
}

/**
 * Ingest a single MTG set from Scryfall (via /cards/search).
 *
 * @param {object} opts
 * @param {string} opts.input - set code, raw ('mkm') or prefixed ('mtg-mkm')
 * @param {boolean} [opts.dryRun]
 */
export async function ingestMtgSet({ input, dryRun = false } = {}) {
  if (!input) throw new Error('ingestMtgSet: input is required');
  const started = Date.now();

  const bundle = await fetchSetAndCards(input);

  if (dryRun) {
    const r = emptyResult(bundle.set.code);
    r.counts.cards.scanned = bundle.cards.length;
    r.ms = Date.now() - started;
    return r;
  }

  const result = await writeBundleToDb(bundle);
  result.ms = Date.now() - started;
  return result;
}

/**
 * Ingest every MTG printing from Scryfall's default_cards bulk file.
 *
 * Streams per-set progress to `onSetDone` so callers can relay NDJSON back
 * to the admin UI without waiting for the whole catalog.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.dryRun]
 * @param {string[]} [opts.only]       - restrict to these prefixed set codes
 * @param {string[]} [opts.skip]       - exclude these prefixed set codes
 * @param {(evt: object) => void} [opts.onSetDone]
 * @param {object} [opts.logger]
 */
export async function ingestMtgBulk({
  dryRun = false,
  only,
  skip,
  onSetDone,
  logger: log = logger,
} = {}) {
  const started = Date.now();
  log.info('ingestMtgBulk: fetching /sets metadata …');
  const sets = await fetchSets();
  const setsByCode = Object.fromEntries(sets.map(s => [s.code, s]));
  log.info(`ingestMtgBulk: ${sets.length} sets catalogued`);

  log.info('ingestMtgBulk: downloading default_cards bulk …');
  const { cards, meta } = await fetchBulkCards({ type: 'default_cards' });
  log.info(`ingestMtgBulk: bulk file size ${meta.size} bytes, ${cards.length} card rows`);

  const onlySet = only?.length ? new Set(only.map(c => c.toLowerCase())) : null;
  const skipSet = skip?.length ? new Set(skip.map(c => c.toLowerCase())) : null;

  const perSet = [];
  let succeeded = 0;
  let failed = 0;

  for (const bundle of groupBulkCardsBySet(cards, { setsByCode })) {
    const code = bundle.set.code;
    if (onlySet && !onlySet.has(code)) continue;
    if (skipSet && skipSet.has(code)) continue;

    if (dryRun) {
      const r = emptyResult(code);
      r.counts.cards.scanned = bundle.cards.length;
      perSet.push(r);
      if (onSetDone) onSetDone({ code, ok: true, cards: r.counts.cards.scanned, dryRun: true });
      succeeded++;
      continue;
    }

    try {
      const r = await writeBundleToDb(bundle);
      perSet.push(r);
      succeeded++;
      log.info(`ingestMtgBulk: ${code} — scanned=${r.counts.cards.scanned} inserted=${r.counts.cards.inserted} updated=${r.counts.cards.updated} deleted=${r.counts.cards.deleted}`);
      if (onSetDone) onSetDone({ code, ok: true, counts: r.counts });
    } catch (err) {
      failed++;
      log.error(`ingestMtgBulk: ${code} failed — ${err.message}`);
      if (onSetDone) onSetDone({ code, ok: false, error: err.message });
    }
  }

  return {
    ok: true,
    sets: perSet.length,
    succeeded,
    failed,
    bulkUpdatedAt: meta.updated_at,
    perSet,
    ms: Date.now() - started,
  };
}
