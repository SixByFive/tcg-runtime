import { DataTypes } from 'sequelize';

export function definePriceLatest(sequelize) {
  return sequelize.define('PriceLatest', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    card_id: DataTypes.STRING(80),
    variant: DataTypes.STRING(40),
    price_gbp: DataTypes.DECIMAL(10, 4),
    median_gbp: DataTypes.DECIMAL(10, 4),
    p10_gbp: DataTypes.DECIMAL(10, 4),
    p90_gbp: DataTypes.DECIMAL(10, 4),
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'm_price_latest',
    timestamps: false,
    indexes: [
      { unique: true, fields: ['card_id', 'variant'] },
      { fields: ['card_id'] },
    ],
  });
}
