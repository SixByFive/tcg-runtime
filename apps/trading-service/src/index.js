import http from 'node:http';
import { getServicePort } from '@sbf/config';
import { createLogger } from '@sbf/logger';

const serviceName = 'trading-service';
const logger = createLogger(serviceName);
const port = getServicePort('TRADING_SERVICE_PORT', 4015);

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: serviceName }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Trading service is running', service: serviceName }));
});

server.listen(port, () => {
  logger.info(`Listening on port ${port}`);
});