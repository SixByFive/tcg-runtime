import { getSequelize } from '@sbf/database';
import defineCardListing    from './CardListing.js';
import defineOffer          from './Offer.js';
import defineOrder          from './Order.js';
import defineOrderDispute   from './OrderDispute.js';
import defineSellerProfile  from './SellerProfile.js';
import defineOwnershipRecord from './OwnershipRecord.js';
import defineUserReputation  from './UserReputation.js';

export let CardListing, Offer, Order, OrderDispute, SellerProfile, OwnershipRecord, UserReputation;
export let sequelize;

let initialized = false;

export async function initModels() {
  if (initialized) return;
  sequelize = getSequelize();

  CardListing     = defineCardListing(sequelize);
  Offer           = defineOffer(sequelize);
  Order           = defineOrder(sequelize);
  OrderDispute    = defineOrderDispute(sequelize);
  SellerProfile   = defineSellerProfile(sequelize);
  OwnershipRecord = defineOwnershipRecord(sequelize); // cross-service, no sync
  UserReputation  = defineUserReputation(sequelize);  // cross-service, no sync

  // Associations
  CardListing.hasMany(Offer,  { foreignKey: 'listingId', as: 'offers' });
  CardListing.hasMany(Order,  { foreignKey: 'listingId', as: 'orders' });
  Offer.belongsTo(CardListing, { foreignKey: 'listingId' });
  Order.hasOne(OrderDispute,   { foreignKey: 'orderId', as: 'dispute' });
  OrderDispute.belongsTo(Order, { foreignKey: 'orderId' });

  const syncOpts = process.env.NODE_ENV === 'development'
    ? { alter: true }
    : { force: false };

  await CardListing.sync(syncOpts);
  await Offer.sync(syncOpts);
  await Order.sync(syncOpts);
  await OrderDispute.sync(syncOpts);
  await SellerProfile.sync(syncOpts);
  // OwnershipRecord and UserReputation: cross-service, no sync

  initialized = true;
}
