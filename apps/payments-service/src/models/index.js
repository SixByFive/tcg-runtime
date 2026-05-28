import { getSequelize } from '@sbf/database';
import defineSubscriptionPlan  from './SubscriptionPlan.js';
import defineUserSubscription  from './UserSubscription.js';
import defineTransaction       from './Transaction.js';
import defineWalletBalance     from './WalletBalance.js';
import defineWalletTransaction from './WalletTransaction.js';

export let SubscriptionPlan, UserSubscription, Transaction;
export let WalletBalance, WalletTransaction;
export let sequelize;

let initialized = false;

export async function initModels() {
  if (initialized) return;
  sequelize = getSequelize();

  SubscriptionPlan   = defineSubscriptionPlan(sequelize);
  UserSubscription   = defineUserSubscription(sequelize);
  Transaction        = defineTransaction(sequelize);
  WalletBalance      = defineWalletBalance(sequelize);
  WalletTransaction  = defineWalletTransaction(sequelize);

  UserSubscription.belongsTo(SubscriptionPlan, { foreignKey: 'planId', as: 'plan' });
  SubscriptionPlan.hasMany(UserSubscription,   { foreignKey: 'planId', as: 'subscriptions' });

  // In development use plain sync() — CREATE TABLE IF NOT EXISTS only.
  // alter:true re-adds indexes on every restart and eventually hits MySQL's
  // 64-key-per-table limit. Migrations handle schema changes instead.
  const syncOpts = { force: false };

  await SubscriptionPlan.sync(syncOpts);
  await UserSubscription.sync(syncOpts);
  await Transaction.sync(syncOpts);
  await WalletBalance.sync(syncOpts);
  await WalletTransaction.sync(syncOpts);

  initialized = true;
}
