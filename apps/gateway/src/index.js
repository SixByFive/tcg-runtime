import http from 'node:http';
import { getServicePort } from '@sbf/config';
import { createLogger } from '@sbf/logger';
import { checkDatabaseHealth, getDatabaseConfig } from '@sbf/database';

const serviceName = 'gateway';
const logger = createLogger(serviceName);
const port = getServicePort('GATEWAY_PORT', 4010);

/**
 * Basic process health.
 */
function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/health') {
    sendJson(res, 200, {
      status: 'ok',
      service: serviceName,
    });
    return;
  }

  if (req.url === '/health/deps') {
    const db = await checkDatabaseHealth();

    sendJson(res, db.ok ? 200 : 503, {
      status: db.ok ? 'ok' : 'degraded',
      service: serviceName,
      dependencies: {
        database: db,
      },
    });
    return;
  }

  if (req.url === '/debug/db') {
    const dbConfig = getDatabaseConfig();

    sendJson(res, 200, {
      service: serviceName,
      database: {
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        name: dbConfig.name,
      },
    });
    return;
  }

  sendJson(res, 200, {
    message: 'Gateway service is running',
    service: serviceName,
  });
});

server.listen(port, () => {
  logger.info(`Listening on port ${port}`);
});