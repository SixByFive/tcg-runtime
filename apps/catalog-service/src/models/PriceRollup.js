import { DataTypes } from 'sequelize';

export function definePriceRollup(sequelize) {
  return sequelize.define('PriceRollup', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    card_id: DataTypes.STRING(80),
    variant: DataTypes.STRING(40),
    days: DataTypes.INTEGER,
    avg_gbp: DataTypes.DECIMAL(10, 4),
    min_gbp: DataTypes.DECIMAL(10, 4),
    max_gbp: DataTypes.DECIMAL(10, 4),
    last_gbp: DataTypes.DECIMAL(10, 4),
    computed_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'm_price_rollups',
    timestamps: false,
    indexes: [
      { unique: true, fields: ['card_id', 'variant', 'days'] },
      { fields: ['card_id'] },
    ],
  });
}
