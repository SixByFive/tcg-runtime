import { DataTypes } from 'sequelize';

export default function defineTradeProof(sequelize) {
  return sequelize.define('TradeProof', {
    id:                { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tradeId:           { type: DataTypes.UUID, allowNull: false },
    userId:            { type: DataTypes.UUID, allowNull: false },
    proofImagePath:    { type: DataTypes.STRING, allowNull: false },
    proofCode:         { type: DataTypes.STRING(100), allowNull: true },
    uploadedAt:        { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    moderatedAt:       { type: DataTypes.DATE, allowNull: true },
    // 'approved' | 'pending_admin'
    moderationResult:  { type: DataTypes.STRING(20), defaultValue: 'pending_admin' },
  }, {
    tableName: 'trade_proofs',
    indexes: [
      { fields: ['tradeId'] },
      { fields: ['userId'] },
    ],
  });
}
