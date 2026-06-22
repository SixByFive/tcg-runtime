import cron from 'node-cron';
import { Op } from 'sequelize';
import { createLogger } from '@sbf/logger';
import { Notification, UserNotificationPref } from '../models/index.js';
import { sendNotificationEmail, sendDigestEmail } from '../services/email.service.js';

const logger = createLogger('notifications-service:delivery');

// Users table is in the auth-service DB (same DB in this deployment).
// We look up email via a raw query since we don't own the users table.
import { getSequelize } from '@sbf/database';

async function getUserEmail(userId) {
  try {
    const [rows] = await getSequelize().query(
      'SELECT email FROM users WHERE id = ? LIMIT 1',
      { replacements: [userId] },
    );
    return rows[0]?.email ?? null;
  } catch {
    return null;
  }
}

// ─── Instant email delivery (runs hourly) ────────────────────────────────────
// Sends emails for notifications that haven't been emailed yet, where the user
// has instant digest enabled.

async function sendPendingInstantEmails() {
  const pending = await Notification.findAll({
    where: {
      emailSentAt: null,
      isSilent: false,
      userId: { [Op.ne]: null },
    },
    limit: 500,
    order: [['createdAt', 'ASC']],
  });

  if (pending.length === 0) return 0;

  // Group by userId to load prefs once per user
  const byUser = {};
  for (const n of pending) {
    (byUser[n.userId] ??= []).push(n);
  }

  let sent = 0;

  for (const [userId, notifications] of Object.entries(byUser)) {
    const prefs = await UserNotificationPref.findOne({ where: { userId } });
    // Quiet-hours check
    if (prefs && prefs.quietStart && prefs.quietEnd) {
      const now = new Date();
      const hh  = now.getUTCHours() * 60 + now.getUTCMinutes();
      const [qs_h, qs_m] = prefs.quietStart.split(':').map(Number);
      const [qe_h, qe_m] = prefs.quietEnd.split(':').map(Number);
      const qs = qs_h * 60 + qs_m;
      const qe = qe_h * 60 + qe_m;
      const inQuiet = qs <= qe ? (hh >= qs && hh < qe) : (hh >= qs || hh < qe);
      if (inQuiet) continue; // skip — user is in quiet hours, delivery job will retry next run
    }
    if (prefs && prefs.emailEnabled === false) continue;
    if (prefs && prefs.digest !== 'instant') continue;

    const email = await getUserEmail(userId);
    if (!email) continue;

    for (const notification of notifications) {
      try {
        await sendNotificationEmail(notification, email);
        await notification.update({ emailSentAt: new Date() });
        sent++;
      } catch (err) {
        logger.error({ msg: 'delivery_email_failed', userId, notificationId: notification.id, error: err.message });
      }
    }
  }

  return sent;
}

// ─── Daily digest (runs at 08:00) ─────────────────────────────────────────────

async function sendDailyDigests() {
  // Find users with daily digest and pending unread notifications
  const prefs = await UserNotificationPref.findAll({
    where: { digest: 'daily', emailEnabled: true },
  });

  let sent = 0;

  for (const pref of prefs) {
    const notifications = await Notification.findAll({
      where: { userId: pref.userId, emailSentAt: null, isSilent: false },
      order: [['createdAt', 'DESC']],
      limit: 200,
    });

    if (notifications.length === 0) continue;

    const email = await getUserEmail(pref.userId);
    if (!email) continue;

    try {
      await sendDigestEmail(notifications, email);
      const now = new Date();
      await Notification.update(
        { emailSentAt: now },
        { where: { id: notifications.map(n => n.id) } },
      );
      sent += notifications.length;
    } catch (err) {
      logger.error({ msg: 'digest_failed', userId: pref.userId, error: err.message });
    }
  }

  return sent;
}

// ─── Schedule ────────────────────────────────────────────────────────────────

export function startDeliveryJobs() {
  const tz = process.env.CRON_TZ || 'UTC';

  // Instant email: every hour at :10
  cron.schedule('10 * * * *', async () => {
    try {
      const sent = await sendPendingInstantEmails();
      if (sent > 0) logger.info({ msg: 'instant_emails_sent', count: sent });
    } catch (err) {
      logger.error({ msg: 'instant_delivery_failed', error: err.message });
    }
  }, { timezone: tz });

  // Daily digest: every day at 08:00
  cron.schedule('0 8 * * *', async () => {
    try {
      const sent = await sendDailyDigests();
      if (sent > 0) logger.info({ msg: 'daily_digest_sent', count: sent });
    } catch (err) {
      logger.error({ msg: 'daily_digest_failed', error: err.message });
    }
  }, { timezone: tz });

  logger.info('Notification delivery jobs scheduled');
}
