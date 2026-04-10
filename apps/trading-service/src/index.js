import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { getServicePort } from '@sbf/config';
import { createLogger } from '@sbf/logger';
import { initModels } from './models/index.js';
import tradesRouter from './routes/trades.js';
import adminRouter  from './routes/admin.js';

const serviceName = 'trading-service';
const logger = createLogger(serviceName);
const port = getServicePort('TRADING_SERVICE_PORT', 4015);

const app = express();

app.use(helmet());
app.use(express.json({ limit: '10mb' })); // proof images are base64
app.use(cookieParser());
app.use(rateLimit({ windowMs: 60_000, max: 200 }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: serviceName });
});

app.use('/trades/admin', adminRouter);
app.use('/trades', tradesRouter);

app.use((err, _req, res, _next) => {
  logger.error(err.message);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    await initModels();
    logger.info('Models initialised');
    app.listen(port, () => logger.info(`Listening on port ${port}`));
  } catch (err) {
    logger.error({ msg: 'startup_failed', error: err?.message });
    process.exit(1);
  }
}

start();