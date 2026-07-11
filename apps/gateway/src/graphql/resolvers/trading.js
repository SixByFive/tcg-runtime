export const queries = {
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

  quoteTradeShipping: async (_, { id }, { token, clients, logger }) => {
    try {
      return await clients.trading.quoteTradeShipping(token, id);
    } catch (error) {
      logger.warn(`quoteTradeShipping failed: ${error.message}`);
      throw error;
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
};

export const mutations = {
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

  setTradeShippingAddress: async (_, { id, address }, { token, clients, logger }) => {
    try {
      await clients.trading.setTradeShippingAddress(token, id, address);
      return true;
    } catch (error) {
      logger.warn(`setTradeShippingAddress failed: ${error.message}`);
      throw error;
    }
  },

  shipTrade: async (_, { id, parcelSize }, { token, clients, logger }) => {
    try {
      return await clients.trading.shipTrade(token, id, parcelSize);
    } catch (error) {
      logger.warn(`shipTrade failed: ${error.message}`);
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
};

export const types = {
  Trade: {
    addressASet: (obj) => obj.addressA != null && obj.addressA !== '',
    addressBSet: (obj) => obj.addressB != null && obj.addressB !== '',
  },
};
