import { getSequelize } from '@sbf/database';
import { defineSet } from './Set.js';
import { defineCard } from './Card.js';
import { defineCardVariant } from './CardVariant.js';
import { defineCardLegality } from './CardLegality.js';
import { defineCardMtg } from './CardMtg.js';
import { definePriceObservation } from './PriceObservation.js';
import { definePriceDaily } from './PriceDaily.js';
import { definePriceLatest } from './PriceLatest.js';
import { definePriceRollup } from './PriceRollup.js';
import { defineSchedulerTask } from './SchedulerTask.js';
import { definePriceAlert } from './PriceAlert.js';

export let Set;
export let Card;
export let CardVariant;
export let CardLegality;
export let CardMtg;
export let PriceObservation;
export let PriceDaily;
export let PriceLatest;
export let PriceRollup;
export let SchedulerTask;
export let PriceAlert;

export async function initModels() {
  const sequelize = getSequelize();

  Set = defineSet(sequelize);
  Card = defineCard(sequelize);
  CardVariant = defineCardVariant(sequelize);
  CardLegality = defineCardLegality(sequelize);
  CardMtg = defineCardMtg(sequelize);
  PriceObservation = definePriceObservation(sequelize);
  PriceDaily = definePriceDaily(sequelize);
  PriceLatest = definePriceLatest(sequelize);
  PriceRollup = definePriceRollup(sequelize);
  SchedulerTask = defineSchedulerTask(sequelize);
  PriceAlert = definePriceAlert(sequelize);

  // Associations
  Set.hasMany(Card, { foreignKey: 'set_code', sourceKey: 'code' });
  Card.belongsTo(Set, { foreignKey: 'set_code', targetKey: 'code' });
  Card.hasMany(CardVariant, { foreignKey: 'card_id', sourceKey: 'id' });
  CardVariant.belongsTo(Card, { foreignKey: 'card_id', targetKey: 'id' });
  Card.hasMany(CardLegality, { foreignKey: 'card_id', sourceKey: 'id' });
  CardLegality.belongsTo(Card, { foreignKey: 'card_id', targetKey: 'id' });
  Card.hasOne(CardMtg, { foreignKey: 'card_id', sourceKey: 'id' });
  CardMtg.belongsTo(Card, { foreignKey: 'card_id', targetKey: 'id' });

  // Use plain sync() in all environments — CREATE TABLE IF NOT EXISTS only.
  // alter:true re-adds indexes on every restart and eventually hits MySQL's
  // 64-key-per-table limit. Migrations handle schema changes instead.
  await SchedulerTask.sync({ force: false });
  await PriceAlert.sync({ force: false });
}
