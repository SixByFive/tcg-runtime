import { DataTypes } from 'sequelize';

export function definePriceAlert(sequelize) {
  return sequelize.define('PriceAlert', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    cardId: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    variant: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    currency: {
      type: DataTypes.CHAR(3),
      defaultValue: 'GBP',
      allowNull: false,
    },
    targetPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    triggeredAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'price_alerts',
    indexes: [
      { fields: ['userId'] },
      { fields: ['cardId', 'variant'] },
      { unique: true, fields: ['userId', 'cardId', 'variant', 'currency'] },
    ],
  });
}
