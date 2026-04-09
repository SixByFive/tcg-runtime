import { REFRESH_EXPIRY_DAYS } from './jwt.js';

const isProd = process.env.NODE_ENV === 'production';

const COOKIE_BASE = {
  httpOnly: true,
  sameSite: 'strict',
  secure: isProd,
  path: '/',
};

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
