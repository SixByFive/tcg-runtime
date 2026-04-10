import express from 'express';
import helmet from 'helmet';
import cron from 'node-cron';
import { getServicePort } from '@sbf/config';
import { createLogger } from '@sbf/logger';
import { initModels } from './models/index.js';
import internalRouter from './routes/internal.js';
import { runEscrowExpiryJob }    from './jobs/escrow-expiry.job.js';
import { runOfferExpiryJob }     from './jobs/offer-expiry.job.js';
import { runPriceAlertsJob }     from './jobs/price-alerts.job.js';
import { runTradeTopUpExpiryJob } from './jobs/trade-topup-expiry.job.js';

const serviceName = 'worker-service';
const logger      = createLogger(serviceName);
const PORT        = getServicePort('WORKER_SERVICE_PORT', 4020);

const app = express();
app.use(helmet());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: serviceName });
});

app.use('/internal', internalRouter);

// ─── Cron schedule ────────────────────────────────────────────────────────────

function schedule(name, expression, fn) {
  if (!cron.validate(expression)) {
    logger.error(`Invalid cron expression for ${name}: ${expression}`);
    return;
  }
  cron.schedule(expression, async () => {
    logger.info(`[cron] Starting: ${name}`);
    try {
      await fn();
      logger.info(`[cron] Finished: ${name}`);
    } catch (err) {
      logger.error(`[cron] ${name} threw: ${err.message}`);
    }
  });
  logger.info(`[cron] Registered: ${name} (${expression})`);
}

function startJobs() {
  // Price alerts — every 15 minutes
  schedule('price-alerts', '*/15 * * * *', runPriceAlertsJob);

  // Offer expiry sweep — hourly at :30
  schedule('offer-expiry', '30 * * * *', runOfferExpiryJob);

  // Escrow expiry warning — daily at 09:00
  schedule('escrow-expiry', '0 9 * * *', runEscrowExpiryJob);

  // Trade top-up expiry warning — daily at 09:05
  schedule('trade-topup-expiry', '5 9 * * *', runTradeTopUpExpiryJob);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function start() {
  await initModels();
  startJobs();
  app.listen(PORT, () => logger.info(`${serviceName} listening on port ${PORT}`));
}

start().catch((err) => {
  logger.error(`Failed to start: ${err.message}`);
  process.exit(1);
});
