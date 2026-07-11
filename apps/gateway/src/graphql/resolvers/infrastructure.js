import { checkDatabaseHealth } from '@sbf/database';

export const queries = {
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
};
