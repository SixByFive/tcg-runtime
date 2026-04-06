import express from 'express';
import http from 'node:http';
import { getServicePort } from '@sbf/config';
import { createLogger } from '@sbf/logger';

const serviceName = 'catalog-service';
const logger = createLogger(serviceName);
const port = getServicePort('CATALOG_SERVICE_PORT', 4012);

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: serviceName });
});

const server = http.createServer(app);

server.listen(port, () => {
  logger.info(`Listening on port ${port}`);
});