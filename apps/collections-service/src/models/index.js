import { getSequelize } from '@sbf/database';
import { defineCard } from './Card.js';
import { defineCollection } from './Collection.js';
import { defineWishlist } from './Wishlist.js';
import { defineBinder } from './Binder.js';
import { defineBinderPage } from './BinderPage.js';
import { defineBinderSlot } from './BinderSlot.js';

export let Card;
export let Collection;
export let Wishlist;
export let Binder;
export let BinderPage;
export let BinderSlot;
export let sequelize;

let initialized = false;

export async function initModels() {
  if (initialized) return;

  sequelize = getSequelize();

  Card = defineCard(sequelize);
  Collection = defineCollection(sequelize);
  Wishlist = defineWishlist(sequelize);
  Binder = defineBinder(sequelize);
  BinderPage = defineBinderPage(sequelize);
  BinderSlot = defineBinderSlot(sequelize);

  // Associations to Card use constraints: false because Card is a read-only reference
  // to the catalog-service's m_cards table. We never want Sequelize to create or
  // enforce a DB-level FK here — existing cardId values may predate catalog ingestion.
  Collection.belongsTo(Card, { foreignKey: 'cardId', targetKey: 'id', as: 'card', constraints: false });
  Wishlist.belongsTo(Card, { foreignKey: 'cardId', targetKey: 'id', as: 'card', constraints: false });
  Binder.hasMany(BinderPage, { foreignKey: 'binderId', as: 'pages' });
  BinderPage.belongsTo(Binder, { foreignKey: 'binderId' });
  BinderPage.hasMany(BinderSlot, { foreignKey: 'pageId', as: 'slots' });
  BinderSlot.belongsTo(BinderPage, { foreignKey: 'pageId' });
  BinderSlot.belongsTo(Card, { foreignKey: 'cardId', targetKey: 'id', as: 'card', constraints: false });

  // Use plain sync() in all environments — CREATE TABLE IF NOT EXISTS only.
  // alter:true re-adds indexes on every restart and eventually hits MySQL's
  // 64-key-per-table limit. Migrations handle schema changes instead.
  await Collection.sync({ force: false });
  await Wishlist.sync({ force: false });
  await Binder.sync({ force: false });
  await BinderPage.sync({ force: false });
  await BinderSlot.sync({ force: false });

  initialized = true;
}
