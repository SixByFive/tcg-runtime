import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { getServicePort } from '@sbf/config';
import { createLogger } from '@sbf/logger';
import { initModels } from './models/index.js';
import plansRouter         from './routes/plans.js';
import subscriptionsRouter from './routes/subscriptions.js';
import checkoutRouter      from './routes/checkout.js';
import transactionsRouter  from './routes/transactions.js';
import internalRouter      from './routes/internal.js';
import webhooksRouter      from './routes/webhooks.js';

const serviceName = 'payments-service';
const logger      = createLogger(serviceName);
const PORT        = getServicePort('PAYMENTS_SERVICE_PORT', 4019);

const app = express();

// ─── Stripe webhook — must receive raw body ───────────────────────────────────
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));

// ─── Standard middleware ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cookieParser());
app.use(express.json());

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: serviceName });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/payments/plans',         plansRouter);
app.use('/payments/subscription',  subscriptionsRouter);
app.use('/payments/checkout',      checkoutRouter);
app.use('/payments/transactions',  transactionsRouter);
app.use('/internal',               internalRouter);
app.use('/webhooks',               webhooksRouter);

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
  logger.error(`Failed to start: ${err?.message ?? String(err)}`);
  process.exit(1);
});
