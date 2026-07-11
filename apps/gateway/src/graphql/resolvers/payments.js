export const queries = {
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
      maxBinders: 3, maxCollectionCards: null,
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
};

export const mutations = {
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

  createSubscription: async (_, { planId }, { token, clients, logger }) => {
    try {
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
};

export const types = {
  SubscriptionPlan: {
    stripePriceIdMonthly: (obj) => obj.interval === 'month' ? (obj.stripePriceIdMonthly ?? obj.stripePriceId ?? null) : null,
    stripePriceIdYearly:  (obj) => obj.interval === 'year'  ? (obj.stripePriceIdYearly  ?? obj.stripePriceId ?? null) : null,
  },
};
