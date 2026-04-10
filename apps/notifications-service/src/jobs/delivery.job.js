import cron from 'node-cron';
import { Op } from 'sequelize';
import { createLogger } from '@sbf/logger';
import { Notification, UserNotificationPref } from '../models/index.js';
import { sendNotificationEmail } from '../services/email.service.js';

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

    // Build a summary digest email
    const lines = notifications
      .map(n => `<li><strong>${n.title}</strong> — ${n.body}</li>`)
      .join('');

    const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:16px">
      <h2>Your SixByFive notifications (${notifications.length})</h2>
      <ul>${lines}</ul>
      <p><a href="${process.env.APP_URL || 'https://tcg.sixbyfive.com'}/notifications">View all</a></p>
    </body></html>`;

    try {
      const nodemailer = (await import('nodemailer')).default;
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });

      if (process.env.SMTP_HOST) {
        await transport.sendMail({
          from: process.env.EMAIL_FROM || 'noreply@sixbyfive.app',
          to: email,
          subject: `Your SixByFive digest (${notifications.length} notification${notifications.length === 1 ? '' : 's'})`,
          html,
        });
      }

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
