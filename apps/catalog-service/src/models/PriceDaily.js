import { DataTypes } from 'sequelize';

export function definePriceDaily(sequelize) {
  return sequelize.define('PriceDaily', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    card_id: DataTypes.STRING(80),
    variant: DataTypes.STRING(40),
    price_date: DataTypes.DATEONLY,
    open_gbp: DataTypes.DECIMAL(10, 4),
    close_gbp: DataTypes.DECIMAL(10, 4),
    high_gbp: DataTypes.DECIMAL(10, 4),
    low_gbp: DataTypes.DECIMAL(10, 4),
    avg_gbp: DataTypes.DECIMAL(10, 4),
    volume: DataTypes.INTEGER,
  }, {
    tableName: 'm_price_daily',
    timestamps: false,
    indexes: [
      { unique: true, fields: ['card_id', 'variant', 'price_date'] },
      { fields: ['price_date'] },
    ],
  });
}
