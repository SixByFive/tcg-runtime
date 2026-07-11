import { hydrateCards } from './utils.js';

export const queries = {
  cardSetCompletion: async (_, { setCode }, { token, req, clients }) =>
    clients.collections.getSetCompletion(token, req, setCode),

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

  myBinders: async (_, __, { token, req, clients }) =>
    clients.collections.getMyBinders(token, req),

  binder: async (_, { id, slug }, { token, req, clients }) =>
    clients.collections.getBinder(id || slug, token, req),

  browseBinders: async (_, { page, pageSize, userId, search }, { clients }) =>
    clients.collections.browseBinders({ page, pageSize, userId, search }),
};

export const mutations = {
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

  addCardToBinder: async (_, { pageId, input }, { token, req, clients, logger }) => {
    try {
      return await clients.collections.addCardToBinder(token, req, pageId, input);
    } catch (error) {
      logger.warn(`addCardToBinder failed: ${error.message}`);
      throw error;
    }
  },

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
};
