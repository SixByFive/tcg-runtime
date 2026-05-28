import { DataTypes } from 'sequelize';

/**
 * Immutable ledger of every wallet event.
 *
 * Types:
 *   topup        — user topped up via Stripe PaymentIntent (credit)
 *   trade_hold   — funds held in escrow when trade locks (debit from available)
 *   trade_credit — funds received when a trade completes (credit)
 *   trade_refund — held funds returned when a trade is cancelled (credit back)
 *   withdrawal   — future: user withdraws to bank (debit)
 */
export default function defineWalletTransaction(sequelize) {
  return sequelize.define('WalletTransaction', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    type: {
      type: DataTypes.ENUM(
        'topup',
        'trade_hold', 'trade_credit', 'trade_refund', 'trade_debit',
        'sale_credit',
        'purchase_spend', 'purchase_refund',
        'withdrawal',
        'adjustment',
      ),
      allowNull: false,
    },
    // Always a positive integer representing the absolute amount in pence.
    // Whether it credits or debits the balance is determined by the type.
    amountPence: { type: DataTypes.INTEGER, allowNull: false },
    currency:    { type: DataTypes.CHAR(3), defaultValue: 'GBP', allowNull: false },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed'),
      defaultValue: 'pending',
      allowNull: false,
    },
    description:           { type: DataTypes.STRING,  allowNull: true },
    relatedTradeId:        { type: DataTypes.UUID,    allowNull: true },
    relatedOrderId:        { type: DataTypes.UUID,    allowNull: true },
    stripePaymentIntentId: { type: DataTypes.STRING,  allowNull: true },
    metadataJson:          { type: DataTypes.JSON,    allowNull: true },
  }, {
    tableName: 'wallet_transactions',
    indexes: [
      { fields: ['userId'] },
      { fields: ['relatedTradeId'] },
      { fields: ['stripePaymentIntentId'] },
      { fields: ['type'] },
    ],
  });
}
