import { DataTypes } from 'sequelize';

export default function defineTradeBan(sequelize) {
  return sequelize.define('TradeBan', {
    userId:   { type: DataTypes.UUID, primaryKey: true },
    reason:   { type: DataTypes.TEXT, allowNull: true },
    bannedBy: { type: DataTypes.UUID, allowNull: false },
    bannedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'trade_bans',
    timestamps: false,
  });
}
