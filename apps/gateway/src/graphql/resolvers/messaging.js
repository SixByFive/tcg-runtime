export const queries = {
  myChats: async (_, { page = 1, pageSize = 20 }, { token, clients, logger }) => {
    try {
      return await clients.messaging.getMyChats(token, { page, pageSize });
    } catch (error) {
      logger.warn(`myChats failed: ${error.message}`);
      return [];
    }
  },

  chatWithUser: async (_, { userId, page = 1, pageSize = 50 }, { token, clients, logger }) => {
    try {
      return await clients.messaging.getMessages(token, userId, { page, pageSize });
    } catch (error) {
      logger.warn(`chatWithUser failed: ${error.message}`);
      return [];
    }
  },

  unreadMessageCount: async (_, __, { token, clients, logger }) => {
    try {
      return await clients.messaging.getUnreadCount(token);
    } catch (error) {
      logger.warn(`unreadMessageCount failed: ${error.message}`);
      return 0;
    }
  },

  hasAgreedToChatRules: async (_, __, { token, clients, logger }) => {
    try {
      return await clients.messaging.hasAgreedToChatRules(token);
    } catch (error) {
      logger.warn(`hasAgreedToChatRules failed: ${error.message}`);
      return false;
    }
  },

  chatRulesText: async (_, __, { clients, logger }) => {
    try {
      return await clients.messaging.getChatRulesText();
    } catch (error) {
      logger.warn(`chatRulesText failed: ${error.message}`);
      return '';
    }
  },

  myMutedConversations: async (_, __, { token, clients, logger }) => {
    try {
      return await clients.messaging.getMyMutes(token);
    } catch (error) {
      logger.warn(`myMutedConversations failed: ${error.message}`);
      return [];
    }
  },

  myBlockedUsers: async (_, __, { token, clients, logger }) => {
    try {
      return await clients.messaging.getMyBlocks(token);
    } catch (error) {
      logger.warn(`myBlockedUsers failed: ${error.message}`);
      return [];
    }
  },

  adminQueryReportedUsers: async (_, { page = 1, pageSize = 50, isCleared }, { token, clients, logger }) => {
    try {
      return await clients.messaging.adminGetReportedUsers(token, { page, pageSize, isCleared });
    } catch (error) {
      logger.warn(`adminQueryReportedUsers failed: ${error.message}`);
      return [];
    }
  },
};

export const mutations = {
  sendMessage: async (_, { receiverId, content, meta }, { token, clients, logger }) => {
    try {
      return await clients.messaging.sendMessage(token, { receiverId, content, meta });
    } catch (error) {
      logger.warn(`sendMessage failed: ${error.message}`);
      throw error;
    }
  },

  markChatRead: async (_, { userId }, { token, clients, logger }) => {
    try {
      return await clients.messaging.markRead(token, userId);
    } catch (error) {
      logger.warn(`markChatRead failed: ${error.message}`);
      return false;
    }
  },

  deleteChat: async (_, { userId }, { token, clients, logger }) => {
    try {
      return await clients.messaging.deleteChat(token, userId);
    } catch (error) {
      logger.warn(`deleteChat failed: ${error.message}`);
      return false;
    }
  },

  reportUser: async (_, { userId, reason, details }, { token, clients, logger }) => {
    try {
      return await clients.messaging.reportUser(token, { userId, reason, details });
    } catch (error) {
      logger.warn(`reportUser failed: ${error.message}`);
      return false;
    }
  },

  reportMessage: async (_, { messageId, reason, details }, { token, clients, logger }) => {
    try {
      return await clients.messaging.reportMessage(token, { messageId, reason, details });
    } catch (error) {
      logger.warn(`reportMessage failed: ${error.message}`);
      return false;
    }
  },

  agreeToChatRules: async (_, __, { token, clients, logger }) => {
    try {
      return await clients.messaging.agreeToChatRules(token);
    } catch (error) {
      logger.warn(`agreeToChatRules failed: ${error.message}`);
      throw error;
    }
  },

  muteConversation: async (_, { userId, mutedUntil }, { token, clients, logger }) => {
    try {
      return await clients.messaging.muteConversation(token, userId, mutedUntil);
    } catch (error) {
      logger.warn(`muteConversation failed: ${error.message}`);
      throw error;
    }
  },

  unmuteConversation: async (_, { userId }, { token, clients, logger }) => {
    try {
      return await clients.messaging.unmuteConversation(token, userId);
    } catch (error) {
      logger.warn(`unmuteConversation failed: ${error.message}`);
      throw error;
    }
  },

  blockUserFromChat: async (_, { userId, reason }, { token, clients, logger }) => {
    try {
      return await clients.messaging.blockUser(token, userId, reason);
    } catch (error) {
      logger.warn(`blockUserFromChat failed: ${error.message}`);
      throw error;
    }
  },

  unblockUserFromChat: async (_, { userId }, { token, clients, logger }) => {
    try {
      return await clients.messaging.unblockUser(token, userId);
    } catch (error) {
      logger.warn(`unblockUserFromChat failed: ${error.message}`);
      throw error;
    }
  },

  adminBanUserFromChat: async (_, { userId, reason }, { token, clients, logger }) => {
    try {
      return await clients.messaging.adminBanUserFromChat(token, userId, reason);
    } catch (error) {
      logger.warn(`adminBanUserFromChat failed: ${error.message}`);
      throw error;
    }
  },

  adminUnbanUserFromChat: async (_, { userId }, { token, clients, logger }) => {
    try {
      return await clients.messaging.adminUnbanUserFromChat(token, userId);
    } catch (error) {
      logger.warn(`adminUnbanUserFromChat failed: ${error.message}`);
      throw error;
    }
  },

  adminDeleteMessage: async (_, { id }, { token, clients, logger }) => {
    try {
      return await clients.messaging.adminDeleteMessage(token, id);
    } catch (error) {
      logger.warn(`adminDeleteMessage failed: ${error.message}`);
      throw error;
    }
  },

  adminClearUserReport: async (_, { userId }, { token, clients, logger }) => {
    try {
      return await clients.messaging.adminClearUserReport(token, userId);
    } catch (error) {
      logger.warn(`adminClearUserReport failed: ${error.message}`);
      throw error;
    }
  },
};

export const types = {
  ChatThread: {
    user: async (obj, _, { clients, logger }) => {
      const id = obj.userId ?? obj.user?.id ?? null;
      if (!id) return null;
      if (obj.user?.username) return obj.user;
      try {
        const profile = await clients.users.getProfileById(id);
        if (!profile) return null;
        const u = profile.user ?? {};
        return {
          id:       u.id       ?? profile.userId ?? id,
          username: u.username ?? null,
          avatar:   profile.avatar ?? u.avatar ?? null,
        };
      } catch (e) {
        logger?.warn?.(`ChatThread.user failed for ${id}: ${e.message}`);
        return null;
      }
    },
  },
};
