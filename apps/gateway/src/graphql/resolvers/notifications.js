export const queries = {
  myNotificationPrefs: async (_, __, { token, clients, logger }) => {
    try {
      return await clients.notifications?.getPrefs(token) ?? {};
    } catch (error) {
      logger.warn(`myNotificationPrefs failed: ${error.message}`);
      return {};
    }
  },

  vapidPublicKey: async (_, __, { clients, logger }) => {
    try {
      return await clients.notifications?.getVapidPublicKey() ?? null;
    } catch (error) {
      logger.warn(`vapidPublicKey failed: ${error.message}`);
      return null;
    }
  },

  myNotifications: async (_, { page = 1, pageSize = 20, filter }, { token, clients, logger }) => {
    try {
      return await clients.notifications?.getMyNotifications(token, { page, pageSize, filter })
        ?? { notifications: [], total: 0, page, pageSize };
    } catch (error) {
      logger.warn(`myNotifications failed: ${error.message}`);
      return { notifications: [], total: 0, page, pageSize };
    }
  },

  unreadNotificationCount: async (_, __, { token, clients, logger }) => {
    try {
      const result = await clients.notifications?.getUnreadCount(token) ?? { count: 0 };
      return result?.count ?? 0;
    } catch (error) {
      logger.warn(`unreadNotificationCount failed: ${error.message}`);
      return 0;
    }
  },
};

export const mutations = {
  markNotificationRead: async (_, { id }, { token, clients, logger }) => {
    try {
      await clients.notifications?.markRead(token, id);
      return true;
    } catch (error) {
      logger.warn(`markNotificationRead failed: ${error.message}`);
      return false;
    }
  },

  markAllNotificationsRead: async (_, __, { token, clients, logger }) => {
    try {
      await clients.notifications?.markAllRead(token);
      return true;
    } catch (error) {
      logger.warn(`markAllNotificationsRead failed: ${error.message}`);
      return false;
    }
  },

  dismissNotification: async (_, { id }, { token, clients, logger }) => {
    try {
      await clients.notifications?.dismiss(token, id);
      return true;
    } catch (error) {
      logger.warn(`dismissNotification failed: ${error.message}`);
      return false;
    }
  },

  setNotificationPrefs: async (_, args, { token, clients, logger }) => {
    try {
      await clients.notifications?.setPrefs(token, args);
      return true;
    } catch (error) {
      logger.warn(`setNotificationPrefs failed: ${error.message}`);
      return false;
    }
  },

  subscribeWebPush: async (_, { endpoint, p256dh, auth, userAgent }, { token, clients, logger }) => {
    try {
      await clients.notifications?.subscribeWebPush(token, { endpoint, keys: { p256dh, auth }, userAgent });
      return true;
    } catch (error) {
      logger.warn(`subscribeWebPush failed: ${error.message}`);
      return false;
    }
  },

  unsubscribeWebPush: async (_, { endpoint }, { token, clients, logger }) => {
    try {
      await clients.notifications?.unsubscribeWebPush(token, endpoint);
      return true;
    } catch (error) {
      logger.warn(`unsubscribeWebPush failed: ${error.message}`);
      return false;
    }
  },

  registerExpoPushToken: async (_, { expoPushToken, platform, deviceName, appVersion }, { token, clients, logger }) => {
    try {
      await clients.notifications.registerPushToken(token, { expoPushToken, platform, deviceName, appVersion });
      return true;
    } catch (error) {
      logger.warn(`registerExpoPushToken failed: ${error.message}`);
      throw error;
    }
  },

  unregisterExpoPushToken: async (_, { expoPushToken }, { token, clients, logger }) => {
    try {
      await clients.notifications.unregisterPushToken(token, expoPushToken);
      return true;
    } catch (error) {
      logger.warn(`unregisterExpoPushToken failed: ${error.message}`);
      throw error;
    }
  },

  sendTestPush: async (_, { title, body: pushBody }, { token, clients, logger }) => {
    try {
      await clients.notifications.sendTestPush(token, { title, body: pushBody });
      return true;
    } catch (error) {
      logger.warn(`sendTestPush failed: ${error.message}`);
      throw error;
    }
  },
};
