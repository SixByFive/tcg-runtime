/**
 * Cross-service read models for worker-service.
 *
 * All models point at tables owned by other services.
 * None of these are synced — tables already exist.
 */
import { DataTypes } from 'sequelize';
import { getSequelize } from '@sbf/database';

export let sequelize;
export let MarketplaceOrder, MarketplaceOffer, CardListing, Trade, PriceAlert;

let initialized = false;

export async function initModels() {
  if (initialized) return;
  sequelize = getSequelize();

  // ── marketplace_orders (marketplace-service) ───────────────────────────────
  MarketplaceOrder = sequelize.define('MarketplaceOrder', {
    id:                    { type: DataTypes.UUID, primaryKey: true },
    buyerId:               DataTypes.UUID,
    sellerId:              DataTypes.UUID,
    cardId:                DataTypes.STRING(80),
    totalAmount:           DataTypes.DECIMAL(10, 4),
    paymentStatus:         DataTypes.STRING,
    fulfilmentStatus:      DataTypes.STRING,
    stripePaymentIntentId: DataTypes.STRING,
    authorisedAt:          DataTypes.DATE,
    shippedAt:             DataTypes.DATE,
    metadataJson:          DataTypes.JSON,
  }, { tableName: 'marketplace_orders', timestamps: true });

  // ── offers (marketplace-service) ──────────────────────────────────────────
  MarketplaceOffer = sequelize.define('MarketplaceOffer', {
    id:        { type: DataTypes.UUID, primaryKey: true },
    listingId: DataTypes.UUID,
    buyerId:   DataTypes.UUID,
    amount:    DataTypes.DECIMAL(10, 4),
    status:    DataTypes.STRING,
    expiresAt: DataTypes.DATE,
  }, { tableName: 'offers', timestamps: true });

  // ── card_listings (marketplace-service) ───────────────────────────────────
  CardListing = sequelize.define('CardListing', {
    id:       { type: DataTypes.UUID, primaryKey: true },
    sellerId: DataTypes.UUID,
    cardId:   DataTypes.STRING(80),
    title:    DataTypes.STRING,
    price:    DataTypes.DECIMAL(10, 4),
    status:   DataTypes.STRING,
  }, { tableName: 'card_listings', timestamps: true });

  // ── trades (trading-service) ───────────────────────────────────────────────
  Trade = sequelize.define('Trade', {
    id:           { type: DataTypes.UUID, primaryKey: true },
    partyAId:     DataTypes.UUID,
    partyBId:     DataTypes.UUID,
    status:       DataTypes.STRING,
    topUpAmount:  DataTypes.DECIMAL(10, 4),
    topUpPaidBy:  DataTypes.UUID,
    topUpPaidAt:  DataTypes.DATE,
  }, { tableName: 'trades', timestamps: true });

  // ── price_alerts (catalog-service) ────────────────────────────────────────
  PriceAlert = sequelize.define('PriceAlert', {
    id:           { type: DataTypes.UUID, primaryKey: true },
    userId:       DataTypes.UUID,
    cardId:       DataTypes.STRING(80),
    variant:      DataTypes.STRING(80),
    currency:     DataTypes.CHAR(3),
    targetPrice:  DataTypes.DECIMAL(10, 4),
    enabled:      DataTypes.BOOLEAN,
    triggeredAt:  DataTypes.DATE,
    // Extended condition fields
    condition:    { type: DataTypes.STRING(20), defaultValue: 'below' },
    value:        DataTypes.DECIMAL(10, 4),
    windowHours:  { type: DataTypes.INTEGER, defaultValue: 24 },
    cooldownHours: { type: DataTypes.INTEGER, defaultValue: 24 },
    isActive:     { type: DataTypes.BOOLEAN, defaultValue: true },
  }, { tableName: 'price_alerts', timestamps: true });

  initialized = true;
}
