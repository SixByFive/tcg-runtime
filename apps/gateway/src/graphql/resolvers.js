import { checkDatabaseHealth } from '@sbf/database';

/**
 * Enrich collection/wishlist entries with full card data from the catalog service
 * (variants, latestPrices, images, set). Handles both array and WishlistPage shapes.
 * Falls back gracefully if the catalog call fails.
 */
async function hydrateCards(entriesOrPage, catalogClient, logger) {
  const isPage = entriesOrPage
    && typeof entriesOrPage === 'object'
    && !Array.isArray(entriesOrPage)
    && Array.isArray(entriesOrPage.entries);

  const isSingle = entriesOrPage
    && typeof entriesOrPage === 'object'
    && !Array.isArray(entriesOrPage)
    && !isPage;

  const entries = isPage
    ? entriesOrPage.entries
    : isSingle
      ? [entriesOrPage]
      : Array.isArray(entriesOrPage)
        ? entriesOrPage
        : [];

  if (!entries.length) return entriesOrPage;

  const ids = [...new Set(entries.map(e => e.cardId).filter(Boolean))];
  if (!ids.length) return entriesOrPage;

  let catalogCards = [];
  try {
    catalogCards = await catalogClient.getCardsBatch(ids);
  } catch (e) {
    logger?.warn?.(`hydrateCards: batch fetch failed — ${e.message}`);
    return entriesOrPage; // degrade gracefully: return entry with minimal card data
  }

  const cardMap = new Map(catalogCards.map(c => [c.id || c.cardId, c]));
  const hydrated = entries.map(entry => ({
    ...entry,
    card: cardMap.get(entry.cardId) || entry.card || null,
  }));

  if (isPage)  return { ...entriesOrPage, entries: hydrated };
  if (isSingle) return hydrated[0] ?? null;
  return hydrated;
}

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
        const [authResult, safetyResult] = await Promise.allSettled([
          clients.auth.getMe(token),
          clients.users.getMySafetyProfile(token),
        ]);

        const user = authResult.status === 'fulfilled'
          ? (authResult.value?.user || authResult.value || null)
          : null;

        if (!user) return null;

        // Merge safety fields (dob, parentEmail, parentVerifiedAt, capabilities)
        if (safetyResult.status === 'fulfilled' && safetyResult.value) {
          const s = safetyResult.value;
          user.dob              = s.dob              ?? user.dob              ?? null;
          user.parentEmail      = s.parentEmail      ?? user.parentEmail      ?? null;
          user.parentVerifiedAt = s.parentVerifiedAt ?? user.parentVerifiedAt ?? null;
          user.capabilities     = s.capabilities     ?? user.capabilities     ?? null;
        }

        return user;
      } catch (error) {
        logger.warn(`me query failed: ${error.message}`);
        return null;
      }
    },

    // ── User / Profile ──────────────────────────────────────────────────────────

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

    // ── Collection ──────────────────────────────────────────────────────────────

    cardSetCompletion: async (_, { setCode }, { token, req, clients }) => {
      return clients.collections.getSetCompletion(token, req, setCode);
    },

    myCollection: async (_, __, { token, req, clients, logger }) => {
      const entries = await clients.collections.getMyCollection(token, req);
      return hydrateCards(entries, clients.catalog, logger);
    },

    collection: async (_, { userId }, { clients, logger }) => {
      const entries = await clients.collections.getCollection(userId);
      return hydrateCards(entries, clients.catalog, logger);
    },

    collectionEntry: async (_, { cardId, variation }, { token, req, clients, logger }) => {
      const entry = await clients.collections.getCollectionEntry(token, req, { cardId, variation });
      return entry ? hydrateCards(entry, clients.catalog, logger) : null;
    },

    // ── Wishlist ────────────────────────────────────────────────────────────────

    myWishlist: async (_, { page, pageSize }, { token, req, clients, logger }) => {
      const page_ = await clients.collections.getMyWishlist(token, req, { page, pageSize });
      return hydrateCards(page_, clients.catalog, logger);
    },

    wishlist: async (_, { userId, page, pageSize }, { clients, logger }) => {
      const page_ = await clients.collections.getWishlist(userId, { page, pageSize });
      return hydrateCards(page_, clients.catalog, logger);
    },

    wishlistEntry: async (_, { cardId, variation }, { token, req, clients, logger }) => {
      const entry = await clients.collections.getWishlistEntry(token, req, { cardId, variation });
      return entry ? hydrateCards(entry, clients.catalog, logger) : null;
    },

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
        return await clients.catalog.searchCards({
          ...input,
          setCode: input.setCode || input.set,
        });
      } catch (error) {
        logger.warn(`cardsearchSearchCards failed: ${error.message}`);
        return { total: 0, limit: input.limit ?? 50, offset: input.offset ?? 0, items: [] };
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

    myListings: async (_, args, { token, clients, logger }) => {
      try {
        return await clients.marketplace.getMyListings(token, args);
      } catch (error) {
        logger.warn(`myListings failed: ${error.message}`);
        return [];
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

    sellerReputation: async (_, { userId }, { clients, logger }) => {
      try {
        return await clients.marketplace.getSellerReputation(userId);
      } catch (error) {
        logger.warn(`sellerReputation failed: ${error.message}`);
        return null;
      }
    },

    sellerReviews: async (_, { userId, limit, offset }, { clients, logger }) => {
      try {
        return await clients.marketplace.getSellerReviews(userId, { limit, offset });
      } catch (error) {
        logger.warn(`sellerReviews failed: ${error.message}`);
        return [];
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

    sellerAddress: async (_, __, { token, clients, logger }) => {
      try {
        return await clients.marketplace.getSellerAddress(token);
      } catch (error) {
        logger.warn(`sellerAddress failed: ${error.message}`);
        return {};
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

    myIncomingOffers: async (_, __, { token, clients, logger }) => {
      try {
        return await clients.marketplace.getMyIncomingOffers(token);
      } catch (error) {
        logger.warn(`myIncomingOffers failed: ${error.message}`);
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

    adminProofQueue: async (_, _args, { token, clients, logger }) => {
      try {
        return await clients.marketplace.adminGetProofQueue(token);
      } catch (error) {
        logger.warn(`adminProofQueue failed: ${error.message}`);
        return [];
      }
    },

    adminOrderDisputes: async (_, { status }, { token, clients, logger }) => {
      try {
        return await clients.marketplace.adminGetDisputes(token, status);
      } catch (error) {
        logger.warn(`adminOrderDisputes failed: ${error.message}`);
        return [];
      }
    },

    adminReviewQueue: async (_, { status, limit, offset }, { token, clients, logger }) => {
      try {
        return await clients.marketplace.getAdminReviewQueue(token, { status, limit, offset });
      } catch (error) {
        logger.warn(`adminReviewQueue failed: ${error.message}`);
        return [];
      }
    },

    adminSubscriptions: async (_, args, { token, clients, logger }) => {
      try {
        return await clients.payments.adminGetSubscriptions(token, args);
      } catch (error) {
        logger.warn(`adminSubscriptions failed: ${error.message}`);
        return { subscriptions: [], total: 0, page: 1, pageSize: 50 };
      }
    },

    adminAllTransactions: async (_, args, { token, clients, logger }) => {
      try {
        return await clients.payments.adminGetTransactions(token, args);
      } catch (error) {
        logger.warn(`adminAllTransactions failed: ${error.message}`);
        return { transactions: [], total: 0, page: 1, pageSize: 50 };
      }
    },

    adminRevenueSummary: async (_, __, { token, clients, logger }) => {
      try {
        return await clients.payments.adminGetRevenueSummary(token);
      } catch (error) {
        logger.warn(`adminRevenueSummary failed: ${error.message}`);
        return { totalRevenue: 0, revenue30d: 0, revenue7d: 0, subRevenue: 0, productRevenue: 0, refunds: 0, currency: 'GBP' };
      }
    },

    adminPlans: async (_, __, { token, clients, logger }) => {
      try {
        return await clients.payments.adminGetPlans(token);
      } catch (error) {
        logger.warn(`adminPlans failed: ${error.message}`);
        return [];
      }
    },

    adminMarketplaceRevenue: async (_, __, { token, clients, logger }) => {
      try {
        return await clients.marketplace.adminGetMarketplaceRevenue(token);
      } catch (error) {
        logger.warn(`adminMarketplaceRevenue failed: ${error.message}`);
        return { gmv: 0, platformFees: 0, shippingCollected: 0, walletUsed: 0, refundedTotal: 0, stripeFeeEstimate: 0, gmv30d: 0, gmv7d: 0, platformFees30d: 0, totalOrders: 0, completedOrders: 0, openDisputes: 0, resolvedDisputes: 0, monthly: [], currency: 'GBP' };
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

    shippingLabelTracking: async (_, { id }, { token, clients, logger }) => {
      try {
        return await clients.shipping.getLabelTracking(token, id);
      } catch (error) {
        logger.warn(`shippingLabelTracking failed: ${error.message}`);
        throw error;
      }
    },

    orderTracking: async (_, { orderId }, { token, clients, logger }) => {
      try {
        // Verify the requesting user has access to this order (buyer or seller)
        await clients.marketplace.getOrder(token, orderId);
        // Then fetch tracking via internal endpoint (no re-auth needed)
        return await clients.shipping.getOrderTracking(orderId);
      } catch (error) {
        logger.warn(`orderTracking failed for orderId=${orderId}: ${error.message}`);
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

    hasAgreedToMarketplaceRules: async (_, __, { token, clients, logger }) => {
      try {
        return await clients.marketplace.hasAgreedToMarketplaceRules(token);
      } catch (error) {
        logger.warn(`hasAgreedToMarketplaceRules failed: ${error.message}`);
        return false;
      }
    },

    marketplaceRules: async (_, __, { clients, logger }) => {
      try {
        const data = await clients.marketplace.getMarketplaceRules();
        return data?.rules ?? [];
      } catch (error) {
        logger.warn(`marketplaceRules failed: ${error.message}`);
        return [];
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

    myWallet: async (_, { limit = 20, offset = 0 }, { token, clients, logger }) => {
      if (!token) throw new Error('Not authenticated');
      try {
        return await clients.payments.getMyWallet(token, { limit, offset });
      } catch (error) {
        logger.warn(`myWallet failed: ${error.message}`);
        throw error;
      }
    },

    adminWithdrawals: async (_, { status = 'pending', limit = 20, offset = 0 }, { token, clients, logger }) => {
      if (!token) throw new Error('Not authenticated');
      try {
        return await clients.payments.adminListWithdrawals(token, { status, limit, offset });
      } catch (error) {
        logger.warn(`adminWithdrawals failed: ${error.message}`);
        throw error;
      }
    },

    mySubscription: async (_, __, { token, clients, logger }) => {
      try {
        // payments-service returns { active, subscription } — unwrap to the sub object or null
        const result = await clients.payments.getMySubscription(token);
        return result?.subscription ?? null;
      } catch (error) {
        logger.warn(`mySubscription failed: ${error.message}`);
        return null;
      }
    },

    myCapabilities: async (_, __, { token, clients, logger }) => {
      const FREE_DEFAULTS = {
        planName: 'Free', platformFeePercent: 7,
        maxBinders: 3, maxCollectionCards: null, // collection is never capped
        maxActiveListings: 5, maxActiveTrades: 3, features: [],
      };
      if (!token) return FREE_DEFAULTS;
      try {
        // Decode JWT payload to get userId without an extra auth round-trip
        const [, payloadB64] = token.split('.');
        const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
        const userId = payload.sub;
        if (!userId) return FREE_DEFAULTS;
        return await clients.payments.getMyCapabilities(userId);
      } catch (error) {
        logger.warn(`myCapabilities failed: ${error.message}`);
        return FREE_DEFAULTS;
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
        logger.error(`searchCards failed: ${error.message}`);
        throw new Error(`Card search unavailable: ${error.message}`);
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

    exportUserData: async (_, _args, { token, clients, logger }) => {
      try {
        const data = await clients.users.exportUserData(token);
        return typeof data === 'string' ? data : JSON.stringify(data);
      } catch (error) {
        logger.warn(`exportUserData failed: ${error.message}`);
        throw error;
      }
    },

    // ── Collection ──────────────────────────────────────────────────────────────

    addToCollection: async (_, args, { token, req, clients, logger }) => {
      const entry = await clients.collections.addToCollection(token, req, args);
      return entry ? hydrateCards(entry, clients.catalog, logger) : entry;
    },

    updateCollectionEntry: async (_, args, { token, req, clients, logger }) => {
      const entry = await clients.collections.updateCollection(token, req, args);
      return entry ? hydrateCards(entry, clients.catalog, logger) : entry;
    },

    removeFromCollection: async (_, { cardId, variation }, { token, req, clients }) => {
      const result = await clients.collections.removeFromCollection(token, req, { cardId, variation });
      return result?.ok ?? false;
    },

    moveToWishlist: async (_, { cardId, variation }, { token, req, clients }) => {
      const result = await clients.collections.moveToWishlist(token, req, { cardId, variation });
      return result?.ok ?? false;
    },

    moveToCollection: async (_, { cardId, variation }, { token, req, clients, logger }) => {
      const entry = await clients.collections.moveFromWishlist(token, req, { cardId, variation });
      return entry ? hydrateCards(entry, clients.catalog, logger) : entry;
    },

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

    agreeToMarketplaceRules: async (_, __, { token, clients, logger }) => {
      try {
        return await clients.marketplace.agreeToMarketplaceRules(token);
      } catch (error) {
        logger.warn(`agreeToMarketplaceRules failed: ${error.message}`);
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

    addToWishlist: async (_, args, { token, req, clients, logger }) => {
      const entry = await clients.collections.addToWishlist(token, req, args);
      return entry ? hydrateCards(entry, clients.catalog, logger) : entry;
    },

    updateWishlistEntry: async (_, args, { token, req, clients, logger }) => {
      const entry = await clients.collections.updateWishlistEntry(token, req, args);
      return entry ? hydrateCards(entry, clients.catalog, logger) : entry;
    },

    removeFromWishlist: async (_, { cardId, variation }, { token, req, clients }) => {
      const result = await clients.collections.removeFromWishlist(token, req, { cardId, variation });
      return result?.ok ?? false;
    },

    // ── Binder ──────────────────────────────────────────────────────────────────

    addBinderPage: async (_, { binderId, input }, { token, req, clients, logger }) => {
      try {
        return await clients.collections.addBinderPage(token, req, binderId, input);
      } catch (error) {
        logger.warn(`addBinderPage failed: ${error.message}`);
        throw error;
      }
    },

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

    createBulkListings: async (_, { listings }, { token, clients, logger }) => {
      try {
        const data = await clients.marketplace.createBulkListings(token, listings);
        return {
          batchId:            data.batchId,
          proofCode:          data.proofCode,
          proofCodeExpiresAt: data.proofCodeExpiresAt ?? null,
          count:              data.count,
          listings:           data.listings ?? [],
        };
      } catch (error) {
        logger.warn(`createBulkListings failed: ${error.message}`);
        throw error;
      }
    },

    submitBulkProof: async (_, { batchId, image }, { token, clients, logger }) => {
      try {
        const data = await clients.marketplace.submitBulkProof(token, batchId, image);
        return {
          ok:           data?.ok ?? true,
          result:       data?.result ?? 'approved',
          activated:    data?.activated ?? 0,
          newProofCode: data?.newProofCode ?? null,
        };
      } catch (error) {
        if (error.message?.includes('expired')) {
          return { ok: false, result: 'expired', activated: 0, newProofCode: error.data?.newProofCode ?? null };
        }
        logger.warn(`submitBulkProof failed: ${error.message}`);
        throw error;
      }
    },

    submitListingProof: async (_, { id, image }, { token, clients, logger }) => {
      try {
        const data = await clients.marketplace.submitListingProof(token, id, image);
        return {
          ok:           data?.ok ?? true,
          result:       data?.result ?? 'approved',
          newProofCode: data?.newProofCode ?? null,
        };
      } catch (error) {
        // 410 expired — service returns newProofCode in the error body
        if (error.status === 410 || error.message?.includes('expired')) {
          return { ok: false, result: 'expired', newProofCode: error.data?.newProofCode ?? null };
        }
        logger.warn(`submitListingProof failed: ${error.message}`);
        throw error;
      }
    },

    updateListing: async (_, { id, input }, { token, clients, logger }) => {
      try {
        return await clients.marketplace.updateListing(token, id, input);
      } catch (error) {
        logger.warn(`updateListing failed: ${error.message}`);
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

    submitOrderTracking: async (_, { id, trackingNumber, carrier }, { token, clients, logger }) => {
      try {
        await clients.marketplace.submitOrderTracking(token, id, { trackingNumber, trackingCarrier: carrier });
        return await clients.marketplace.getOrder(token, id);
      } catch (error) {
        logger.warn(`submitOrderTracking failed: ${error.message}`);
        throw error;
      }
    },

    applyWalletToOrder: async (_, { orderId, walletAmountPence }, { token, clients, logger }) => {
      try {
        return await clients.marketplace.applyWalletToOrder(token, orderId, walletAmountPence);
      } catch (e) {
        logger.warn(`applyWalletToOrder failed: ${e.message}`);
        throw e;
      }
    },

    shipOrder: async (_, { id }, { token, clients, logger }) => {
      try {
        const result = await clients.marketplace.shipOrder(token, id);
        return { ok: true, ...result };
      } catch (error) {
        logger.warn(`shipOrder failed: ${error.message}`);
        throw error;
      }
    },

    updateSellerAddress: async (_, { input }, { token, clients, logger }) => {
      try {
        await clients.marketplace.updateSellerAddress(token, input);
        return true;
      } catch (error) {
        logger.warn(`updateSellerAddress failed: ${error.message}`);
        throw error;
      }
    },

    confirmOrderReceived: async (_, { id }, { token, clients, logger }) => {
      try {
        await clients.marketplace.confirmOrderReceived(token, id);
        return await clients.marketplace.getOrder(token, id);
      } catch (error) {
        logger.warn(`confirmOrderReceived failed: ${error.message}`);
        throw error;
      }
    },

    raiseOrderDispute: async (_, { id, reason }, { token, clients, logger }) => {
      try {
        await clients.marketplace.raiseOrderDispute(token, id, reason);
        return await clients.marketplace.getOrder(token, id);
      } catch (error) {
        logger.warn(`raiseOrderDispute failed: ${error.message}`);
        throw error;
      }
    },

    cancelOrder: async (_, { id, reason }, { token, clients, logger }) => {
      try {
        await clients.marketplace.cancelOrder(token, id, reason);
        return await clients.marketplace.getOrder(token, id);
      } catch (error) {
        logger.warn(`cancelOrder failed: ${error.message}`);
        throw error;
      }
    },

    disputeOrderReview: async (_, { id, reason }, { token, clients, logger }) => {
      try {
        await clients.marketplace.disputeOrderReview(token, id, reason);
        return true;
      } catch (error) {
        logger.warn(`disputeOrderReview failed: ${error.message}`);
        return false;
      }
    },

    leaveOrderFeedback: async (_, { id, rating, review }, { token, clients, logger }) => {
      try {
        await clients.marketplace.leaveOrderFeedback(token, id, { rating, review });
        return true;
      } catch (error) {
        logger.warn(`leaveOrderFeedback failed: ${error.message}`);
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

    // ── Wallet mutations ──────────────────────────────────────────────────────

    createTopupIntent: async (_, { amountPence }, { token, clients, logger }) => {
      if (!token) throw new Error('Not authenticated');
      try {
        return await clients.payments.createTopupIntent(token, { amountPence });
      } catch (error) {
        logger.warn(`createTopupIntent failed: ${error.message}`);
        throw error;
      }
    },

    confirmTopup: async (_, { paymentIntentId }, { token, clients, logger }) => {
      if (!token) throw new Error('Not authenticated');
      try {
        const result = await clients.payments.confirmTopup(token, paymentIntentId);
        return result.wallet;
      } catch (error) {
        logger.warn(`confirmTopup failed: ${error.message}`);
        throw error;
      }
    },

    requestWithdrawal: async (_, { amountPence, sortCode, accountNumber, accountName }, { token, clients, logger }) => {
      if (!token) throw new Error('Not authenticated');
      try {
        return await clients.payments.requestWithdrawal(token, { amountPence, sortCode, accountNumber, accountName });
      } catch (error) {
        logger.warn(`requestWithdrawal failed: ${error.message}`);
        throw error;
      }
    },

    adminCompleteWithdrawal: async (_, { id }, { token, clients, logger }) => {
      if (!token) throw new Error('Not authenticated');
      try {
        await clients.payments.adminCompleteWithdrawal(token, id);
        return true;
      } catch (error) {
        logger.warn(`adminCompleteWithdrawal failed: ${error.message}`);
        throw error;
      }
    },

    adminRejectWithdrawal: async (_, { id, reason }, { token, clients, logger }) => {
      if (!token) throw new Error('Not authenticated');
      try {
        await clients.payments.adminRejectWithdrawal(token, id, reason);
        return true;
      } catch (error) {
        logger.warn(`adminRejectWithdrawal failed: ${error.message}`);
        throw error;
      }
    },

    // ── Subscription mutations ────────────────────────────────────────────────

    createSubscription: async (_, { planId }, { token, clients, logger }) => {
      try {
        // Returns { url, sessionId } — redirect user to url for Stripe Checkout
        return await clients.payments.createSubscription(token, { planId });
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

    updateSubscription: async (_, { planId }, { token, clients, logger }) => {
      try {
        return await clients.payments.changePlan(token, planId);
      } catch (error) {
        logger.warn(`updateSubscription failed: ${error.message}`);
        throw error;
      }
    },

    // ── Trading mutations ─────────────────────────────────────────────────────

    initiateTrade: async (_, { userId, offeredCards, wantedCards, topUpAmount }, { token, clients, logger }) => {
      try {
        return await clients.trading.initiateTrade(token, { userId, offeredCards: offeredCards ?? [], wantedCards: wantedCards ?? [], topUpAmount: topUpAmount ?? null });
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

    adminApproveProof: async (_, { id }, { token, clients, logger }) => {
      try {
        await clients.marketplace.adminApproveProof(token, id);
        return true;
      } catch (error) {
        logger.warn(`adminApproveProof failed: ${error.message}`);
        throw error;
      }
    },

    adminRejectProof: async (_, { id, reason }, { token, clients, logger }) => {
      try {
        await clients.marketplace.adminRejectProof(token, id, reason);
        return true;
      } catch (error) {
        logger.warn(`adminRejectProof failed: ${error.message}`);
        throw error;
      }
    },

    adminResolveDispute: async (_, { id, resolution, resolvedInFavourOf }, { token, clients, logger }) => {
      try {
        await clients.marketplace.adminResolveDispute(token, id, { resolution, resolvedInFavourOf });
        return true;
      } catch (error) {
        logger.warn(`adminResolveDispute failed: ${error.message}`);
        throw error;
      }
    },

    adminResolveReview: async (_, { listingId, action }, { token, clients, logger }) => {
      try {
        await clients.marketplace.adminResolveReview(token, listingId, action);
        return true;
      } catch (error) {
        logger.warn(`adminResolveReview failed: ${error.message}`);
        throw error;
      }
    },

    adminCancelSubscription: async (_, { id }, { token, clients, logger }) => {
      try {
        await clients.payments.adminCancelSubscription(token, id);
        return true;
      } catch (error) {
        logger.warn(`adminCancelSubscription failed: ${error.message}`);
        throw error;
      }
    },

    adminResumeSubscription: async (_, { id }, { token, clients, logger }) => {
      try {
        await clients.payments.adminResumeSubscription(token, id);
        return true;
      } catch (error) {
        logger.warn(`adminResumeSubscription failed: ${error.message}`);
        throw error;
      }
    },

    adminChangePlan: async (_, { id, planId }, { token, clients, logger }) => {
      try {
        await clients.payments.adminChangePlan(token, id, planId);
        return true;
      } catch (error) {
        logger.warn(`adminChangePlan failed: ${error.message}`);
        throw error;
      }
    },

    adminGrantSubscription: async (_, { userId, planId, periodDays }, { token, clients, logger }) => {
      try {
        await clients.payments.adminGrantSubscription(token, { userId, planId, periodDays });
        return true;
      } catch (error) {
        logger.warn(`adminGrantSubscription failed: ${error.message}`);
        throw error;
      }
    },

    adminRevokeSubscription: async (_, { id }, { token, clients, logger }) => {
      try {
        await clients.payments.adminRevokeSubscription(token, id);
        return true;
      } catch (error) {
        logger.warn(`adminRevokeSubscription failed: ${error.message}`);
        throw error;
      }
    },

    adminUpdatePlan: async (_, { id, input }, { token, clients, logger }) => {
      try {
        return await clients.payments.adminUpdatePlanDetails(token, id, input);
      } catch (error) {
        logger.warn(`adminUpdatePlan failed: ${error.message}`);
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

    createCartOrders: async (_, { items, walletAmountPence = 0 }, { token, clients, logger }) => {
      const orders = [];
      const errors = [];
      let remainingWallet = Math.max(0, Math.round(Number(walletAmountPence) || 0));

      for (const item of items) {
        try {
          const order = await clients.marketplace.buyListing(token, item.listingId, {
            buyerAddress:      item.buyerAddress,
            shippingRateId:    item.shippingRateId,
            shipmentId:        item.shipmentId,
            walletAmountPence: remainingWallet,
          });
          orders.push(order);
          remainingWallet = Math.max(0, remainingWallet - (order.walletAmountPence || 0));
        } catch (err) {
          logger.warn(`createCartOrders: item ${item.listingId} failed: ${err.message}`);
          errors.push({ listingId: item.listingId, error: err.message });
        }
      }
      return { orders, errors };
    },

    // ── Safety mutations ──────────────────────────────────────────────────────────

    updateSafetyProfile: async (_, { dob, parentEmail }, { token, clients, logger }) => {
      try {
        const result = await clients.users.updateSafetyProfile(token, { dob, parentEmail });
        // user-service returns the updated user/profile — wrap in envelope
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

    // ── Shipping mutations ────────────────────────────────────────────────────

    createShippingLabel: async (_, { to, from, parcel, parcelSize, shipmentId, rateId, relatedType, relatedId }, { token, clients, logger }) => {
      try {
        return await clients.shipping.createLabel(token, {
          to, from, parcel, parcelSize, shipmentId, rateId, relatedType, relatedId,
        });
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

  // ── Interface resolvers ───────────────────────────────────────────────────────

  ListingBase: {
    __resolveType(obj) {
      if (obj.cardId) return 'CardListing';
      return 'ProductListing';
    },
  },

  // ── Field resolvers ───────────────────────────────────────────────────────────

  CardListing: {
    type:      () => 'CARD',
    variation: (obj) => obj.variation ?? obj.variant ?? null,
    seller:    async (obj, _, { clients, logger }) => {
      if (!obj.sellerId) return null;
      try {
        const profile = await clients.users.getProfileById(obj.sellerId);
        if (!profile) return null;
        // getProfileById returns UserProfile shape; map to PublicUser
        const u = profile.user ?? {};
        return {
          id:       u.id       ?? profile.userId ?? null,
          username: u.username ?? null,
          avatar:   profile.avatar ?? u.avatar ?? null,
          bio:      profile.bio ?? null,
          country:  profile.country ?? null,
          createdAt: u.createdAt ?? null,
        };
      } catch (e) {
        logger?.warn?.(`CardListing.seller failed for ${obj.sellerId}: ${e.message}`);
        return null;
      }
    },
    cardInfo: async (obj, _, { clients, logger }) => {
      if (!obj.cardId) return null;
      try {
        const card = await clients.catalog.getCard(obj.cardId);
        if (!card) return null;
        return {
          id:         card.id         ?? null,
          name:       card.name       ?? null,
          number:     card.number     ?? null,
          rarity:     card.rarity     ?? null,
          setName:    card.set?.name  ?? null,
          imageSmall: card.images?.small ?? null,
          imageLarge: card.images?.large ?? null,
        };
      } catch (e) {
        logger?.warn?.(`CardListing.cardInfo failed for ${obj.cardId}: ${e.message}`);
        return null;
      }
    },
    proofImageUrl: (obj) =>
      obj.moderationResult === 'approved' ? `/marketplace-proof/${obj.id}` : null,
  },

  ProductListing: {
    type:       () => 'PRODUCT',
    allowOffers: (obj) => obj.allowOffers ?? null,
  },

  Order: {
    // Alias fields the frontend expects
    orderNumber:        (obj) => obj.orderNumber ?? obj.id,
    total:              (obj) => obj.total ?? obj.totalAmount,
    status:             (obj) => obj.paymentStatus ?? obj.status ?? null,
    paidAt:             (obj) => obj.paidAt ?? obj.capturedAt,
    shippingAddressJson:(obj) => obj.shippingAddressJson ?? obj.buyerAddressJson,
    // DB column is stripeClientSecret; GQL schema exposes it as clientSecret
    clientSecret:       (obj) => obj.clientSecret ?? obj.stripeClientSecret ?? null,

    buyer: async (obj, _, { clients, logger }) => {
      if (!obj.buyerId) return null;
      try {
        const profile = await clients.users.getProfileById(obj.buyerId);
        if (!profile) return null;
        const u = profile.user ?? {};
        return { id: u.id ?? profile.userId ?? obj.buyerId, username: u.username ?? null, avatar: profile.avatar ?? u.avatar ?? null };
      } catch (e) { logger?.warn?.(`Order.buyer failed: ${e.message}`); return null; }
    },

    seller: async (obj, _, { clients, logger }) => {
      if (!obj.sellerId) return null;
      try {
        const profile = await clients.users.getProfileById(obj.sellerId);
        if (!profile) return null;
        const u = profile.user ?? {};
        return { id: u.id ?? profile.userId ?? obj.sellerId, username: u.username ?? null, avatar: profile.avatar ?? u.avatar ?? null };
      } catch (e) { logger?.warn?.(`Order.seller failed: ${e.message}`); return null; }
    },

    listing: async (obj, _, { clients, logger }) => {
      if (!obj.listingId) return null;
      try {
        return await clients.marketplace.getListing(obj.listingId);
      } catch (e) {
        // 404 = listing was sold/deleted, which is expected — don't spam warn logs
        if (e.status !== 404) logger?.warn?.(`Order.listing failed: ${e.message}`);
        return null;
      }
    },
  },

  Offer: {
    buyer: async (obj, _, { clients, logger }) => {
      const id = obj.buyerId;
      if (!id) return null;
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
        logger?.warn?.(`Offer.buyer failed for ${id}: ${e.message}`);
        return null;
      }
    },

    listing: async (obj, _, { clients, logger }) => {
      const id = obj.listingId ?? obj.CardListing?.id;
      if (!id) return obj.CardListing ?? null;
      // If the marketplace-service already embedded the CardListing, use it
      if (obj.CardListing) return obj.CardListing;
      try {
        return await clients.marketplace.getListing(id);
      } catch (e) {
        logger?.warn?.(`Offer.listing failed for ${id}: ${e.message}`);
        return null;
      }
    },
  },

  UserProfile: {
    planName: async (obj, _, { clients, logger }) => {
      const userId = obj.userId ?? obj.user?.id ?? obj.id ?? null;
      if (!userId) return null;
      try {
        const { getUserPlanName } = await import('../clients/paymentsClient.js');
        const name = await getUserPlanName(userId);
        // Return null for Free so the frontend can skip rendering a badge
        return (name && name !== 'Free') ? name : null;
      } catch (e) {
        logger?.warn?.(`UserProfile.planName failed for ${userId}: ${e.message}`);
        return null;
      }
    },
  },

  SubscriptionPlan: {
    stripePriceIdMonthly: (obj) => obj.interval === 'month' ? (obj.stripePriceIdMonthly ?? obj.stripePriceId ?? null) : null,
    stripePriceIdYearly:  (obj) => obj.interval === 'year'  ? (obj.stripePriceIdYearly  ?? obj.stripePriceId ?? null) : null,
  },

  ChatThread: {
    user: async (obj, _, { clients, logger }) => {
      const id = obj.userId ?? obj.user?.id ?? null;
      if (!id) return null;
      // Return immediately if the messaging-service already hydrated user info
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
