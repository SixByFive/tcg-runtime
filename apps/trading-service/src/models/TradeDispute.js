import { DataTypes } from 'sequelize';

export default function defineTradeDispute(sequelize) {
  return sequelize.define('TradeDispute', {
    id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tradeId:      { type: DataTypes.UUID, allowNull: false },
    raisedById:   { type: DataTypes.UUID, allowNull: false },
    // 'open' | 'reviewing' | 'resolved' | 'rejected'
    status:       { type: DataTypes.STRING(20), defaultValue: 'open', allowNull: false },
    reason:       { type: DataTypes.TEXT, allowNull: false },
    resolution:   { type: DataTypes.TEXT, allowNull: true },
    resolvedAt:   { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'trade_disputes',
    indexes: [
      { fields: ['tradeId'] },
      { fields: ['raisedById'] },
      { fields: ['status'] },
    ],
  });
}
