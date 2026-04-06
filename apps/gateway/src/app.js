import express from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { typeDefs } from './graphql/schema.js';
import { resolvers } from './graphql/resolvers.js';
import { buildContext } from './graphql/context.js';
import { checkDatabaseHealth, getDatabaseConfig } from '@sbf/database';

/**
 * Small JSON sender helper so health and debug routes stay consistent.
 */
function sendJson(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}

/**
 * Creates the gateway Express app and mounts REST + GraphQL.
 */
export async function createApp({ logger }) {
  const app = express();

  app.use(express.json());

  app.get('/health', (_req, res) => {
    sendJson(res, 200, {
      status: 'ok',
      service: 'gateway',
    });
  });

  app.get('/graphql-health', (_req, res) => {
    res.status(200).send('OK');
  });

  app.get('/health/deps', async (_req, res) => {
    const db = await checkDatabaseHealth();

    sendJson(res, db.ok ? 200 : 503, {
      status: db.ok ? 'ok' : 'degraded',
      service: 'gateway',
      dependencies: {
        database: db,
      },
    });
  });

  app.get('/debug/db', (_req, res) => {
    const dbConfig = getDatabaseConfig();

    sendJson(res, 200, {
      service: 'gateway',
      envProfile: process.env.ENV_PROFILE || null,
      serviceName: process.env.SERVICE_NAME || null,
      database: {
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        name: dbConfig.name,
      },
    });
  });

  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    formatError: (error) => {
      logger.warn(`GraphQL Error: ${error.message}`);
      return error;
    },
  });

  await apolloServer.start();

  app.use(
    '/graphql',
    expressMiddleware(apolloServer, {
      context: async ({ req, res }) => {
        return buildContext({ req, res, logger });
      },
    })
  );

  return { app, apolloServer };
}