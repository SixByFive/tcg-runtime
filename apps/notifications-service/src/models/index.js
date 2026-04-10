import { getSequelize } from '@sbf/database';
import defineNotification from './Notification.js';
import defineUserNotificationPref from './UserNotificationPref.js';

export let Notification;
export let UserNotificationPref;

let initialized = false;

export async function initModels() {
  if (initialized) return;
  const sequelize = getSequelize();

  Notification         = defineNotification(sequelize);
  UserNotificationPref = defineUserNotificationPref(sequelize);

  if (process.env.NODE_ENV === 'development') {
    await Notification.sync({ alter: true });
    await UserNotificationPref.sync({ alter: true });
  } else {
    await Notification.sync({ force: false });
    await UserNotificationPref.sync({ force: false });
  }

  initialized = true;
}
