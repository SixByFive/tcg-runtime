import nodemailer from 'nodemailer';
import { createLogger } from '@sbf/logger';

const logger = createLogger('auth-service:email');
const FROM = process.env.EMAIL_FROM || 'noreply@sixbyfive.app';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

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
    logger.error('Failed to send email', { to, subject, error: err.message });
  }
}

export async function sendVerificationEmail(user, token) {
  const url = `${APP_URL}/verify-email?token=${token}`;
  await send(
    user.email,
    'Verify your SixByFive email',
    `<p>Hi ${user.username},</p>
     <p>Verify your email address by clicking the link below. It expires in 24 hours.</p>
     <p><a href="${url}">${url}</a></p>`,
  );
}

export async function sendWelcomeEmail(user) {
  await send(
    user.email,
    'Welcome to SixByFive!',
    `<p>Hi ${user.username},</p>
     <p>Welcome to SixByFive — your trading card game marketplace.</p>
     <p>Start exploring cards, building your collection, and trading with others.</p>`,
  );
}

export async function sendPasswordResetEmail(user, token) {
  const url = `${APP_URL}/reset-password?token=${token}`;
  await send(
    user.email,
    'Reset your SixByFive password',
    `<p>Hi ${user.username},</p>
     <p>You requested a password reset. Click the link below — it expires in 1 hour.</p>
     <p><a href="${url}">${url}</a></p>
     <p>If you didn't request this, you can safely ignore this email.</p>`,
  );
}

export async function sendEmailChangeEmail(user, token, newEmail) {
  const url = `${APP_URL}/verify-email?token=${token}`;
  await send(
    newEmail,
    'Verify your new SixByFive email',
    `<p>Hi ${user.username},</p>
     <p>Verify your new email address by clicking the link below. It expires in 24 hours.</p>
     <p><a href="${url}">${url}</a></p>`,
  );
}
