export const queries = {
  myDeliveryAddress: async (_, __, { token, clients, logger }) => {
    if (!token) return null;
    try {
      return await clients.users.getMyProfile(token);
    } catch (error) {
      logger.warn(`myDeliveryAddress failed: ${error.message}`);
      return null;
    }
  },

  userProfile: async (_, { username }, { clients, logger }) => {
    try {
      return await clients.users?.getProfile(username) ?? null;
    } catch (error) {
      logger.warn(`userProfile failed for ${username}: ${error.message}`);
      return null;
    }
  },

  userById: async (_, { id }, { clients, logger }) => {
    try {
      return await clients.users?.getProfileById(id) ?? null;
    } catch (error) {
      logger.warn(`userById failed for ${id}: ${error.message}`);
      return null;
    }
  },

  searchUsers: async (_, { q, limit = 10 }, { clients, logger }) => {
    try {
      return await clients.users?.searchUsers(q, limit) ?? [];
    } catch (error) {
      logger.warn(`searchUsers failed for "${q}": ${error.message}`);
      return [];
    }
  },

  userAchievements: async (_, { userId }, { clients, logger }) => {
    try {
      return await clients.users?.getAchievements(userId) ?? [];
    } catch (error) {
      logger.warn(`userAchievements failed for ${userId}: ${error.message}`);
      return [];
    }
  },

  achievements: async (_, __, { clients, logger }) => {
    try { return await clients.users.getAllAchievements() ?? []; }
    catch (e) { logger.warn(`achievements failed: ${e.message}`); return []; }
  },

  myAchievements: async (_, __, { token, clients, logger }) => {
    try { return await clients.users.getMyAchievements(token) ?? []; }
    catch (e) { logger.warn(`myAchievements failed: ${e.message}`); return []; }
  },

  discordShareGuilds: async (_, __, { token, clients, logger }) => {
    try { return await clients.users.getDiscordShareGuilds(token) ?? []; }
    catch (e) { logger.warn(`discordShareGuilds: ${e.message}`); return []; }
  },

  discordShareChannels: async (_, { guildId }, { token, clients, logger }) => {
    try { return await clients.users.getDiscordShareChannels(token, guildId) ?? []; }
    catch (e) { logger.warn(`discordShareChannels: ${e.message}`); return []; }
  },

  myRewards: async (_, __, { token, clients, logger }) => {
    try {
      return await clients.users.getMyRewards(token);
    } catch (error) {
      logger.warn(`myRewards failed: ${error.message}`);
      return [];
    }
  },

  userRewards: async (_, { userId }, { clients, logger }) => {
    try {
      return await clients.users.getUserRewards(userId);
    } catch (error) {
      logger.warn(`userRewards failed: ${error.message}`);
      return [];
    }
  },
};

export const mutations = {
  updateProfile: async (_, args, { token, clients, logger }) => {
    try {
      return await clients.users.updateProfile(token, args);
    } catch (error) {
      logger.warn(`updateProfile failed: ${error.message}`);
      throw error;
    }
  },

  deleteAccount: async (_, { password, confirm }, { token, clients, logger }) => {
    try {
      return await clients.users.deleteAccount(token, { password, confirm });
    } catch (error) {
      logger.warn(`deleteAccount failed: ${error.message}`);
      throw error;
    }
  },

  exportUserData: async (_, _args, { token, clients, logger }) => {
    try {
      const data = await clients.users.exportUserData(token);
      return typeof data === 'string' ? data : JSON.stringify(data);
    } catch (error) {
      logger.warn(`exportUserData failed: ${error.message}`);
      throw error;
    }
  },

  grantReward: async (_, args, { token, clients, logger }) => {
    try {
      return await clients.users.grantReward(token, args);
    } catch (error) {
      logger.warn(`grantReward failed: ${error.message}`);
      throw error;
    }
  },

  adminGrantAchievement: async (_, args, { token, clients, logger }) => {
    try { return await clients.users.adminGrantAchievement(token, args); }
    catch (e) { logger.warn(`adminGrantAchievement failed: ${e.message}`); throw e; }
  },

  shareCollectionToDiscord: async (_, args, { token, clients, logger }) => {
    try { await clients.users.shareCollectionToDiscord(token, args); return true; }
    catch (e) { logger.warn(`shareCollectionToDiscord: ${e.message}`); throw e; }
  },

  shareWishlistToDiscord: async (_, args, { token, clients, logger }) => {
    try { await clients.users.shareWishlistToDiscord(token, args); return true; }
    catch (e) { logger.warn(`shareWishlistToDiscord: ${e.message}`); throw e; }
  },

  updateSafetyProfile: async (_, { dob, parentEmail }, { token, clients, logger }) => {
    try {
      const result = await clients.users.updateSafetyProfile(token, { dob, parentEmail });
      return { ok: true, error: null, user: result };
    } catch (error) {
      logger.warn(`updateSafetyProfile failed: ${error.message}`);
      return { ok: false, error: error.message, user: null };
    }
  },

  requestParentVerification: async (_, __, { token, clients, logger }) => {
    try {
      const result = await clients.users.requestParentVerification(token);
      return { ok: true, error: null, user: result?.user ?? result ?? null };
    } catch (error) {
      logger.warn(`requestParentVerification failed: ${error.message}`);
      return { ok: false, error: error.message, user: null };
    }
  },

  adminSetUserRestriction: async (_, { userId, restrictionLevel }, { token, clients, logger }) => {
    try {
      return await clients.users.adminSetUserRestriction(token, userId, restrictionLevel);
    } catch (error) {
      logger.warn(`adminSetUserRestriction failed: ${error.message}`);
      throw error;
    }
  },

  adminSetParentVerified: async (_, { userId, verified }, { token, clients, logger }) => {
    try {
      return await clients.users.adminSetParentVerified(token, userId, verified);
    } catch (error) {
      logger.warn(`adminSetParentVerified failed: ${error.message}`);
      throw error;
    }
  },

  adminClearParentLink: async (_, { userId }, { token, clients, logger }) => {
    try {
      return await clients.users.adminClearParentLink(token, userId);
    } catch (error) {
      logger.warn(`adminClearParentLink failed: ${error.message}`);
      throw error;
    }
  },
};

export const types = {
  UserProfile: {
    planName: async (obj, _, { clients, logger }) => {
      const userId = obj.userId ?? obj.user?.id ?? obj.id ?? null;
      if (!userId) return null;
      try {
        const { getUserPlanName } = await import('../../clients/paymentsClient.js');
        const name = await getUserPlanName(userId);
        return (name && name !== 'Free') ? name : null;
      } catch (e) {
        logger?.warn?.(`UserProfile.planName failed for ${userId}: ${e.message}`);
        return null;
      }
    },
  },
};
