import { DataTypes } from 'sequelize';

export default function defineOffer(sequelize) {
  return sequelize.define('Offer', {
    id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    listingId: { type: DataTypes.UUID, allowNull: false },
    buyerId:   { type: DataTypes.UUID, allowNull: false },
    amount:    { type: DataTypes.DECIMAL(10, 4), allowNull: false },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'declined', 'countered', 'expired', 'withdrawn'),
      defaultValue: 'pending',
    },
    message:        { type: DataTypes.TEXT, allowNull: true },
    counterAmount:  { type: DataTypes.DECIMAL(10, 4), allowNull: true },
    counterMessage: { type: DataTypes.TEXT, allowNull: true },
    expiresAt:         { type: DataTypes.DATE, allowNull: true },
    respondedAt:       { type: DataTypes.DATE, allowNull: true },
    buyerAddressJson:  { type: DataTypes.JSON, allowNull: true },
  }, {
    tableName: 'offers',
    indexes: [
      { fields: ['listingId'] },
      { fields: ['buyerId'] },
      { fields: ['status'] },
    ],
  });
}
