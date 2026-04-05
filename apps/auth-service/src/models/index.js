import { getSequelize } from '@sbf/database';
import defineUser from './User.js';

let initialized = false;
export let User;

export async function initModels() {
  if (initialized) return;
  const sequelize = getSequelize();
  User = defineUser(sequelize);
  // In development, auto-create/alter tables. In production, rely on migrations.
  await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
  initialized = true;
}
