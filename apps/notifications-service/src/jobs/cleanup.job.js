import cron from 'node-cron';
import { Op } from 'sequelize';
import { createLogger } from '@sbf/logger';
import { Notification } from '../models/index.js';

const logger = createLogger('notifications-service:cleanup');

export function startCleanupJob() {
  // Run hourly at :05
  cron.schedule('5 * * * *', async () => {
    try {
      const now = new Date();
      const sevenDaysAgo  = new Date(now - 7  * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

      // 1. Expired notifications
      const expired = await Notification.destroy({
        where: { expiresAt: { [Op.lt]: now } },
      });

      // 2. Dismissed > 7 days old
      const dismissed = await Notification.destroy({
        where: { isDismissed: true, updatedAt: { [Op.lt]: sevenDaysAgo } },
      });

      // 3. Read (but not dismissed) > 30 days old
      const stale = await Notification.destroy({
        where: {
          isRead: true,
          isDismissed: false,
          updatedAt: { [Op.lt]: thirtyDaysAgo },
        },
      });

      logger.info({ msg: 'cleanup_done', expired, dismissed, stale });
    } catch (err) {
      logger.error({ msg: 'cleanup_failed', error: err.message });
    }
  }, { timezone: process.env.CRON_TZ || 'UTC' });

  logger.info('Notification cleanup job scheduled (hourly)');
}
