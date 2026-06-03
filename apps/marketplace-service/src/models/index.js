import { getSequelize } from '@sbf/database';
import defineCardListing    from './CardListing.js';
import defineOffer          from './Offer.js';
import defineOrder          from './Order.js';
import defineOrderDispute   from './OrderDispute.js';
import defineSellerProfile  from './SellerProfile.js';
import defineOwnershipRecord from './OwnershipRecord.js';
import defineUserReputation  from './UserReputation.js';
import defineProductListing  from './ProductListing.js';
import defineInventoryItem   from './InventoryItem.js';
import defineMarketplaceAgreement from './MarketplaceAgreement.js';
import defineUserProfile from './UserProfile.js';

export let CardListing, Offer, Order, OrderDispute, SellerProfile, OwnershipRecord, UserReputation;
export let ProductListing, InventoryItem;
export let MarketplaceAgreement, UserProfile;
export let sequelize;

let initialized = false;

export async function initModels() {
  if (initialized) return;
  sequelize = getSequelize();

  CardListing          = defineCardListing(sequelize);
  Offer                = defineOffer(sequelize);
  Order                = defineOrder(sequelize);
  OrderDispute         = defineOrderDispute(sequelize);
  SellerProfile        = defineSellerProfile(sequelize);
  OwnershipRecord      = defineOwnershipRecord(sequelize); // cross-service, no sync
  UserReputation       = defineUserReputation(sequelize);  // cross-service, no sync
  ProductListing       = defineProductListing(sequelize);
  InventoryItem        = defineInventoryItem(sequelize);
  MarketplaceAgreement = defineMarketplaceAgreement(sequelize);
  UserProfile          = defineUserProfile(sequelize);         // cross-service, no sync

  // Associations
  CardListing.hasMany(Offer,  { foreignKey: 'listingId', as: 'offers' });
  CardListing.hasMany(Order,  { foreignKey: 'listingId', as: 'orders' });
  Offer.belongsTo(CardListing, { foreignKey: 'listingId' });
  Order.hasOne(OrderDispute,   { foreignKey: 'orderId', as: 'dispute' });
  OrderDispute.belongsTo(Order, { foreignKey: 'orderId' });
  ProductListing.hasOne(InventoryItem, { foreignKey: 'productListingId', as: 'inventory' });
  InventoryItem.belongsTo(ProductListing, { foreignKey: 'productListingId' });

  // Use plain sync() in all environments — CREATE TABLE IF NOT EXISTS only.
  // alter:true re-adds indexes and FK constraints on every restart, which
  // causes ER_TOO_MANY_KEYS and FK constraint failures on tables with
  // existing data. Migrations handle schema changes instead.
  await CardListing.sync({ force: false });
  await Offer.sync({ force: false });
  await Order.sync({ force: false });
  await OrderDispute.sync({ force: false });
  await SellerProfile.sync({ force: false });
  await ProductListing.sync({ force: false });
  await InventoryItem.sync({ force: false });
  await MarketplaceAgreement.sync({ force: false });
  // OwnershipRecord and UserReputation: cross-service, no sync

  initialized = true;
}
