export const queries = {
  allUsers: async (_, args, { token, clients, logger }) => {
    try {
      return await clients.users.adminGetUsers(token, args);
    } catch (error) {
      logger.warn(`allUsers failed: ${error.message}`);
      return [];
    }
  },

  adminUserCount: async (_, __, { token, clients, logger }) => {
    try {
      return await clients.users.adminGetUserCount(token);
    } catch (error) {
      logger.warn(`adminUserCount failed: ${error.message}`);
      return 0;
    }
  },

  adminBinders: async (_, args, { token, clients, logger }) => {
    try {
      return await clients.collections.adminGetBinders(token, args);
    } catch (error) {
      logger.warn(`adminBinders failed: ${error.message}`);
      return [];
    }
  },

  adminUserCollections: async (_, args, { token, clients, logger }) => {
    try {
      return await clients.collections.adminGetCollectionSummary(token, args);
    } catch (error) {
      logger.warn(`adminUserCollections failed: ${error.message}`);
      return [];
    }
  },

  mySafetyProfile: async (_, __, { token, clients, logger }) => {
    try {
      return await clients.users.getMySafetyProfile(token);
    } catch (error) {
      logger.warn(`mySafetyProfile failed: ${error.message}`);
      return { restrictionLevel: 'none', capabilities: { canTrade: true, canPost: true, canMessage: true, canConnectDiscord: true, canBuyMarketplace: true, canSellMarketplace: true, restrictionLevel: 'none' } };
    }
  },

  auditLogs: async (_, args, { token, clients, logger }) => {
    try {
      return await clients.users.getAuditLogs(token, args);
    } catch (error) {
      logger.warn(`auditLogs failed: ${error.message}`);
      return [];
    }
  },

  adminNotifications: async (_, args, { token, clients, logger }) => {
    try {
      return await clients.notifications.adminGetNotifications(token, args);
    } catch (error) {
      logger.warn(`adminNotifications failed: ${error.message}`);
      return { notifications: [], total: 0, page: 1, pageSize: 50 };
    }
  },
};

export const mutations = {
  adminBanUser: async (_, { id }, { token, clients, logger }) => {
    try {
      return await clients.users.adminBanUser(token, id);
    } catch (error) {
      logger.warn(`adminBanUser failed: ${error.message}`);
      throw error;
    }
  },

  adminUnbanUser: async (_, { id }, { token, clients, logger }) => {
    try {
      return await clients.users.adminUnbanUser(token, id);
    } catch (error) {
      logger.warn(`adminUnbanUser failed: ${error.message}`);
      throw error;
    }
  },

  adminDeleteUser: async (_, { id }, { token, clients, logger }) => {
    try {
      return await clients.users.adminDeleteUser(token, id);
    } catch (error) {
      logger.warn(`adminDeleteUser failed: ${error.message}`);
      throw error;
    }
  },

  adminDeleteBinder: async (_, { id, permanent }, { token, clients, logger }) => {
    try {
      return await clients.collections.adminDeleteBinder(token, id, permanent ?? false);
    } catch (error) {
      logger.warn(`adminDeleteBinder failed: ${error.message}`);
      throw error;
    }
  },

  adminSendBroadcastNotification: async (_, { input }, { token, clients, logger }) => {
    try {
      await clients.notifications.adminBroadcast(token, input);
      return true;
    } catch (error) {
      logger.warn(`adminSendBroadcastNotification failed: ${error.message}`);
      throw error;
    }
  },

  adminDeleteNotification: async (_, { id }, { token, clients, logger }) => {
    try {
      await clients.notifications.adminDeleteNotification(token, id);
      return true;
    } catch (error) {
      logger.warn(`adminDeleteNotification failed: ${error.message}`);
      throw error;
    }
  },

  adminSendSystemMessage: async (_, { receiverId, content, meta }, { token, clients, logger }) => {
    try {
      return await clients.messaging.adminSendSystemMessage(token, { receiverId, content, meta });
    } catch (error) {
      logger.warn(`adminSendSystemMessage failed: ${error.message}`);
      throw error;
    }
  },
};
