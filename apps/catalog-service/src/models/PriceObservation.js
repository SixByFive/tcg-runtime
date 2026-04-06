import { DataTypes } from 'sequelize';

export function definePriceObservation(sequelize) {
  return sequelize.define('PriceObservation', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    card_id: DataTypes.STRING(80),
    variant: DataTypes.STRING(40),
    source: DataTypes.STRING(64),
    currency: DataTypes.STRING(8),
    amount: DataTypes.DECIMAL(10, 4),
    amount_gbp: DataTypes.DECIMAL(10, 4),
    observed_at: DataTypes.DATE,
  }, {
    tableName: 'm_price_observations',
    timestamps: false,
    indexes: [
      { fields: ['card_id', 'variant'] },
      { fields: ['observed_at'] },
      { fields: ['card_id', 'variant', 'observed_at'] },
    ],
  });
}
