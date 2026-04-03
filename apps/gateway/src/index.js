import http from 'node:http';
import { getServicePort } from '@sbf/config';
import { createLogger } from '@sbf/logger';

const serviceName = 'gateway';
const logger = createLogger(serviceName);
const port = getServicePort('GATEWAY_PORT', 4000);

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: serviceName }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      message: 'Gateway service is running',
      service: serviceName
    })
  );
});

server.listen(port, () => {
  logger.info(`Listening on port ${port}`);
});