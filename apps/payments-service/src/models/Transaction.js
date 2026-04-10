import { DataTypes } from 'sequelize';

/**
 * Unified payment transaction ledger.
 * Records every financial event: subscription payments, product purchases, refunds.
 *
 * sourceType / sourceId link back to the originating record:
 *   subscription → UserSubscription.id
 *   product      → Stripe checkout session id
 *   marketplace  → marketplace_orders.id (written by marketplace-service, not here)
 */
export default function defineTransaction(sequelize) {
  return sequelize.define('Transaction', {
    id:                    { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId:                { type: DataTypes.UUID, allowNull: false },
    type: {
      type: DataTypes.ENUM(
        'subscription_payment',
        'subscription_refund',
        'product_purchase',
        'product_refund',
      ),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
      defaultValue: 'pending',
    },
    amount:                { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    currency:              { type: DataTypes.CHAR(3), defaultValue: 'GBP' },
    description:           { type: DataTypes.STRING, allowNull: true },
    stripePaymentIntentId: { type: DataTypes.STRING, allowNull: true },
    stripeChargeId:        { type: DataTypes.STRING, allowNull: true },
    stripeInvoiceId:       { type: DataTypes.STRING, allowNull: true },
    sourceType:            { type: DataTypes.STRING(40), allowNull: true },
    sourceId:              { type: DataTypes.STRING, allowNull: true },
    metadataJson:          { type: DataTypes.JSON, allowNull: true },
  }, {
    tableName: 'payment_transactions',
    indexes: [
      { fields: ['userId'] },
      { fields: ['type'] },
      { fields: ['stripePaymentIntentId'] },
      { fields: ['stripeInvoiceId'] },
    ],
  });
}
