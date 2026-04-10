import { DataTypes } from 'sequelize';

export default function defineOrderDispute(sequelize) {
  return sequelize.define('OrderDispute', {
    id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    orderId:     { type: DataTypes.UUID, allowNull: false },
    raisedById:  { type: DataTypes.UUID, allowNull: false },
    reason:      { type: DataTypes.TEXT, allowNull: false },
    evidenceJson: { type: DataTypes.JSON, allowNull: true },
    status: {
      type: DataTypes.ENUM('open', 'reviewing', 'resolved', 'rejected'),
      defaultValue: 'open',
    },
    resolution:         { type: DataTypes.TEXT, allowNull: true },
    resolvedInFavourOf: { type: DataTypes.ENUM('buyer', 'seller'), allowNull: true },
    // Records what Stripe action was taken for audit trail
    escrowActionTaken: {
      type: DataTypes.ENUM('cancelled', 'captured', 'refunded'),
      allowNull: true,
    },
    resolvedAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'order_disputes',
    indexes: [
      { fields: ['orderId'] },
      { fields: ['status'] },
    ],
  });
}
