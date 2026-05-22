import { DataTypes } from 'sequelize';

export default function defineOrder(sequelize) {
  return sequelize.define('Order', {
    id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    listingId: { type: DataTypes.UUID, allowNull: false },
    buyerId:   { type: DataTypes.UUID, allowNull: false },
    sellerId:  { type: DataTypes.UUID, allowNull: false },
    cardId:    { type: DataTypes.STRING(80), allowNull: false },
    offerId:   { type: DataTypes.UUID, allowNull: true },

    // Pricing (stored in pounds)
    salePrice:    { type: DataTypes.DECIMAL(10, 4), allowNull: false },
    platformFee:  { type: DataTypes.DECIMAL(10, 4), defaultValue: 0 },
    shippingCost: { type: DataTypes.DECIMAL(8, 2),  defaultValue: 0 },
    totalAmount:  { type: DataTypes.DECIMAL(10, 4), allowNull: false },
    currency:     { type: DataTypes.CHAR(3), defaultValue: 'GBP' },

    paymentStatus: {
      type: DataTypes.ENUM('pending', 'authorised', 'captured', 'refunded', 'cancelled'),
      defaultValue: 'pending',
    },
    fulfilmentStatus: {
      type: DataTypes.ENUM('awaiting_shipment', 'shipped', 'completed', 'cancelled'),
      defaultValue: 'awaiting_shipment',
    },

    // Stripe
    stripePaymentIntentId: { type: DataTypes.STRING, allowNull: true },
    stripeClientSecret:    { type: DataTypes.STRING, allowNull: true },
    sellerStripeAccountId: { type: DataTypes.STRING, allowNull: true },

    // Fulfilment
    trackingNumber:   { type: DataTypes.STRING, allowNull: true },
    trackingCarrier:  { type: DataTypes.STRING, allowNull: true },
    shippingLabelUrl: { type: DataTypes.STRING, allowNull: true },
    shippingLabelId:  { type: DataTypes.UUID,   allowNull: true },

    // Wallet contribution (pence)
    walletAmountPence: { type: DataTypes.INTEGER, defaultValue: 0 },

    // Addresses (JSON snapshots at time of purchase)
    buyerAddressJson:  { type: DataTypes.JSON, allowNull: true },
    sellerAddressJson: { type: DataTypes.JSON, allowNull: true },
    metadataJson:      { type: DataTypes.JSON, allowNull: true },

    // Timestamps
    authorisedAt: { type: DataTypes.DATE, allowNull: true },
    capturedAt:   { type: DataTypes.DATE, allowNull: true },
    shippedAt:    { type: DataTypes.DATE, allowNull: true },
    completedAt:  { type: DataTypes.DATE, allowNull: true },
    cancelledAt:  { type: DataTypes.DATE, allowNull: true },
    cancelledBy:  { type: DataTypes.UUID, allowNull: true },
    cancelReason: { type: DataTypes.STRING, allowNull: true },
    adminNotes:   { type: DataTypes.TEXT, allowNull: true },
  }, {
    tableName: 'marketplace_orders',
    indexes: [
      { fields: ['buyerId'] },
      { fields: ['sellerId'] },
      { fields: ['listingId'] },
      { fields: ['stripePaymentIntentId'] },
      { fields: ['paymentStatus'] },
    ],
  });
}
