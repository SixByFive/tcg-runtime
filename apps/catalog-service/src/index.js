import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { getServicePort } from '@sbf/config';
import { createLogger } from '@sbf/logger';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { initModels } from './models/index.js';
import { seedSetAliases } from './seed/setAliases.js';
import { Scheduler } from './scheduler/index.js';

import setsRouter from './routes/sets.js';
import cardsRouter from './routes/cards.js';
import pricesRouter from './routes/prices.js';
import adminRouter from './routes/admin.js';

const serviceName = 'catalog-service';
const logger = createLogger(serviceName);
const port = getServicePort('CATALOG_SERVICE_PORT', 4012);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || !corsOrigins.length || corsOrigins.includes(origin)) {
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-admin-key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(rateLimit({ windowMs: 60 * 1000, max: 300 }));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: serviceName });
});

app.use('/sets', setsRouter);
app.use('/cards', cardsRouter);
app.use('/prices', pricesRouter);

// Admin UI must be mounted before the admin API router so /admin/ui/* is
// not intercepted by requireAdminKey
app.use('/admin/ui', express.static(path.join(__dirname, 'public')));
app.use('/admin', adminRouter);

async function start() {
  try {
    await initModels();
    logger.info('Models initialised');

    await seedSetAliases(logger);

    await Scheduler.init();
    logger.info('Scheduler initialised');

    app.listen(port, () => {
      logger.info(`Listening on port ${port}`);
    });
  } catch (err) {
    logger.error({ msg: 'startup_failed', error: err?.message || String(err) });
    process.exit(1);
  }
}

start();
