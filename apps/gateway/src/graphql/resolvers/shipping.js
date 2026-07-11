export const queries = {
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
};

export const mutations = {
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
};
