import nodemailer from 'nodemailer';
import { createLogger } from '@sbf/logger';

const logger = createLogger('notifications-service:email');
const FROM = process.env.EMAIL_FROM || 'noreply@sixbyfive.app';
const APP_URL = process.env.APP_URL || 'https://tcg.sixbyfive.com';

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

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function baseTemplate(title, bodyHtml) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:16px">
    <h2 style="color:#1a1a2e">${esc(title)}</h2>
    ${bodyHtml}
    <hr style="margin-top:32px"/>
    <p style="font-size:12px;color:#888">
      <a href="${APP_URL}/notifications">Manage notification preferences</a>
    </p>
  </body></html>`;
}

function buildHtml(notification) {
  const { type, title, body, linkUrl } = notification;
  let cta = '';
  if (linkUrl) {
    cta = `<p><a href="${APP_URL}${esc(linkUrl)}" style="background:#4f46e5;color:#fff;padding:8px 16px;border-radius:4px;text-decoration:none">View</a></p>`;
  }

  switch (type) {
    case 'price_alert':
      return baseTemplate(title, `<p>${esc(body)}</p>${cta}`);
    case 'trade_offer':
      return baseTemplate(title, `<p>${esc(body)}</p>${cta}`);
    case 'trade_complete':
      return baseTemplate(title, `<p>${esc(body)}</p>${cta}`);
    case 'achievement_unlocked':
      return baseTemplate(title, `<p>🏆 ${esc(body)}</p>${cta}`);
    case 'listing_sold':
      return baseTemplate(title, `<p>${esc(body)}</p>${cta}`);
    case 'ORDER_PLACED_BUYER':
    case 'ORDER_PLACED_SELLER':
    case 'ORDER_FULFILMENT_IN_PRINTING':
    case 'ORDER_FULFILMENT_SHIPPED':
      return baseTemplate(title, `<p>${esc(body)}</p>${cta}`);
    default:
      return baseTemplate(title, `<p>${esc(body)}</p>${cta}`);
  }
}

export async function sendNotificationEmail(notification, userEmail) {
  const html = buildHtml(notification);
  await send(userEmail, notification.title, html);
}
