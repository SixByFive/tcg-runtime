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

  // ── Media / upload proxy ──────────────────────────────────────────────────
  // Must be registered BEFORE express.json() so the raw multipart body is
  // still available as a readable stream (express.json only parses JSON, but
  // better to be explicit about ordering).
  const MEDIA_URL = process.env.MEDIA_SERVICE_URL || 'http://media-service:4017';

  // Proxy static media files: GET /uploads/* → media-service /uploads/*
  app.use('/uploads', async (req, res) => {
    const target = `${MEDIA_URL}/uploads${req.url}`;
    try {
      const upstream = await fetch(target, { method: 'GET' });
      if (!upstream.ok) {
        return res.status(upstream.status).end();
      }
      const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
      const cacheControl = upstream.headers.get('cache-control');
      res.status(upstream.status);
      res.setHeader('content-type', contentType);
      if (cacheControl) res.setHeader('cache-control', cacheControl);
      res.send(Buffer.from(await upstream.arrayBuffer()));
    } catch (err) {
      logger.warn(`uploads proxy error: ${err.message}`);
      res.status(502).json({ error: 'media-service unavailable' });
    }
  });

  app.use('/upload', async (req, res) => {
    const target = `${MEDIA_URL}/upload${req.url}`;
    try {
      // Collect raw body (express hasn't consumed multipart streams)
      const body = await new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
      });

      const forwardHeaders = {};
      if (req.headers.authorization)        forwardHeaders.authorization        = req.headers.authorization;
      if (req.headers['content-type'])      forwardHeaders['content-type']      = req.headers['content-type'];
      if (req.headers['x-current-avatar'])  forwardHeaders['x-current-avatar']  = req.headers['x-current-avatar'];

      const upstream = await fetch(target, {
        method: req.method,
        headers: forwardHeaders,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined,
      });

      const contentType = upstream.headers.get('content-type') || '';
      res.status(upstream.status);
      if (contentType) res.setHeader('content-type', contentType);
      res.send(Buffer.from(await upstream.arrayBuffer()));
    } catch (err) {
      logger.warn(`upload proxy error: ${err.message}`);
      res.status(502).json({ error: 'media-service unavailable' });
    }
  });

  // ── Stripe webhook proxy ─────────────────────────────────────────────────
  // MUST be before express.json() — Stripe signature verification requires
  // the raw body bytes, not a parsed object.
  const PAYMENTS_URL = process.env.PAYMENTS_SERVICE_URL || 'http://localhost:4019';

  app.use('/webhooks/stripe', async (req, res) => {
    const target = `${PAYMENTS_URL}/webhooks/stripe`;
    try {
      const body = await new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end',  () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
      });

      const forwardHeaders = {
        'content-type': req.headers['content-type'] || 'application/json',
      };
      if (req.headers['stripe-signature']) {
        forwardHeaders['stripe-signature'] = req.headers['stripe-signature'];
      }

      const upstream = await fetch(target, {
        method:  'POST',
        headers: forwardHeaders,
        body,
      });

      const contentType = upstream.headers.get('content-type') || '';
      res.status(upstream.status);
      if (contentType) res.setHeader('content-type', contentType);
      res.send(await upstream.text());
    } catch (err) {
      logger.warn(`webhook proxy error: ${err.message}`);
      res.status(502).json({ error: 'payments-service unavailable' });
    }
  });

  app.use(express.json({ limit: '10mb' }));

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

  // ── Auth REST proxy ───────────────────────────────────────────────────────
  // Proxies auth REST endpoints that the browser calls directly
  // (logout, email verification, Discord OAuth) to auth-service.
  const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:4011';

  app.use('/auth', async (req, res) => {
    const target = `${AUTH_URL}/auth${req.url}`;
    try {
      const forwardHeaders = { 'Content-Type': 'application/json' };
      if (req.headers.authorization) forwardHeaders.authorization = req.headers.authorization;
      if (req.headers.cookie) forwardHeaders.cookie = req.headers.cookie;
      // Forward so auth-service knows whether to return tokens in body (mobile/admin)
      // or set HttpOnly cookies (web browser). Without this, admin app never gets tokens.
      if (req.headers['x-client-type']) forwardHeaders['x-client-type'] = req.headers['x-client-type'];
      if (req.headers['x-admin-key'])   forwardHeaders['x-admin-key']   = req.headers['x-admin-key'];

      const isGet = req.method === 'GET' || req.method === 'HEAD';
      const upstream = await fetch(target, {
        method: req.method,
        headers: forwardHeaders,
        body: isGet ? undefined : JSON.stringify(req.body),
        redirect: 'manual',
      });

      // Forward Set-Cookie headers (e.g. Discord OAuth flow sets cookies)
      const setCookie = upstream.headers.get('set-cookie');
      if (setCookie) res.setHeader('set-cookie', setCookie);

      // Handle redirects from Discord OAuth callback
      const location = upstream.headers.get('location');
      if (location && upstream.status >= 300 && upstream.status < 400) {
        return res.redirect(upstream.status, location);
      }

      const contentType = upstream.headers.get('content-type') || '';
      res.status(upstream.status);
      if (contentType) res.setHeader('content-type', contentType);
      const body = await upstream.text();
      res.send(body || '');
    } catch (err) {
      logger.warn(`auth proxy error: ${err.message}`);
      res.status(502).json({ error: 'auth-service unavailable' });
    }
  });

  // ── Checkout proxy ───────────────────────────────────────────────────────
  // Forwards /checkout/* → payments-service /payments/*
  app.use('/checkout', async (req, res) => {
    const target = `${PAYMENTS_URL}/payments${req.url === '/' ? '' : req.url}`;
    try {
      const forwardHeaders = { 'Content-Type': 'application/json' };
      if (req.headers.authorization) forwardHeaders.authorization = req.headers.authorization;

      const upstream = await fetch(target, {
        method: req.method,
        headers: forwardHeaders,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
      });

      const contentType = upstream.headers.get('content-type') || '';
      res.status(upstream.status);
      if (contentType) res.setHeader('content-type', contentType);
      res.send(await upstream.text());
    } catch (err) {
      logger.warn(`checkout proxy error: ${err.message}`);
      res.status(502).json({ error: 'payments-service unavailable' });
    }
  });

  // ── Marketplace proof-image proxy ────────────────────────────────────────
  // Serves approved proof images from marketplace-service to the browser.
  // Path kept generic so we don't leak internal file paths.
  const MARKETPLACE_URL = process.env.MARKETPLACE_SERVICE_URL || 'http://localhost:4014';
  app.get('/marketplace-proof/:listingId', async (req, res) => {
    const target = `${MARKETPLACE_URL}/marketplace/listings/${encodeURIComponent(req.params.listingId)}/proof-image`;
    try {
      const upstream = await fetch(target);
      if (!upstream.ok) return res.status(upstream.status).end();
      const contentType = upstream.headers.get('content-type') || 'image/jpeg';
      res.setHeader('content-type', contentType);
      res.setHeader('cache-control', 'public, max-age=3600');
      res.send(Buffer.from(await upstream.arrayBuffer()));
    } catch (err) {
      logger.warn(`marketplace-proof proxy error: ${err.message}`);
      res.status(502).end();
    }
  });

  // ── Catalog admin proxy ───────────────────────────────────────────────────
  // Forwards /catalog-admin/* → catalog-service /admin/* so the admin UI is
  // reachable from the host via the gateway's published port.
  const CATALOG_URL = process.env.CATALOG_SERVICE_URL || 'http://localhost:4012';
  app.use('/catalog-admin', async (req, res) => {
    if (req.url === '/ui') return res.redirect(302, '/catalog-admin/ui/');
    const target = `${CATALOG_URL}/admin${req.url === '/' ? '/ui/' : req.url}`;
    try {
      const upstream = await fetch(target, {
        method: req.method,
        headers: {
          'content-type': req.headers['content-type'] || 'application/json',
          ...(req.headers['x-admin-key'] ? { 'x-admin-key': req.headers['x-admin-key'] } : {}),
        },
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
      });
      const contentType = upstream.headers.get('content-type') || '';
      res.status(upstream.status);
      if (contentType) res.setHeader('content-type', contentType);
      if (contentType.includes('text') || contentType.includes('json') || contentType.includes('javascript')) {
        res.send(await upstream.text());
      } else {
        const buf = await upstream.arrayBuffer();
        res.send(Buffer.from(buf));
      }
    } catch (err) {
      logger.warn(`catalog-admin proxy error: ${err.message}`);
      res.status(502).json({ error: 'catalog-service unavailable' });
    }
  });

  // ── Docker management proxy ──────────────────────────────────────────────
  // Forwards /docker-admin/* → docker-mgmt service.
  // The x-admin-key is forwarded so the docker-mgmt service can authenticate.
  const DOCKER_MGMT_URL = process.env.DOCKER_MGMT_SERVICE_URL || 'http://docker-mgmt:4030';
  app.use('/docker-admin', async (req, res) => {
    const target = `${DOCKER_MGMT_URL}${req.url === '/' ? '' : req.url}`;
    try {
      const forwardHeaders = { 'Content-Type': 'application/json' };
      if (req.headers['x-admin-key']) forwardHeaders['x-admin-key'] = req.headers['x-admin-key'];

      const upstream = await fetch(target, {
        method: req.method,
        headers: forwardHeaders,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
      });

      const contentType = upstream.headers.get('content-type') || '';
      res.status(upstream.status);
      if (contentType) res.setHeader('content-type', contentType);
      res.send(await upstream.text());
    } catch (err) {
      logger.warn(`docker-admin proxy error: ${err.message}`);
      res.status(502).json({ error: 'docker-mgmt unavailable' });
    }
  });

  // ── Discord share proxy ───────────────────────────────────────────────────
  // Forwards /discord/share/* → user-service /discord/share/*
  const USER_URL = process.env.USER_SERVICE_URL || 'http://localhost:4021';
  app.use('/discord/share', async (req, res) => {
    const target = `${USER_URL}/discord/share${req.url}`;
    try {
      const upstream = await fetch(target, {
        method: req.method,
        headers: {
          'content-type': req.headers['content-type'] || 'application/json',
          ...(req.headers.authorization ? { authorization: req.headers.authorization } : {}),
        },
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
      });
      const json = await upstream.json().catch(() => null);
      res.status(upstream.status).json(json ?? {});
    } catch (err) {
      logger.warn(`discord-share proxy error: ${err.message}`);
      res.status(502).json({ error: 'user-service unavailable' });
    }
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