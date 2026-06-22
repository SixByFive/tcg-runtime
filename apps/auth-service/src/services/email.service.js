import nodemailer from 'nodemailer';
import { createLogger } from '@sbf/logger';
import {
  verificationEmail,
  welcomeEmail,
  passwordResetEmail,
  emailChangeEmail,
} from './email.templates.js';

const logger = createLogger('auth-service:email');
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
    logger.error('Failed to send email', { to, subject, error: err.message });
  }
}

export async function sendVerificationEmail(user, token) {
  const { subject, html } = verificationEmail(user, token);
  await send(user.email, subject, html);
}

export async function sendWelcomeEmail(user) {
  const { subject, html } = welcomeEmail(user);
  await send(user.email, subject, html);
}

export async function sendPasswordResetEmail(user, token) {
  const { subject, html } = passwordResetEmail(user, token);
  await send(user.email, subject, html);
}

export async function sendEmailChangeEmail(user, token, newEmail) {
  const { subject, html } = emailChangeEmail(user, token, newEmail);
  await send(newEmail, subject, html);
}
