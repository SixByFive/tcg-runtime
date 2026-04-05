import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET;
const PENDING_SECRET = process.env.PENDING_TOKEN_SECRET;

export const REFRESH_EXPIRY_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRY_DAYS ?? 14);
export const REFRESH_EXPIRY_SECONDS = REFRESH_EXPIRY_DAYS * 24 * 60 * 60;

const isProd = process.env.NODE_ENV === 'production';

const COOKIE_BASE = {
  httpOnly: true,
  sameSite: 'strict',
  secure: isProd,
  path: '/',
};

export function signAccessToken(payload) {
  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '15m',
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

// Short-lived token issued during login when 2FA is required.
// Carries the userId until the TOTP challenge is passed.
export function signPendingToken(userId) {
  return jwt.sign({ sub: userId, type: '2fa_pending' }, PENDING_SECRET, {
    expiresIn: process.env.PENDING_TOKEN_EXPIRY || '5m',
  });
}

export function verifyPendingToken(token) {
  const payload = jwt.verify(token, PENDING_SECRET);
  if (payload.type !== '2fa_pending') throw new Error('Invalid token type');
  return payload;
}

export function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

export function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie('sbf_access', accessToken, {
    ...COOKIE_BASE,
    maxAge: 15 * 60 * 1000,
  });
  res.cookie('sbf_refresh', refreshToken, {
    ...COOKIE_BASE,
    maxAge: REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function setPendingCookie(res, token) {
  res.cookie('sbf_pending', token, {
    ...COOKIE_BASE,
    maxAge: 5 * 60 * 1000,
  });
}

export function clearAuthCookies(res) {
  const opts = { path: '/' };
  res.clearCookie('sbf_access', opts);
  res.clearCookie('sbf_refresh', opts);
  res.clearCookie('sbf_pending', opts);
}
