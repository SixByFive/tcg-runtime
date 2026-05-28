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
    // In dev, back off quickly rather than hammering every 100ms
    retryStrategy: (times) => Math.min(times * 500, 10_000),
  });

  // Log only the first connection failure — subsequent retries are silent
  let errLogged = false;
  sub.on('error', (err) => {
    if (!errLogged) {
      logger.warn(`Redis unavailable (${err.message}) — real-time push disabled until Redis is running`);
      errLogged = true;
    }
  });
  // Reset the flag when connection recovers so any future outage is logged once
  sub.on('connect', () => { errLogged = false; });

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
