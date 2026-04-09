import '@sbf/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { getServicePort } from '@sbf/config';
import { createLogger } from '@sbf/logger';
import { initModels } from './models/index.js';
import collectionRoutes from './routes/collection.js';
import wishlistRoutes from './routes/wishlist.js';
import binderRoutes from './routes/binder.js';

const logger = createLogger('collections-service');
const port = getServicePort('COLLECTIONS_SERVICE_PORT', 4013);

const app = express();

app.use(helmet());
app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'collections-service' });
});

app.use('/collection', collectionRoutes);
app.use('/wishlist', wishlistRoutes);
app.use('/binder', binderRoutes);

app.use((err, _req, res, _next) => {
  logger.error(err.message);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await initModels();
  app.listen(port, () => {
    logger.info(`Listening on port ${port}`);
  });
}

start().catch((err) => {
  logger.error(`Failed to start: ${err.message}`);
  process.exit(1);
});
