import { DataTypes } from 'sequelize';

export default function defineCardListing(sequelize) {
  return sequelize.define('CardListing', {
    id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    sellerId:    { type: DataTypes.UUID, allowNull: false },
    cardId:      { type: DataTypes.STRING(80), allowNull: false },
    title:       { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    condition: {
      type: DataTypes.ENUM('M', 'NM', 'LP', 'MP', 'HP', 'DMG'),
      allowNull: false,
    },
    variant:  { type: DataTypes.STRING(80), allowNull: true },
    price:    { type: DataTypes.DECIMAL(10, 4), allowNull: true },
    currency: { type: DataTypes.CHAR(3), defaultValue: 'GBP' },
    quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
    status: {
      type: DataTypes.ENUM('DRAFT', 'PENDING_PROOF', 'ACTIVE', 'SOLD', 'CANCELLED', 'REMOVED'),
      defaultValue: 'PENDING_PROOF',
    },

    // Proof verification
    proofCode:          { type: DataTypes.STRING(20), allowNull: true },
    proofCodeExpiresAt: { type: DataTypes.DATE, allowNull: true },
    proofImagePath:     { type: DataTypes.STRING, allowNull: true },
    proofUploadedAt:    { type: DataTypes.DATE, allowNull: true },
    moderationResult: {
      type: DataTypes.ENUM('pending', 'approved', 'pending_admin', 'rejected'),
      defaultValue: 'pending',
    },
    moderatedAt: { type: DataTypes.DATE, allowNull: true },

    // Shipping
    shippingType: {
      type: DataTypes.ENUM('FIXED', 'DYNAMIC'),
      defaultValue: 'FIXED',
    },
    shippingPrice: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
    parcelSize: {
      type: DataTypes.ENUM('LARGE_LETTER', 'SMALL_PARCEL', 'MEDIUM_PARCEL'),
      defaultValue: 'LARGE_LETTER',
    },

    labelPaidBy: {
      type: DataTypes.ENUM('seller', 'buyer'),
      defaultValue: 'seller',
    },

    // Offers / trading
    allowOffers:   { type: DataTypes.BOOLEAN, defaultValue: true },
    offerMinPrice: { type: DataTypes.DECIMAL(10, 4), allowNull: true },
    willTrade:     { type: DataTypes.BOOLEAN, defaultValue: false },

    // Post-sale
    sellerStripeAccountId: { type: DataTypes.STRING, allowNull: true },
    rating: { type: DataTypes.TINYINT, allowNull: true },
    review: { type: DataTypes.TEXT, allowNull: true },
    soldAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'card_listings',
    indexes: [
      { fields: ['sellerId'] },
      { fields: ['cardId'] },
      { fields: ['status'] },
      { fields: ['proofCode'] },
    ],
  });
}
