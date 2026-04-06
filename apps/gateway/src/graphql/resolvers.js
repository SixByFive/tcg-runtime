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
  },

  Mutation: {
    login: async (_, args, { clients }) => {
      return clients.auth.login(args);
    },

    register: async (_, args, { clients }) => {
      return clients.auth.register(args);
    },
  },
};