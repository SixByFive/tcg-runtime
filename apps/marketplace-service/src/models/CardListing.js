import { DataTypes } from 'sequelize';

export default function defineCardListing(sequelize) {
  return sequelize.define('CardListing', {
    id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    sellerId:    { type: DataTypes.UUID, allowNull: false },
    // cardId: required for SINGLE and (optionally) BULK_TRACKED items; null for BULK_RANDOM
    cardId:      { type: DataTypes.STRING(80), allowNull: true },
    title:       { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    // condition: single lot-wide condition (SINGLE only); bulk uses conditionMin/Max
    condition: {
      type: DataTypes.ENUM('M', 'NM', 'LP', 'MP', 'HP', 'DMG'),
      allowNull: true,
    },
    variant:  { type: DataTypes.STRING(80), allowNull: true },

    // Listing kind — selects which fields are meaningful
    listingKind: {
      type: DataTypes.ENUM('SINGLE', 'BULK_TRACKED', 'BULK_RANDOM'),
      allowNull: false,
      defaultValue: 'SINGLE',
    },
    // Bulk condition range (bulk kinds only)
    conditionMin: {
      type: DataTypes.ENUM('M', 'NM', 'LP', 'MP', 'HP', 'DMG'),
      allowNull: true,
    },
    conditionMax: {
      type: DataTypes.ENUM('M', 'NM', 'LP', 'MP', 'HP', 'DMG'),
      allowNull: true,
    },
    cardCount:                { type: DataTypes.INTEGER, allowNull: true },
    guaranteedInclusionsJson: { type: DataTypes.JSON,    allowNull: true },
    lotPhotoPath:             { type: DataTypes.STRING,  allowNull: true },
    isReturnable:             { type: DataTypes.BOOLEAN, defaultValue: true },

    price:    { type: DataTypes.DECIMAL(10, 4), allowNull: true },
    currency: { type: DataTypes.CHAR(3), defaultValue: 'GBP' },
    quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
    status: {
      type: DataTypes.ENUM('DRAFT', 'PENDING_PROOF', 'ACTIVE', 'SOLD', 'CANCELLED', 'REMOVED'),
      defaultValue: 'PENDING_PROOF',
    },

    // Batch listing
    batchId:            { type: DataTypes.UUID, allowNull: true },

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
    // null = approved (default/legacy); 'pending' = anomaly hold; 'disputed' = seller flagged; 'voided' = admin rejected
    reviewStatus: {
      type: DataTypes.ENUM('pending', 'disputed', 'voided', 'approved'),
      allowNull: true,
    },
    disputeReason: { type: DataTypes.TEXT, allowNull: true },
    soldAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'card_listings',
    indexes: [
      { fields: ['sellerId'] },
      { fields: ['cardId'] },
      { fields: ['status'] },
      { fields: ['proofCode'] },
      { fields: ['listingKind'] },
    ],
  });
}
