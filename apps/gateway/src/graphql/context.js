import { extractToken } from '../middleware/extractToken.js';
import * as authClient from '../clients/authClient.js';
import * as catalogClient from '../clients/catalogClient.js';
import * as collectionsClient from '../clients/collectionsClient.js';

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
      auth: authClient,
      catalog: catalogClient,
      collections: collectionsClient,
    },
  };
}