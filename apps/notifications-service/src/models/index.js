import { getSequelize } from '@sbf/database';
import defineNotification from './Notification.js';
import defineUserNotificationPref from './UserNotificationPref.js';
import definePushToken from './PushToken.js';
import defineWebPushSubscription from './WebPushSubscription.js';

export let Notification;
export let UserNotificationPref;
export let PushToken;
export let WebPushSubscription;

let initialized = false;

export async function initModels() {
  if (initialized) return;
  const sequelize = getSequelize();

  Notification          = defineNotification(sequelize);
  UserNotificationPref  = defineUserNotificationPref(sequelize);
  PushToken             = definePushToken(sequelize);
  WebPushSubscription   = defineWebPushSubscription(sequelize);

  // Use plain sync() in all environments — CREATE TABLE IF NOT EXISTS only.
  // alter:true re-adds indexes on every restart and eventually hits MySQL's
  // 64-key-per-table limit. Migrations handle schema changes instead.
  await Notification.sync({ force: false });
  await UserNotificationPref.sync({ force: false });
  await PushToken.sync({ force: false });
  await WebPushSubscription.sync({ force: false });

  initialized = true;
}
