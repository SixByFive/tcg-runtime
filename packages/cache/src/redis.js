import Redis from 'ioredis';
import { getSharedConfig } from '@sbf/config';
import { createLogger } from '@sbf/logger';

const logger = createLogger('cache:redis');

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
    client.on('connect', () => logger.info('Redis connected'));
  }
  return client;
}

export async function checkRedisHealth() {
  try {
    const redis = getRedis();
    await redis.ping();
    return { ok: true, status: 'ok' };
  } catch (err) {
    return { ok: false, status: 'error', error: err.message };
  }
}
