import { extractToken } from '../middleware/extractToken.js';
import * as authClient from '../clients/authClient.js';
import * as catalogClient from '../clients/catalogClient.js';
import * as collectionsClient from '../clients/collectionsClient.js';
import * as notificationsClient from '../clients/notificationsClient.js';
import * as messagingClient from '../clients/messagingClient.js';
import * as usersClient from '../clients/usersClient.js';
import * as marketplaceClient from '../clients/marketplaceClient.js';
import * as tradingClient from '../clients/tradingClient.js';
import * as paymentsClient from '../clients/paymentsClient.js';
import * as shippingClient from '../clients/shippingClient.js';

/**
 * GraphQL context builder for gateway.
 *
 * Gateway owns the public request context and delegates
 * real work to internal services.
 */
export async function buildContext({ req, res, logger }) {
  const token = extractToken(req);

  return {
    req,
    res,
    logger,
    token,
    clients: {
      auth:          authClient,
      catalog:       catalogClient,
      collections:   collectionsClient,
      notifications: notificationsClient,
      messaging:     messagingClient,
      users:         usersClient,
      marketplace:   marketplaceClient,
      trading:       tradingClient,
      payments:      paymentsClient,
      shipping:      shippingClient,
    },
  };
}