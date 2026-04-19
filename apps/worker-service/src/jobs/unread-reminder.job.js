import { getSequelize } from '@sbf/database';
import { notifyUser, NotificationType } from '@sbf/contracts';
import { createLogger } from '@sbf/logger';

const logger = createLogger('worker:unread-reminder');

export async function runUnreadReminderJob() {
  logger.info('Running unread message reminder job…');
  const sequelize = getSequelize();

  // Raw query — the messages table is owned by messaging-service
  const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const [messages] = await sequelize.query(
    `SELECT id, senderId, receiverId, content, createdAt
     FROM messages
     WHERE isRead = 0
       AND reminderSentAt IS NULL
       AND isSystemMessage = 0
       AND createdAt < :cutoff
     LIMIT 500`,
    { replacements: { cutoff } },
  );

  if (!messages.length) {
    logger.info('Unread reminder: nothing to send');
    return;
  }

  // Group by receiverId — one notification per user even if multiple messages
  const byReceiver = {};
  for (const msg of messages) {
    (byReceiver[msg.receiverId] ??= []).push(msg);
  }

  let sent = 0;
  for (const [receiverId, msgs] of Object.entries(byReceiver)) {
    try {
      await notifyUser({
        userId:  receiverId,
        type:    NotificationType.MESSAGE,
        title:   `You have ${msgs.length} unread message${msgs.length > 1 ? 's' : ''}`,
        body:    'You have unread messages waiting for you.',
        linkUrl: '/messages',
        isSilent: false,
      });

      // Mark all as reminder sent
      const ids = msgs.map(m => m.id);
      await sequelize.query(
        `UPDATE messages SET reminderSentAt = NOW() WHERE id IN (:ids)`,
        { replacements: { ids } },
      );
      sent++;
    } catch (err) {
      logger.warn(`Unread reminder failed for user ${receiverId}: ${err.message}`);
    }
  }

  logger.info(`Unread reminder: sent ${sent} notifications`);
}
