import http from 'node:http';
import { getServicePort } from '@sbf/config';
import { createLogger } from '@sbf/logger';
import { checkDatabaseHealth } from '@sbf/database';
import { createApp } from './app.js';

const serviceName = 'gateway';
const logger = createLogger(serviceName);
const port = getServicePort('GATEWAY_PORT', 4010);

async function bootstrap() {
  const db = await checkDatabaseHealth();

  if (!db.ok) {
    logger.error('Database connection failed during gateway boot', db);
    process.exit(1);
  }

  const { app } = await createApp({ logger });
  const server = http.createServer(app);

  server.listen(port, () => {
    logger.info(`Gateway listening on port ${port}`);
  });
}

bootstrap().catch((error) => {
  logger.error('Gateway bootstrap failed', {
    error: error?.stack || error?.message || String(error),
  });
  process.exit(1);
});