import { DataTypes } from 'sequelize';

// Append-only ownership ledger — never update or delete rows.
export default function defineOwnershipRecord(sequelize) {
  return sequelize.define('OwnershipRecord', {
    id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    cardId:     { type: DataTypes.STRING(80), allowNull: false },
    ownerId:    { type: DataTypes.UUID, allowNull: false },
    eventType:  { type: DataTypes.STRING(40), allowNull: false },  // TRADE_COMPLETED | DISPUTE_RESOLVED
    sourceType: { type: DataTypes.STRING(20), allowNull: false },  // TRADE
    sourceId:   { type: DataTypes.UUID, allowNull: false },
    proofCode:  { type: DataTypes.STRING(100), allowNull: true },
  }, {
    tableName: 'ownership_records',
    updatedAt: false,
    indexes: [
      { fields: ['cardId'] },
      { fields: ['ownerId'] },
      { fields: ['cardId', 'createdAt'] },
      { fields: ['sourceId', 'sourceType'] },
    ],
  });
}
