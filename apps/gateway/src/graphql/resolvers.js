import { checkDatabaseHealth } from '@sbf/database';

/**
 * Tiny JSON scalar implementation for internal health/debug payloads.
 * Good enough for now without pulling in extra scalar packages.
 */
const JSONScalar = {
  __serialize(value) {
    return value;
  },
  __parseValue(value) {
    return value;
  },
  __parseLiteral() {
    return null;
  },
};

export const resolvers = {
  JSON: JSONScalar,

  Query: {
    health: async () => {
      return {
        status: 'ok',
        service: 'gateway',
      };
    },

    dbHealth: async () => {
      return checkDatabaseHealth();
    },

    serviceHealth: async (_, __, { clients, logger }) => {
      let auth = null;
      let catalog = null;

      try {
        auth = await clients.auth.getMe(null);
      } catch (error) {
        logger.warn(`Auth service health-style probe failed: ${error.message}`);
        auth = {
          status: 'down',
          error: error.message,
        };
      }

      try {
        catalog = await clients.catalog.getHealth();
      } catch (error) {
        logger.warn(`Catalog service health-style probe failed: ${error.message}`);
        catalog = {
          status: 'down',
          error: error.message,
        };
      }

      return {
        gateway: {
          status: 'ok',
          service: 'gateway',
        },
        auth,
        catalog,
      };
    },

    me: async (_, __, { token, clients, logger }) => {
      if (!token) {
        return null;
      }

      try {
        const result = await clients.auth.getMe(token);
        return result?.user || result || null;
      } catch (error) {
        logger.warn(`Failed to resolve me via auth-service: ${error.message}`);
        return null;
      }
    },

    // ── Collection ──────────────────────────────────────────────────────────────

    myCollection: async (_, __, { token, req, clients }) => {
      return clients.collections.getMyCollection(token, req);
    },

    collection: async (_, { userId }, { clients }) => {
      return clients.collections.getCollection(userId);
    },

    collectionEntry: async (_, { cardId, variation }, { token, req, clients }) => {
      return clients.collections.getCollectionEntry(token, req, { cardId, variation });
    },

    // ── Wishlist ────────────────────────────────────────────────────────────────

    myWishlist: async (_, { page, pageSize }, { token, req, clients }) => {
      return clients.collections.getMyWishlist(token, req, { page, pageSize });
    },

    wishlist: async (_, { userId, page, pageSize }, { clients }) => {
      return clients.collections.getWishlist(userId, { page, pageSize });
    },

    wishlistEntry: async (_, { cardId, variation }, { token, req, clients }) => {
      return clients.collections.getWishlistEntry(token, req, { cardId, variation });
    },

    // ── Binder ──────────────────────────────────────────────────────────────────

    myBinders: async (_, __, { token, req, clients }) => {
      return clients.collections.getMyBinders(token, req);
    },

    binder: async (_, { id, slug }, { token, req, clients }) => {
      return clients.collections.getBinder(id || slug, token, req);
    },

    browseBinders: async (_, { page, pageSize, userId, search }, { clients }) => {
      return clients.collections.browseBinders({ page, pageSize, userId, search });
    },
  },

  Mutation: {
    login: async (_, args, { clients }) => {
      return clients.auth.login(args);
    },

    register: async (_, args, { clients }) => {
      return clients.auth.register(args);
    },

    // ── Collection ──────────────────────────────────────────────────────────────

    addToCollection: async (_, args, { token, req, clients }) => {
      return clients.collections.addToCollection(token, req, args);
    },

    updateCollectionEntry: async (_, args, { token, req, clients }) => {
      return clients.collections.updateCollection(token, req, args);
    },

    removeFromCollection: async (_, { cardId, variation }, { token, req, clients }) => {
      const result = await clients.collections.removeFromCollection(token, req, { cardId, variation });
      return result?.ok ?? false;
    },

    moveToWishlist: async (_, { cardId, variation }, { token, req, clients }) => {
      const result = await clients.collections.moveToWishlist(token, req, { cardId, variation });
      return result?.ok ?? false;
    },

    moveToCollection: async (_, { cardId, variation }, { token, req, clients }) => {
      return clients.collections.moveFromWishlist(token, req, { cardId, variation });
    },

    bulkAddToCollection: async (_, { cards }, { token, req, clients }) => {
      return clients.collections.bulkAddToCollection(token, req, { cards });
    },

    // ── Wishlist ────────────────────────────────────────────────────────────────

    addToWishlist: async (_, args, { token, req, clients }) => {
      return clients.collections.addToWishlist(token, req, args);
    },

    updateWishlistEntry: async (_, args, { token, req, clients }) => {
      return clients.collections.updateWishlistEntry(token, req, args);
    },

    removeFromWishlist: async (_, { cardId, variation }, { token, req, clients }) => {
      const result = await clients.collections.removeFromWishlist(token, req, { cardId, variation });
      return result?.ok ?? false;
    },

    // ── Binder ──────────────────────────────────────────────────────────────────

    createBinder: async (_, { input }, { token, req, clients }) => {
      return clients.collections.createBinder(token, req, input);
    },

    updateBinder: async (_, { id, input }, { token, req, clients }) => {
      return clients.collections.updateBinder(token, req, id, input);
    },

    deleteBinder: async (_, { id, permanent }, { token, req, clients }) => {
      const result = await clients.collections.deleteBinder(token, req, id, { permanent });
      return result?.ok ?? false;
    },

    saveBinderPagesAndSlots: async (_, { binderId, pages }, { token, req, clients }) => {
      return clients.collections.saveBinderPagesAndSlots(token, req, binderId, pages);
    },
  },
};