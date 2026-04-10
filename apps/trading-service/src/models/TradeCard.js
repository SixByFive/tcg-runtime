import { DataTypes } from 'sequelize';

export default function defineTradeCard(sequelize) {
  return sequelize.define('TradeCard', {
    id:       { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tradeId:  { type: DataTypes.UUID, allowNull: false },
    userId:   { type: DataTypes.UUID, allowNull: false }, // owner of the card
    cardId:   { type: DataTypes.STRING(80), allowNull: false },
    quantity: { type: DataTypes.INTEGER, defaultValue: 1, allowNull: false },
    condition:{ type: DataTypes.STRING(32), allowNull: true },
    variation:{ type: DataTypes.STRING(64), allowNull: true },
    notes:    { type: DataTypes.TEXT, allowNull: true },
  }, {
    tableName: 'trade_cards',
    indexes: [
      { fields: ['tradeId'] },
      { fields: ['userId'] },
    ],
  });
}
