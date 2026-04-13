import { DataTypes } from 'sequelize';

export default function defineShippingLabel(sequelize) {
  return sequelize.define('ShippingLabel', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    externalLabelId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    trackingNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    carrier: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    service: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
    },
    currency: {
      type: DataTypes.STRING(8),
      defaultValue: 'GBP',
    },
    labelUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    qrCodeUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(32),
      defaultValue: 'SUCCESS',
    },
    refundStatus: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    refundedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    relatedType: {
      type: DataTypes.STRING(32),
      allowNull: true, // 'Trade' | 'Order'
    },
    relatedId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    meta: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  }, {
    tableName: 'shipping_labels',
    indexes: [
      { fields: ['userId'] },
      { fields: ['relatedType', 'relatedId'] },
      { fields: ['externalLabelId'] },
    ],
  });
}
