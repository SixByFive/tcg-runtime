// Rebuild price rollups for a set, card, or all cards.

import { rebuildRollupsForSet, rebuildRollupsForCard, rebuildRollupsAll } from '../services/rollup.service.js';

export async function rebuildPriceRollups({ scope = 'all', set, cardId, variant, asOf, batchSize } = {}) {
  const started = Date.now();

  let result;
  if (scope === 'set' && set) {
    result = await rebuildRollupsForSet(set, { asOf, batchSize });
  } else if (scope === 'card' && cardId) {
    result = await rebuildRollupsForCard(cardId, { asOf });
  } else {
    result = await rebuildRollupsAll({ asOf, batchSize });
  }

  return { ...result, ms: Date.now() - started };
}
