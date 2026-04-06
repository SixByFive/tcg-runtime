import { getSequelize } from '@sbf/database';
import defineUser from './User.js';
import defineSession from './Session.js';
import defineUserDiscordLink from './UserDiscordLink.js';

let initialized = false;
export let User;
export let Session;
export let UserDiscordLink;

export async function initModels() {
  if (initialized) return;
  const sequelize = getSequelize();
  User = defineUser(sequelize);
  Session = defineSession(sequelize);
  UserDiscordLink = defineUserDiscordLink(sequelize);

  if (process.env.NODE_ENV === 'development') {
    await sequelize.sync({ alter: true });
  } else {
    // Only create new tables that don't exist yet
    await UserDiscordLink.sync({ force: false });
  }
  initialized = true;
}
