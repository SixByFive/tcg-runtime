import { DataTypes } from 'sequelize';

// Read-only reference to catalog-service's m_cards table.
// Collections-service never writes here; this exists only for JOIN associations.
export function defineCard(sequelize) {
  return sequelize.define(
    'Card',
    {
      id: { type: DataTypes.STRING(80), primaryKey: true },
      set_code: DataTypes.STRING(32),
      number: DataTypes.STRING(16),
      name: DataTypes.STRING(200),
      rarity: DataTypes.STRING(80),
      image_small: DataTypes.TEXT,
      image_large: DataTypes.TEXT,
      supertype: DataTypes.STRING(40),
      subtype: DataTypes.STRING(80),
    },
    {
      tableName: 'm_cards',
      timestamps: false,
      // Never sync this table from this service
      freezeTableName: true,
    },
  );
}
