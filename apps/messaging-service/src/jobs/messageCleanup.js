import cron from 'node-cron';
import { Op } from 'sequelize';
import { createLogger } from '@sbf/logger';
import { Message } from '../models/index.js';

const logger = createLogger('messaging-service:message-cleanup');

export function startMessageCleanup() {
  // Run hourly at :10
  cron.schedule('10 * * * *', async () => {
    try {
      const now         = new Date();
      const twentyEightDaysAgo = new Date(now - 28 * 24 * 60 * 60 * 1000);

      const deleted = await Message.destroy({
        where: {
          [Op.or]: [
            { expiresAt: { [Op.lt]: now } },
            { createdAt: { [Op.lt]: twentyEightDaysAgo } },
          ],
        },
      });

      logger.info({ msg: 'message_cleanup_done', deleted });
    } catch (err) {
      logger.error({ msg: 'message_cleanup_failed', error: err.message });
    }
  }, { timezone: process.env.CRON_TZ || 'UTC' });

  logger.info('Message cleanup job scheduled (hourly)');
}
