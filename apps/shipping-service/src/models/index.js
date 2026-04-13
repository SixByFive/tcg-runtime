import { getSequelize } from '@sbf/database';
import defineShippingLabel from './ShippingLabel.js';

export let ShippingLabel;

let initialized = false;

export async function initModels() {
  if (initialized) return;
  const sequelize = getSequelize();

  ShippingLabel = defineShippingLabel(sequelize);

  await ShippingLabel.sync({ force: false });

  initialized = true;
}
