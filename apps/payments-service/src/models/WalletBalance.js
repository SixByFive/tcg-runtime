import { DataTypes } from 'sequelize';

/**
 * One row per user. balancePence is the spendable available balance (in pence).
 * heldPence is the amount currently locked in trade escrow.
 * Total wallet value = balancePence + heldPence.
 */
export default function defineWalletBalance(sequelize) {
  return sequelize.define('WalletBalance', {
    id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId:       { type: DataTypes.UUID, allowNull: false, unique: true },
    balancePence: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    heldPence:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    currency:     { type: DataTypes.CHAR(3), defaultValue: 'GBP', allowNull: false },
  }, {
    tableName: 'wallet_balances',
    indexes: [{ fields: ['userId'], unique: true }],
  });
}
