import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { getServicePort } from '@sbf/config';
import { createLogger } from '@sbf/logger';
import { initModels } from './models/index.js';
import { startMessageCleanup } from './jobs/messageCleanup.js';
import messagesRouter from './routes/messages.js';

const serviceName = 'messaging-service';
const logger      = createLogger(serviceName);
const port        = getServicePort('MESSAGING_SERVICE_PORT', 4022);

const app = express();

app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(rateLimit({ windowMs: 60_000, max: 300 }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: serviceName });
});

app.use('/messages', messagesRouter);

app.use((err, _req, res, _next) => {
  logger.error(err.message);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    await initModels();
    logger.info('Models initialised');

    startMessageCleanup();

    app.listen(port, () => logger.info(`Listening on port ${port}`));
  } catch (err) {
    logger.error({ msg: 'startup_failed', error: err?.message });
    process.exit(1);
  }
}

start();
