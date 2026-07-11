export const queries = {
  cardsearchSets: async (_, { limit = 50, offset = 0 }, { clients, logger }) => {
    try {
      const result = await clients.catalog.getSets({ limit, offset });
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
      if (Array.isArray(result)) return result;
      if (result?.rollups) return result.rollups;
      return result ? [result] : [];
    } catch (error) {
      logger.warn(`cardsearchPriceRollups failed for ${cardId}: ${error.message}`);
      return [];
    }
  },

  myPriceAlerts: async (_, __, { token, clients, logger }) => {
    try {
      return await clients.catalog.getPriceAlerts(token) ?? [];
    } catch (error) {
      logger.warn(`myPriceAlerts failed: ${error.message}`);
      return [];
    }
  },
};

export const mutations = {
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
};
