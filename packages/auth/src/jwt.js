import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

function secret(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env var: ${name}`);
  return val;
}

export const REFRESH_EXPIRY_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRY_DAYS ?? 30);
export const REFRESH_EXPIRY_SECONDS = REFRESH_EXPIRY_DAYS * 24 * 60 * 60;

export function signAccessToken(payload) {
  return jwt.sign(payload, secret('ACCESS_TOKEN_SECRET'), {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '15m',
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, secret('ACCESS_TOKEN_SECRET'));
}

// Short-lived token issued during login when 2FA is required.
export function signPendingToken(userId) {
  return jwt.sign({ sub: userId, type: '2fa_pending' }, secret('PENDING_TOKEN_SECRET'), {
    expiresIn: process.env.PENDING_TOKEN_EXPIRY || '5m',
  });
}

export function verifyPendingToken(token) {
  const payload = jwt.verify(token, secret('PENDING_TOKEN_SECRET'));
  if (payload.type !== '2fa_pending') throw new Error('Invalid token type');
  return payload;
}

export function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}
