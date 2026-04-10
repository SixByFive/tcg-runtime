import Redis from 'ioredis';
import { createLogger } from '@sbf/logger';

const logger = createLogger('realtime-service:redis');

/**
 * Start a Redis pattern subscriber that fans out messages to live connections.
 *
 * Channels:
 *   realtime:user:{userId}  →  push(userId, event, data)
 *   realtime:broadcast      →  broadcast(event, data)
 *
 * Message format (JSON): { event: string, data?: any }
 */
export function startRedisSubscriber({ push, broadcast }) {
  const sub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    lazyConnect: false,
    maxRetriesPerRequest: null,
  });

  sub.on('error', (err) => logger.error(`Redis error: ${err.message}`));

  sub.psubscribe('realtime:*', (err, count) => {
    if (err) {
      logger.error(`psubscribe failed: ${err.message}`);
    } else {
      logger.info(`Redis subscriber ready (${count} pattern)`);
    }
  });

  sub.on('pmessage', (_pattern, channel, message) => {
    try {
      const { event, data } = JSON.parse(message);
      if (!event) return;

      if (channel === 'realtime:broadcast') {
        broadcast(event, data);
      } else if (channel.startsWith('realtime:user:')) {
        const userId = channel.slice('realtime:user:'.length);
        push(userId, event, data);
      }
    } catch (err) {
      logger.error(`Redis pmessage parse error: ${err.message}`);
    }
  });

  return sub;
}
