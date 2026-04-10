import { DataTypes } from 'sequelize';

/**
 * Cross-service reference to ownership_records table (owned by trading-service).
 * Marketplace-service writes SALE_COMPLETED and LISTING_VERIFIED records here.
 * No sync — table is managed by trading-service.
 */
export default function defineOwnershipRecord(sequelize) {
  return sequelize.define('OwnershipRecord', {
    id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    cardId:     { type: DataTypes.STRING(80), allowNull: false },
    ownerId:    { type: DataTypes.UUID, allowNull: false },
    eventType: {
      type: DataTypes.ENUM('LISTING_VERIFIED', 'SALE_COMPLETED', 'TRADE_COMPLETED', 'DISPUTE_RESOLVED'),
      allowNull: false,
    },
    sourceType: { type: DataTypes.STRING(20), allowNull: false },
    sourceId:   { type: DataTypes.UUID, allowNull: false },
    proofCode:  { type: DataTypes.STRING(20), allowNull: true },
  }, {
    tableName: 'ownership_records',
    updatedAt: false,
  });
}
