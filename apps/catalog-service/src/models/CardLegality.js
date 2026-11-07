import { DataTypes } from 'sequelize';

/**
 * Per-card legality for a single format.
 *
 * One row per (card_id, format). `status` is Scryfall's four-value scale:
 *   - 'legal'       — playable
 *   - 'not_legal'   — never printed in this format
 *   - 'restricted'  — legal, limited to one copy (vintage)
 *   - 'banned'      — explicitly banned
 *
 * For Pokémon we only emit 'legal' / 'not_legal' rows derived from the
 * TCGdex regulation mark + legality_std/exp/unl flags.
 */
export function defineCardLegality(sequelize) {
  return sequelize.define('CardLegality', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    card_id: DataTypes.STRING(80),
    format: DataTypes.STRING(32),
    status: DataTypes.STRING(16),
  }, {
    tableName: 'm_card_legality',
    timestamps: false,
    indexes: [
      { unique: true, fields: ['card_id', 'format'] },
      { fields: ['card_id'] },
      { fields: ['format', 'status'] },
    ],
  });
}
