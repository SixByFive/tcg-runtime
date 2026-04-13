import { checkDatabaseHealth } from '@sbf/database';

const JSONScalar = {
  __serialize(value)    { return value; },
  __parseValue(value)   { return value; },
  __parseLiteral()      { return null; },
};

export const resolvers = {
  JSON: JSONScalar,

  Query: {
    // ── Infrastructure ──────────────────────────────────────────────────────────

    health: async () => ({ status: 'ok', service: 'gateway' }),

    dbHealth: async () => checkDatabaseHealth(),

    serviceHealth: async (_, __, { clients, logger }) => {
      let auth = null;
      let catalog = null;

      try {
        auth = await clients.auth.getMe(null);
      } catch (error) {
        logger.warn(`Auth service probe failed: ${error.message}`);
        auth = { status: 'down', error: error.message };
      }

      try {
        catalog = await clients.catalog.getHealth();
      } catch (error) {
        logger.warn(`Catalog service probe failed: ${error.message}`);
        catalog = { status: 'down', error: error.message };
      }

      return {
        gateway: { status: 'ok', service: 'gateway' },
        auth,
        catalog,
      };
    },

    // ── Auth ────────────────────────────────────────────────────────────────────

    me: async (_, __, { token, clients, logger }) => {
      if (!token) return null;
      try {
        const result = await clients.auth.getMe(token);
        return result?.user || result || null;
      } catch (error) {
        logger.warn(`me query failed: ${error.message}`);
        return null;
      }
    },

    // ── User / Profile ──────────────────────────────────────────────────────────

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

    // ── Collection ──────────────────────────────────────────────────────────────

    myCollection: async (_, __, { token, req, clients }) =>
      clients.collections.getMyCollection(token, req),

    collection: async (_, { userId }, { clients }) =>
      clients.collections.getCollection(userId),

    collectionEntry: async (_, { cardId, variation }, { token, req, clients }) =>
      clients.collections.getCollectionEntry(token, req, { cardId, variation }),

    // ── Wishlist ────────────────────────────────────────────────────────────────

    myWishlist: async (_, { page, pageSize }, { token, req, clients }) =>
      clients.collections.getMyWishlist(token, req, { page, pageSize }),

    wishlist: async (_, { userId, page, pageSize }, { clients }) =>
      clients.collections.getWishlist(userId, { page, pageSize }),

    wishlistEntry: async (_, { cardId, variation }, { token, req, clients }) =>
      clients.collections.getWishlistEntry(token, req, { cardId, variation }),

    // ── Binder ──────────────────────────────────────────────────────────────────

    myBinders: async (_, __, { token, req, clients }) =>
      clients.collections.getMyBinders(token, req),

    binder: async (_, { id, slug }, { token, req, clients }) =>
      clients.collections.getBinder(id || slug, token, req),

    browseBinders: async (_, { page, pageSize, userId, search }, { clients }) =>
      clients.collections.browseBinders({ page, pageSize, userId, search }),

    // ── Catalog / cardsearch ────────────────────────────────────────────────────

    cardsearchSets: async (_, { limit = 50, offset = 0 }, { clients, logger }) => {
      try {
        const result = await clients.catalog.getSets({ limit, offset });
        // catalog-service may return { sets: [...] } or a bare array
        return result?.sets ?? result ?? [];
      } catch (error) {
        logger.warn(`cardsearchSets failed: ${error.message}`);
        return [];
      }
    },

    cardsearchSetByCode: async (_, { code }, { clients, logger }) => {
      try {
        const result = await clients.catalog.getSetByCode(code);
        return result?.set ?? result ?? null;
      } catch (error) {
        logger.warn(`cardsearchSetByCode failed for ${code}: ${error.message}`);
        return null;
      }
    },

    cardsearchSearchCards: async (_, { input }, { clients, logger }) => {
      try {
        // Normalise field names: frontend sends `set`, catalog-service may expect `setCode`
        const normalisedInput = {
          ...input,
          setCode: input.setCode || input.set,
        };
        const result = await clients.catalog.searchCards(normalisedInput);
        return {
          total:  result?.total  ?? 0,
          limit:  result?.limit  ?? input.limit  ?? 50,
          offset: result?.offset ?? input.offset ?? 0,
          items:  result?.items  ?? result?.cards ?? [],
        };
      } catch (error) {
        logger.warn(`cardsearchSearchCards failed: ${error.message}`);
        return { total: 0, limit: 50, offset: 0, items: [] };
      }
    },

    cardsearchCard: async (_, { id, variant }, { clients, logger }) => {
      try {
        const result = await clients.catalog.getCard(id, variant);
        return result?.card ?? result ?? null;
      } catch (error) {
        logger.warn(`cardsearchCard failed for ${id}: ${error.message}`);
        return null;
      }
    },

    cardsearchPriceObservations: async (_, { cardId, variant, limit = 90 }, { clients, logger }) => {
      try {
        const result = await clients.catalog.getPriceObservations(cardId, variant, limit);
        return result?.observations ?? result ?? [];
      } catch (error) {
        logger.warn(`cardsearchPriceObservations failed for ${cardId}: ${error.message}`);
        return [];
      }
    },

    // ── Notifications ────────────────────────────────────────────────────────────

    myNotificationPrefs: async (_, __, { token, clients, logger }) => {
      try {
        return await clients.notifications?.getPrefs(token) ?? {};
      } catch (error) {
        logger.warn(`myNotificationPrefs failed: ${error.message}`);
        return {};
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

    // ── Marketplace ─────────────────────────────────────────────────────────────

    listings: async (_, args, { clients, logger }) => {
      try {
        return await clients.marketplace.getListings(args);
      } catch (error) {
        logger.warn(`listings failed: ${error.message}`);
        return [];
      }
    },

    listing: async (_, { id }, { clients, logger }) => {
      try {
        return await clients.marketplace.getListing(id);
      } catch (error) {
        logger.warn(`listing failed: ${error.message}`);
        return null;
      }
    },

    myOrders: async (_, args, { token, clients, logger }) => {
      try {
        return await clients.marketplace.getMyOrders(token, args);
      } catch (error) {
        logger.warn(`myOrders failed: ${error.message}`);
        return [];
      }
    },

    order: async (_, { id }, { token, clients, logger }) => {
      try {
        return await clients.marketplace.getOrder(token, id);
      } catch (error) {
        logger.warn(`order failed: ${error.message}`);
        return null;
      }
    },

    sellerStatus: async (_, __, { token, clients, logger }) => {
      try {
        return await clients.marketplace.getSellerStatus(token);
      } catch (error) {
        logger.warn(`sellerStatus failed: ${error.message}`);
        return { connected: false, complete: false, url: null };
      }
    },

    listingOffers: async (_, { listingId }, { token, clients, logger }) => {
      try {
        return await clients.marketplace.getListingOffers(token, listingId);
      } catch (error) {
        logger.warn(`listingOffers failed: ${error.message}`);
        return [];
      }
    },

    myOffers: async (_, __, { token, clients, logger }) => {
      try {
        return await clients.marketplace.getMyOffers(token);
      } catch (error) {
        logger.warn(`myOffers failed: ${error.message}`);
        return [];
      }
    },

    adminListings: async (_, args, { token, clients, logger }) => {
      try {
        return await clients.marketplace.adminGetListings(token, args);
      } catch (error) {
        logger.warn(`adminListings failed: ${error.message}`);
        return [];
      }
    },

    adminOrders: async (_, args, { token, clients, logger }) => {
      try {
        return await clients.marketplace.adminGetOrders(token, args);
      } catch (error) {
        logger.warn(`adminOrders failed: ${error.message}`);
        return [];
      }
    },

    // ── Admin ─────────────────────────────────────────────────────────────────

    allUsers: async (_, args, { token, clients, logger }) => {
      try {
        return await clients.users.adminGetUsers(token, args);
      } catch (error) {
        logger.warn(`allUsers failed: ${error.message}`);
        return [];
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

    // ── Safety ───────────────────────────────────────────────────────────────────

    mySafetyProfile: async (_, __, { token, clients, logger }) => {
      try {
        return await clients.users.getMySafetyProfile(token);
      } catch (error) {
        logger.warn(`mySafetyProfile failed: ${error.message}`);
        return { restrictionLevel: 'none', capabilities: { canTrade: true, canPost: true, canMessage: true, canConnectDiscord: true, canBuyMarketplace: true, canSellMarketplace: true, restrictionLevel: 'none' } };
      }
    },

    // ── Shipping ─────────────────────────────────────────────────────────────────

    shippingRates: async (_, { to, from, parcel, parcelSize }, { token, clients, logger }) => {
      try {
        return await clients.shipping.getRates(token, { to, from, parcel, parcelSize });
      } catch (error) {
        logger.warn(`shippingRates failed: ${error.message}`);
        return [];
      }
    },

    shippingLabel: async (_, { id }, { token, clients, logger }) => {
      try {
        return await clients.shipping.getLabel(token, id);
      } catch (error) {
        logger.warn(`shippingLabel failed: ${error.message}`);
        return null;
      }
    },

    // ── Rewards ──────────────────────────────────────────────────────────────────

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

    // ── Audit Logs ────────────────────────────────────────────────────────────────

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

    // ── Price Alerts ─────────────────────────────────────────────────────────────

    myPriceAlerts: async (_, __, { token, clients, logger }) => {
      try {
        return await clients.catalog.getPriceAlerts(token) ?? [];
      } catch (error) {
        logger.warn(`myPriceAlerts failed: ${error.message}`);
        return [];
      }
    },

    // ── Messaging ────────────────────────────────────────────────────────────────

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

    // ── Subscriptions / Payments ─────────────────────────────────────────────────

    subscriptionPlans: async (_, __, { clients, logger }) => {
      try {
        return await clients.payments.getPlans();
      } catch (error) {
        logger.warn(`subscriptionPlans failed: ${error.message}`);
        return [];
      }
    },

    mySubscription: async (_, __, { token, clients, logger }) => {
      try {
        return await clients.payments.getMySubscription(token);
      } catch (error) {
        logger.warn(`mySubscription failed: ${error.message}`);
        return null;
      }
    },

    subscriptionPortal: async (_, __, { token, clients, logger }) => {
      try {
        return await clients.payments.getSubscriptionPortal(token);
      } catch (error) {
        logger.warn(`subscriptionPortal failed: ${error.message}`);
        return null;
      }
    },

    myTransactions: async (_, { page = 1, pageSize = 20 }, { token, clients, logger }) => {
      try {
        return await clients.payments.getMyTransactions(token, { page, pageSize });
      } catch (error) {
        logger.warn(`myTransactions failed: ${error.message}`);
        return [];
      }
    },

    // ── Trading ──────────────────────────────────────────────────────────────────

    browseTrades: async (_, { page = 1, pageSize = 20 }, { clients, logger }) => {
      try {
        return await clients.trading.browseTrades({ page, pageSize });
      } catch (error) {
        logger.warn(`browseTrades failed: ${error.message}`);
        return [];
      }
    },

    myTrades: async (_, { page = 1, pageSize = 20, status }, { token, clients, logger }) => {
      try {
        return await clients.trading.getMyTrades(token, { page, pageSize, status });
      } catch (error) {
        logger.warn(`myTrades failed: ${error.message}`);
        return [];
      }
    },

    trade: async (_, { id }, { token, clients, logger }) => {
      try {
        return await clients.trading.getTrade(token, id);
      } catch (error) {
        logger.warn(`trade failed for ${id}: ${error.message}`);
        return null;
      }
    },

    adminTrades: async (_, args, { token, clients, logger }) => {
      try {
        return await clients.trading.adminGetTrades(token, args);
      } catch (error) {
        logger.warn(`adminTrades failed: ${error.message}`);
        return [];
      }
    },

    adminTradeDisputes: async (_, { status }, { token, clients, logger }) => {
      try {
        return await clients.trading.adminGetDisputes(token, { status });
      } catch (error) {
        logger.warn(`adminTradeDisputes failed: ${error.message}`);
        return [];
      }
    },

    adminTradeBans: async (_, __, { token, clients, logger }) => {
      try {
        return await clients.trading.adminGetTradeBans(token);
      } catch (error) {
        logger.warn(`adminTradeBans failed: ${error.message}`);
        return [];
      }
    },

    searchCards: async (_, { input }, { clients, logger }) => {
      try {
        const normalisedInput = { ...input, setCode: input.setCode || input.set };
        const result = await clients.catalog.searchCards(normalisedInput);
        return {
          total:  result?.total  ?? 0,
          limit:  result?.limit  ?? input.limit  ?? 50,
          offset: result?.offset ?? input.offset ?? 0,
          items:  result?.items  ?? result?.cards ?? [],
        };
      } catch (error) {
        logger.warn(`searchCards failed: ${error.message}`);
        return { total: 0, limit: 50, offset: 0, items: [] };
      }
    },

    cardsearchPriceRollups: async (_, { cardId, variant }, { clients, logger }) => {
      try {
        const result = await clients.catalog.getPriceRollups(cardId, variant);
        // May return a single object or an array
        if (Array.isArray(result)) return result;
        if (result?.rollups) return result.rollups;
        return result ? [result] : [];
      } catch (error) {
        logger.warn(`cardsearchPriceRollups failed for ${cardId}: ${error.message}`);
        return [];
      }
    },
  },

  Mutation: {
    // ── Auth ────────────────────────────────────────────────────────────────────

    login: async (_, args, { clients }) =>
      clients.auth.login(args),

    register: async (_, args, { clients }) =>
      clients.auth.register(args),

    // ── Account / security ───────────────────────────────────────────────────────

    requestPasswordReset: async (_, { email }, { clients, logger }) => {
      try {
        return await clients.auth.requestPasswordReset(email);
      } catch (error) {
        logger.warn(`requestPasswordReset failed: ${error.message}`);
        return true; // Don't leak whether the email exists
      }
    },

    resetPassword: async (_, { token, newPassword }, { clients, logger }) => {
      try {
        return await clients.auth.resetPassword(token, newPassword);
      } catch (error) {
        logger.warn(`resetPassword failed: ${error.message}`);
        throw error;
      }
    },

    changePassword: async (_, { currentPassword, newPassword }, { token, clients, logger }) => {
      try {
        return await clients.auth.changePassword(token, currentPassword, newPassword);
      } catch (error) {
        logger.warn(`changePassword failed: ${error.message}`);
        throw error;
      }
    },

    changeEmail: async (_, { newEmail, currentPassword }, { token, clients, logger }) => {
      try {
        return await clients.auth.changeEmail(token, newEmail, currentPassword);
      } catch (error) {
        logger.warn(`changeEmail failed: ${error.message}`);
        throw error;
      }
    },

    enableTwoFactor: async (_, __, { token, clients, logger }) => {
      try {
        return await clients.auth.enableTwoFactor(token);
      } catch (error) {
        logger.warn(`enableTwoFactor failed: ${error.message}`);
        throw error;
      }
    },

    verifyTwoFactor: async (_, { code }, { token, clients, logger }) => {
      try {
        return await clients.auth.verifyTwoFactor(token, code);
      } catch (error) {
        logger.warn(`verifyTwoFactor failed: ${error.message}`);
        throw error;
      }
    },

    disableTwoFactor: async (_, { code }, { token, clients, logger }) => {
      try {
        return await clients.auth.disableTwoFactor(token, code);
      } catch (error) {
        logger.warn(`disableTwoFactor failed: ${error.message}`);
        throw error;
      }
    },

    // ── User Profile ─────────────────────────────────────────────────────────────

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

    // ── Collection ──────────────────────────────────────────────────────────────

    addToCollection: async (_, args, { token, req, clients }) =>
      clients.collections.addToCollection(token, req, args),

    updateCollectionEntry: async (_, args, { token, req, clients }) =>
      clients.collections.updateCollection(token, req, args),

    removeFromCollection: async (_, { cardId, variation }, { token, req, clients }) => {
      const result = await clients.collections.removeFromCollection(token, req, { cardId, variation });
      return result?.ok ?? false;
    },

    moveToWishlist: async (_, { cardId, variation }, { token, req, clients }) => {
      const result = await clients.collections.moveToWishlist(token, req, { cardId, variation });
      return result?.ok ?? false;
    },

    moveToCollection: async (_, { cardId, variation }, { token, req, clients }) =>
      clients.collections.moveFromWishlist(token, req, { cardId, variation }),

    bulkAddToCollection: async (_, { cards }, { token, req, clients }) =>
      clients.collections.bulkAddToCollection(token, req, { cards }),

    cardsearchBulkAddToCollection: async (_, { input }, { token, req, clients }) =>
      clients.collections.bulkAddToCollection(token, req, input),

    // ── Notifications ────────────────────────────────────────────────────────────

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

    // ── Messaging ────────────────────────────────────────────────────────────────

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

    // ── Price Alerts ──────────────────────────────────────────────────────────────

    upsertPriceAlert: async (_, { input }, { token, clients, logger }) => {
      try {
        return await clients.catalog.upsertPriceAlert(token, input);
      } catch (error) {
        logger.warn(`upsertPriceAlert failed: ${error.message}`);
        throw error;
      }
    },

    deletePriceAlert: async (_, { id }, { token, clients, logger }) => {
      try {
        return await clients.catalog.deletePriceAlert(token, id);
      } catch (error) {
        logger.warn(`deletePriceAlert failed: ${error.message}`);
        throw error;
      }
    },

    togglePriceAlert: async (_, { id, active }, { token, clients, logger }) => {
      try {
        return await clients.catalog.togglePriceAlert(token, id, active);
      } catch (error) {
        logger.warn(`togglePriceAlert failed: ${error.message}`);
        throw error;
      }
    },

    // ── Binder (slot) ─────────────────────────────────────────────────────────────

    addCardToBinder: async (_, { pageId, input }, { token, req, clients, logger }) => {
      try {
        return await clients.collections.addCardToBinder(token, req, pageId, input);
      } catch (error) {
        logger.warn(`addCardToBinder failed: ${error.message}`);
        throw error;
      }
    },

    // ── Wishlist ────────────────────────────────────────────────────────────────

    addToWishlist: async (_, args, { token, req, clients }) =>
      clients.collections.addToWishlist(token, req, args),

    updateWishlistEntry: async (_, args, { token, req, clients }) =>
      clients.collections.updateWishlistEntry(token, req, args),

    removeFromWishlist: async (_, { cardId, variation }, { token, req, clients }) => {
      const result = await clients.collections.removeFromWishlist(token, req, { cardId, variation });
      return result?.ok ?? false;
    },

    // ── Binder ──────────────────────────────────────────────────────────────────

    createBinder: async (_, { input }, { token, req, clients }) =>
      clients.collections.createBinder(token, req, input),

    updateBinder: async (_, { id, input }, { token, req, clients }) =>
      clients.collections.updateBinder(token, req, id, input),

    deleteBinder: async (_, { id, permanent }, { token, req, clients }) => {
      const result = await clients.collections.deleteBinder(token, req, id, { permanent });
      return result?.ok ?? false;
    },

    saveBinderPagesAndSlots: async (_, { binderId, pages }, { token, req, clients }) =>
      clients.collections.saveBinderPagesAndSlots(token, req, binderId, pages),

    // ── Marketplace ─────────────────────────────────────────────────────────────

    createListing: async (_, { input }, { token, clients, logger }) => {
      try {
        return await clients.marketplace.createListing(token, input);
      } catch (error) {
        logger.warn(`createListing failed: ${error.message}`);
        throw error;
      }
    },

    deleteListing: async (_, { id }, { token, clients, logger }) => {
      try {
        return await clients.marketplace.deleteListing(token, id);
      } catch (error) {
        logger.warn(`deleteListing failed: ${error.message}`);
        throw error;
      }
    },

    createOrderFromListing: async (_, { input }, { token, clients, logger }) => {
      try {
        const { listingId, buyerAddress, shippingRateId, shipmentId } = input;
        return await clients.marketplace.buyListing(token, listingId, { buyerAddress, shippingRateId, shipmentId });
      } catch (error) {
        logger.warn(`createOrderFromListing failed: ${error.message}`);
        throw error;
      }
    },

    createOffer: async (_, { listingId, amount, message }, { token, clients, logger }) => {
      try {
        return await clients.marketplace.createOffer(token, listingId, { amount, message });
      } catch (error) {
        logger.warn(`createOffer failed: ${error.message}`);
        throw error;
      }
    },

    respondToOffer: async (_, { offerId, action, counterAmount, counterMessage, buyerAddress }, { token, clients, logger }) => {
      try {
        const result = await clients.marketplace.respondToOffer(token, offerId, { action, counterAmount, counterMessage, buyerAddress });
        return {
          ok:           result?.ok ?? true,
          status:       result?.status ?? action,
          orderId:      result?.orderId ?? null,
          clientSecret: result?.clientSecret ?? null,
          totalAmount:  result?.totalAmount ?? null,
          counterAmount: result?.counterAmount ?? null,
        };
      } catch (error) {
        logger.warn(`respondToOffer failed: ${error.message}`);
        throw error;
      }
    },

    withdrawOffer: async (_, { offerId }, { token, clients, logger }) => {
      try {
        return await clients.marketplace.withdrawOffer(token, offerId);
      } catch (error) {
        logger.warn(`withdrawOffer failed: ${error.message}`);
        throw error;
      }
    },

    connectStripe: async (_, __, { token, clients, logger }) => {
      try {
        return await clients.marketplace.connectStripe(token);
      } catch (error) {
        logger.warn(`connectStripe failed: ${error.message}`);
        throw error;
      }
    },

    // ── Subscription mutations ────────────────────────────────────────────────

    createSubscription: async (_, { planId, paymentMethodId }, { token, clients, logger }) => {
      try {
        return await clients.payments.createSubscription(token, { planId, paymentMethodId });
      } catch (error) {
        logger.warn(`createSubscription failed: ${error.message}`);
        throw error;
      }
    },

    cancelSubscription: async (_, __, { token, clients, logger }) => {
      try {
        await clients.payments.cancelSubscription(token);
        return true;
      } catch (error) {
        logger.warn(`cancelSubscription failed: ${error.message}`);
        throw error;
      }
    },

    resumeSubscription: async (_, __, { token, clients, logger }) => {
      try {
        return await clients.payments.resumeSubscription(token);
      } catch (error) {
        logger.warn(`resumeSubscription failed: ${error.message}`);
        throw error;
      }
    },

    // ── Trading mutations ─────────────────────────────────────────────────────

    initiateTrade: async (_, { userId, offeredCards, wantedCards }, { token, clients, logger }) => {
      try {
        return await clients.trading.initiateTrade(token, { userId, offeredCards: offeredCards ?? [], wantedCards: wantedCards ?? [] });
      } catch (error) {
        logger.warn(`initiateTrade failed: ${error.message}`);
        throw error;
      }
    },

    respondToTrade: async (_, { id, accept, counterCards, reason }, { token, clients, logger }) => {
      try {
        return await clients.trading.respondToTrade(token, id, { accept, counterCards, reason });
      } catch (error) {
        logger.warn(`respondToTrade failed: ${error.message}`);
        throw error;
      }
    },

    cancelTrade: async (_, { id, reason }, { token, clients, logger }) => {
      try {
        return await clients.trading.cancelTrade(token, id, reason);
      } catch (error) {
        logger.warn(`cancelTrade failed: ${error.message}`);
        throw error;
      }
    },

    uploadTradeProof: async (_, { id, proofImage, proofCode }, { token, clients, logger }) => {
      try {
        return await clients.trading.uploadTradeProof(token, id, { proofImage, proofCode });
      } catch (error) {
        logger.warn(`uploadTradeProof failed: ${error.message}`);
        throw error;
      }
    },

    submitTradeTracking: async (_, { id, trackingNumber }, { token, clients, logger }) => {
      try {
        return await clients.trading.submitTradeTracking(token, id, trackingNumber);
      } catch (error) {
        logger.warn(`submitTradeTracking failed: ${error.message}`);
        throw error;
      }
    },

    confirmTradeReceived: async (_, { id }, { token, clients, logger }) => {
      try {
        return await clients.trading.confirmTradeReceived(token, id);
      } catch (error) {
        logger.warn(`confirmTradeReceived failed: ${error.message}`);
        throw error;
      }
    },

    raiseTradeDispute: async (_, { id, reason }, { token, clients, logger }) => {
      try {
        return await clients.trading.raiseTradeDispute(token, id, reason);
      } catch (error) {
        logger.warn(`raiseTradeDispute failed: ${error.message}`);
        throw error;
      }
    },

    leaveTradeFeedback: async (_, { id, rating, review }, { token, clients, logger }) => {
      try {
        const result = await clients.trading.leaveTradeFeedback(token, id, { rating, review });
        return result?.ok ?? true;
      } catch (error) {
        logger.warn(`leaveTradeFeedback failed: ${error.message}`);
        throw error;
      }
    },

    adminResolveTradeDispute: async (_, { id, resolution, resolvedInFavourOf }, { token, clients, logger }) => {
      try {
        return await clients.trading.adminResolveTradeDispute(token, id, { resolution, resolvedInFavourOf });
      } catch (error) {
        logger.warn(`adminResolveTradeDispute failed: ${error.message}`);
        throw error;
      }
    },

    adminApproveTradeProof: async (_, { id, proofId, party }, { token, clients, logger }) => {
      try {
        const result = await clients.trading.adminApproveTradeProof(token, id, { proofId, party });
        return result?.ok ?? true;
      } catch (error) {
        logger.warn(`adminApproveTradeProof failed: ${error.message}`);
        throw error;
      }
    },

    adminBanUserFromTrading: async (_, { userId, reason }, { token, clients, logger }) => {
      try {
        return await clients.trading.adminBanUserFromTrading(token, userId, reason);
      } catch (error) {
        logger.warn(`adminBanUserFromTrading failed: ${error.message}`);
        throw error;
      }
    },

    adminUnbanUserFromTrading: async (_, { userId }, { token, clients, logger }) => {
      try {
        return await clients.trading.adminUnbanUserFromTrading(token, userId);
      } catch (error) {
        logger.warn(`adminUnbanUserFromTrading failed: ${error.message}`);
        throw error;
      }
    },

    // ── Admin mutations ───────────────────────────────────────────────────────

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

    adminUpdateOrderFulfilmentStatus: async (_, { orderId, status }, { token, clients, logger }) => {
      try {
        return await clients.marketplace.adminUpdateOrderFulfilmentStatus(token, orderId, status);
      } catch (error) {
        logger.warn(`adminUpdateOrderFulfilmentStatus failed: ${error.message}`);
        throw error;
      }
    },

    adminCreateProductListing: async (_, { input }, { token, clients, logger }) => {
      try {
        return await clients.marketplace.adminCreateProductListing(token, input);
      } catch (error) {
        logger.warn(`adminCreateProductListing failed: ${error.message}`);
        throw error;
      }
    },

    adminUpdateProductListing: async (_, { id, input }, { token, clients, logger }) => {
      try {
        return await clients.marketplace.adminUpdateProductListing(token, id, input);
      } catch (error) {
        logger.warn(`adminUpdateProductListing failed: ${error.message}`);
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

    grantReward: async (_, args, { token, clients, logger }) => {
      try {
        return await clients.users.grantReward(token, args);
      } catch (error) {
        logger.warn(`grantReward failed: ${error.message}`);
        throw error;
      }
    },

    // ── Safety mutations ──────────────────────────────────────────────────────────

    updateSafetyProfile: async (_, { dob, parentEmail }, { token, clients, logger }) => {
      try {
        return await clients.users.updateSafetyProfile(token, { dob, parentEmail });
      } catch (error) {
        logger.warn(`updateSafetyProfile failed: ${error.message}`);
        throw error;
      }
    },

    requestParentVerification: async (_, __, { token, clients, logger }) => {
      try {
        const result = await clients.users.requestParentVerification(token);
        return result?.ok ?? true;
      } catch (error) {
        logger.warn(`requestParentVerification failed: ${error.message}`);
        throw error;
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

    // ── Shipping mutations ────────────────────────────────────────────────────

    createShippingLabel: async (_, args, { token, clients, logger }) => {
      try {
        return await clients.shipping.createLabel(token, args);
      } catch (error) {
        logger.warn(`createShippingLabel failed: ${error.message}`);
        throw error;
      }
    },

    cancelShippingLabel: async (_, { id }, { token, clients, logger }) => {
      try {
        return await clients.shipping.cancelLabel(token, id);
      } catch (error) {
        logger.warn(`cancelShippingLabel failed: ${error.message}`);
        throw error;
      }
    },

    // ── Push notifications ─────────────────────────────────────────────────────

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
  },

  // ── Union resolvers ───────────────────────────────────────────────────────────

  Listing: {
    __resolveType(obj) {
      // ProductListing has a title but no cardId; CardListing always has cardId
      if (obj.cardId) return 'CardListing';
      return 'ProductListing';
    },
  },

  // ── Field resolvers ───────────────────────────────────────────────────────────

  Order: {
    // Alias fields the frontend expects
    orderNumber:        (obj) => obj.orderNumber ?? obj.id,
    total:              (obj) => obj.total ?? obj.totalAmount,
    paidAt:             (obj) => obj.paidAt ?? obj.capturedAt,
    shippingAddressJson:(obj) => obj.shippingAddressJson ?? obj.buyerAddressJson,
  },
};
