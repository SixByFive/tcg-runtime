import crypto from 'node:crypto';
import { Op } from 'sequelize';
import { Session } from '../models/index.js';
import { REFRESH_EXPIRY_DAYS } from './token.service.js';

function generateToken() {
  return crypto.randomBytes(40).toString('hex');
}

function expiresAt() {
  return new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

export async function createSession(userId) {
  const token = generateToken();
  await Session.create({ token, userId, expiresAt: expiresAt() });
  return token;
}

export async function validateSession(token) {
  const session = await Session.findOne({
    where: { token, expiresAt: { [Op.gt]: new Date() } },
  });
  return session?.userId ?? null;
}

export async function rotateSession(oldToken, userId) {
  const newToken = generateToken();
  await Session.destroy({ where: { token: oldToken } });
  await Session.create({ token: newToken, userId, expiresAt: expiresAt() });
  return newToken;
}

export async function revokeSession(token) {
  await Session.destroy({ where: { token } });
}

export async function revokeAllSessions(userId) {
  await Session.destroy({ where: { userId } });
}
