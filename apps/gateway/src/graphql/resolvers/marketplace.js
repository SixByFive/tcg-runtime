export const queries = {
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

  adminMarketplaceRevenue: async (_, __, { token, clients, logger }) => {
    try {
      return await clients.marketplace.adminGetMarketplaceRevenue(token);
    } catch (error) {
      logger.warn(`adminMarketplaceRevenue failed: ${error.message}`);
      return { gmv: 0, platformFees: 0, shippingCollected: 0, walletUsed: 0, refundedTotal: 0, stripeFeeEstimate: 0, gmv30d: 0, gmv7d: 0, platformFees30d: 0, totalOrders: 0, completedOrders: 0, openDisputes: 0, resolvedDisputes: 0, monthly: [], currency: 'GBP' };
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
};

export const mutations = {
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
        ok:            result?.ok ?? true,
        status:        result?.status ?? action,
        orderId:       result?.orderId ?? null,
        clientSecret:  result?.clientSecret ?? null,
        totalAmount:   result?.totalAmount ?? null,
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

  agreeToMarketplaceRules: async (_, __, { token, clients, logger }) => {
    try {
      return await clients.marketplace.agreeToMarketplaceRules(token);
    } catch (error) {
      logger.warn(`agreeToMarketplaceRules failed: ${error.message}`);
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
};

export const types = {
  ListingBase: {
    __resolveType(obj) {
      if (obj.cardId) return 'CardListing';
      return 'ProductListing';
    },
  },

  CardListing: {
    type:      () => 'CARD',
    variation: (obj) => obj.variation ?? obj.variant ?? null,
    seller:    async (obj, _, { clients, logger }) => {
      if (!obj.sellerId) return null;
      try {
        const profile = await clients.users.getProfileById(obj.sellerId);
        if (!profile) return null;
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
    type:        () => 'PRODUCT',
    allowOffers: (obj) => obj.allowOffers ?? null,
  },

  Order: {
    orderNumber:         (obj) => obj.orderNumber ?? obj.id,
    total:               (obj) => obj.total ?? obj.totalAmount,
    status:              (obj) => obj.paymentStatus ?? obj.status ?? null,
    paidAt:              (obj) => obj.paidAt ?? obj.capturedAt,
    shippingAddressJson: (obj) => obj.shippingAddressJson ?? obj.buyerAddressJson,
    // DB column is stripeClientSecret; GQL schema exposes it as clientSecret
    clientSecret:        (obj) => obj.clientSecret ?? obj.stripeClientSecret ?? null,

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
        // 404 = listing was sold/deleted, which is expected
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
      if (obj.CardListing) return obj.CardListing;
      try {
        return await clients.marketplace.getListing(id);
      } catch (e) {
        logger?.warn?.(`Offer.listing failed for ${id}: ${e.message}`);
        return null;
      }
    },
  },
};
