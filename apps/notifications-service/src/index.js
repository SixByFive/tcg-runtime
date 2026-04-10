import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { getServicePort } from '@sbf/config';
import { createLogger } from '@sbf/logger';
import { initModels } from './models/index.js';
import { startCleanupJob } from './jobs/cleanup.job.js';
import { startDeliveryJobs } from './jobs/delivery.job.js';
import notificationsRouter from './routes/notifications.js';
import internalRouter from './routes/internal.js';
import adminRouter from './routes/admin.js';

const serviceName = 'notifications-service';
const logger = createLogger(serviceName);
const port = getServicePort('NOTIFICATIONS_SERVICE_PORT', 4016);

const app = express();

app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(rateLimit({ windowMs: 60_000, max: 300 }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: serviceName });
});

app.use('/notifications/admin', adminRouter);
app.use('/notifications', notificationsRouter);
app.use('/internal', internalRouter);

app.use((err, _req, res, _next) => {
  logger.error(err.message);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    await initModels();
    logger.info('Models initialised');

    startCleanupJob();
    startDeliveryJobs();

    app.listen(port, () => logger.info(`Listening on port ${port}`));
  } catch (err) {
    logger.error({ msg: 'startup_failed', error: err?.message });
    process.exit(1);
  }
}

start();