import Redis from 'ioredis';
import { getSharedConfig } from '@sbf/config';
import { createLogger } from '@sbf/logger';

const logger = createLogger('auth-service:redis');

let client;

export function getRedis() {
  if (!client) {
    const { redisUrl } = getSharedConfig();
    client = new Redis(redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3,
    });
    client.on('error', (err) => logger.error('Redis error', { error: err.message }));
  }
  return client;
}
