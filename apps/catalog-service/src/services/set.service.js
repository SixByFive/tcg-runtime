// DB-backed set resolver — looks up m_sets by tcgdex code or abbreviation.

import { Op } from 'sequelize';
import { Set } from '../models/index.js';

/**
 * Resolve a tcgdex code (e.g. 'sv08') or abbreviation (e.g. 'SSP') to a Set row.
 * Returns the Set Sequelize instance or null.
 */
export async function resolveSet(input) {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  const row = await Set.findOne({
    where: {
      [Op.or]: [
        { code: raw },
        { code: raw.toLowerCase() },
        { abbreviation: raw.toUpperCase() },
      ],
    },
  });

  return row ?? null;
}

/**
 * Returns just the tcgdex code (= DB primary key) for any input, or null.
 */
export async function resolveToTcgdex(input) {
  const row = await resolveSet(input);
  return row?.code ?? null;
}
