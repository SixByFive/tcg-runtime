import nodemailer from 'nodemailer';
import { createLogger } from '@sbf/logger';
import {
  notificationEmail,
  digestEmail,
  subscriptionActivatedEmail,
  subscriptionPaymentFailedEmail,
  subscriptionEndedEmail,
  walletToppedUpEmail,
} from './email.templates.js';

const logger = createLogger('notifications-service:email');
const FROM = process.env.EMAIL_FROM || 'noreply@sixbyfive.app';

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

async function send(to, subject, html) {
  if (!process.env.SMTP_HOST) {
    logger.info(`[email-dev] To: ${to} | ${subject}`);
    return;
  }
  try {
    await getTransport().sendMail({ from: FROM, to, subject, html });
  } catch (err) {
    logger.error({ msg: 'email_send_failed', to, subject, error: err.message });
  }
}

function buildNotificationHtml(notification) {
  const type = notification.type?.toLowerCase();
  const body = notification.body ?? '';
  const link = notification.linkUrl;

  if (type === 'subscription') {
    const isEnded = /ended|cancelled|cancel/i.test(notification.title);
    if (isEnded) return subscriptionEndedEmail({ planName: extractPlanName(notification.body), linkUrl: link });
    return subscriptionActivatedEmail({ planName: extractPlanName(notification.title), linkUrl: link });
  }
  if (type === 'payment_failure') return subscriptionPaymentFailedEmail({ linkUrl: link });
  if (type === 'payment_success' && /wallet/i.test(body)) {
    const match = body.match(/£([\d.]+)/);
    return walletToppedUpEmail({ amount: match ? match[1] : '0.00', linkUrl: link });
  }
  return notificationEmail(notification);
}

function extractPlanName(str) {
  // Pull plan name from strings like "You're subscribed to Pro!" or "Your Pro subscription..."
  const m = String(str ?? '').match(/subscribed to (.+?)[\s!]|Your (.+?) subscription/i);
  return m?.[1] ?? m?.[2] ?? 'your plan';
}

export async function sendNotificationEmail(notification, userEmail) {
  const html = buildNotificationHtml(notification);
  await send(userEmail, notification.title, html);
}

export async function sendDigestEmail(notifications, userEmail) {
  const html = digestEmail(notifications);
  const count = notifications.length;
  await send(userEmail, `You have ${count} unread notification${count !== 1 ? 's' : ''}`, html);
}
