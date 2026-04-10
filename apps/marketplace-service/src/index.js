import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { getServicePort } from '@sbf/config';
import { createLogger } from '@sbf/logger';
import { initModels } from './models/index.js';
import listingsRouter  from './routes/listings.js';
import offersRouter    from './routes/offers.js';
import ordersRouter    from './routes/orders.js';
import sellerRouter    from './routes/seller.js';
import adminRouter     from './routes/admin.js';
import webhooksRouter  from './routes/webhooks.js';

const serviceName = 'marketplace-service';
const logger      = createLogger(serviceName);
const PORT        = getServicePort('MARKETPLACE_SERVICE_PORT', 4014);

const app = express();

// ─── Stripe webhook must receive raw body for signature verification ──────────
app.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    // Re-export to webhooks router after raw parsing
    req.rawBody = req.body;
    next();
  },
);

// ─── Standard middleware ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cookieParser());
app.use(express.json({ limit: '10mb' })); // 10MB for base64 proof images

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: serviceName });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
// Admin first to prevent /:id catching /admin/* segments
app.use('/marketplace/admin',    adminRouter);
app.use('/marketplace/listings', listingsRouter);
app.use('/marketplace/offers',   offersRouter);
app.use('/marketplace/orders',   ordersRouter);
app.use('/marketplace/seller',   sellerRouter);
app.use('/webhooks',             webhooksRouter);

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  logger.error(err.message);
  res.status(500).json({ error: err.message });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function start() {
  await initModels();
  app.listen(PORT, () => logger.info(`${serviceName} listening on port ${PORT}`));
}

start().catch((err) => {
  logger.error(`Failed to start: ${err.message}`);
  process.exit(1);
});
