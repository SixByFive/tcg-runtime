import express from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
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
 * Build allowed origins from env plus sensible local defaults.
 */
function getAllowedOrigins() {
  const defaults = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:4010',
    'http://127.0.0.1:4010',
    'https://sandbox.embed.apollographql.com',
  ];

  const rawOrigins = process.env.CORS_ORIGINS || '';
  const envOrigins = rawOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return [...new Set([...defaults, ...envOrigins])];
}

/**
 * Creates the gateway Express app and mounts REST + GraphQL.
 */
export async function createApp({ logger }) {
  const app = express();
  const allowedOrigins = getAllowedOrigins();

  const corsOptions = {
    origin(origin, callback) {
      // Allow requests with no origin (curl, server-to-server, Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      logger.warn(`CORS blocked origin: ${origin}`);
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-internal-key',
      'x-admin-key',
      'x-client-type',
      'apollo-require-preflight',
      'x-apollo-operation-name',
    ],
  };

  // Apply CORS globally before all other middleware.
  app.use(cors(corsOptions));

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
    introspection: true,
    plugins: [
      ApolloServerPluginLandingPageLocalDefault({ embed: true }),
    ],
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