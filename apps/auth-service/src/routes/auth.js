import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { Op } from 'sequelize';
import { OAuth2Client } from 'google-auth-library';
import rateLimit from 'express-rate-limit';
import { createLogger } from '@sbf/logger';

import { User } from '../models/index.js';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  signAccessToken,
  signPendingToken,
  verifyPendingToken,
  setAuthCookies,
  setPendingCookie,
  clearAuthCookies,
} from '../services/token.service.js';
import {
  createSession,
  validateSession,
  rotateSession,
  revokeSession,
  revokeAllSessions,
} from '../services/session.service.js';
import {
  checkLoginBrute,
  recordLoginFailure,
  clearLoginBrute,
  checkTotpBrute,
  recordTotpFailure,
  clearTotpBrute,
  checkResetBrute,
  recordResetRequest,
} from '../services/brute.service.js';
import {
  generateTotpSecret,
  generateQrCode,
  verifyTotp,
} from '../services/totp.service.js';
import {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendEmailChangeEmail,
} from '../services/email.service.js';

const logger = createLogger('auth-service:routes');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const router = Router();

const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
const resetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });

// Mobile clients send X-Client-Type: mobile and receive tokens in the response body.
// Web clients get HttpOnly cookies and no tokens in the body.
function isMobile(req) {
  return req.headers['x-client-type'] === 'mobile';
}

function safeUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    isAdmin: user.isAdmin,
    emailVerified: user.emailVerified,
    twoFactorEnabled: user.twoFactorEnabled,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
  };
}

// Issues tokens. For mobile: returns { accessToken, refreshToken } to merge into response body.
// For web: sets HttpOnly cookies and returns {}.
async function issueAuth(req, res, user) {
  const payload = { sub: user.id, username: user.username, email: user.email, isAdmin: user.isAdmin };
  const accessToken = signAccessToken(payload);
  const refreshToken = await createSession(user.id);
  await user.update({ lastLogin: new Date() });

  if (isMobile(req)) {
    return { accessToken, refreshToken };
  }

  setAuthCookies(res, { accessToken, refreshToken });
  return {};
}

// ─── Register ────────────────────────────────────────────────────────────────

router.post('/register', registerLimiter, async (req, res) => {
  const { username, email, password } = req.body ?? {};

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email and password are required' });
  }
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    return res.status(400).json({ error: 'Username must be 3–30 characters (letters, numbers, underscore)' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const existing = await User.findOne({
    where: { [Op.or]: [{ email: email.toLowerCase() }, { username }] },
  });
  if (existing) {
    const field = existing.email === email.toLowerCase() ? 'email' : 'username';
    return res.status(409).json({ error: `That ${field} is already taken` });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const verifyToken = crypto.randomBytes(32).toString('hex');

  const user = await User.create({
    username,
    email: email.toLowerCase(),
    password: hashedPassword,
    verifyToken,
    verifyTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  sendVerificationEmail(user, verifyToken).catch(() => {});
  sendWelcomeEmail(user).catch(() => {});

  const tokens = await issueAuth(req, res, user);
  return res.status(201).json({ ...tokens, user: safeUser(user) });
});

// ─── Login ───────────────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const normalizedEmail = email.toLowerCase();

  try {
    await checkLoginBrute(normalizedEmail);
  } catch (err) {
    return res.status(err.status ?? 429).json({ error: err.message });
  }

  const user = await User.findOne({ where: { email: normalizedEmail } });

  // Constant-time failure path — always hash even if user not found
  const passwordMatch = user?.password
    ? await bcrypt.compare(password, user.password)
    : await bcrypt.hash(password, 12).then(() => false);

  if (!user || !passwordMatch) {
    await recordLoginFailure(normalizedEmail);
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (user.isBanned) {
    return res.status(403).json({ error: 'Your account has been suspended' });
  }

  await clearLoginBrute(normalizedEmail);

  if (user.twoFactorEnabled) {
    const pendingToken = signPendingToken(user.id);
    if (isMobile(req)) {
      // Mobile holds the pending token itself and sends it back in the challenge body
      return res.json({ requiresTwoFactor: true, pendingToken });
    }
    setPendingCookie(res, pendingToken);
    return res.json({ requiresTwoFactor: true });
  }

  const tokens = await issueAuth(req, res, user);
  return res.json({ ...tokens, user: safeUser(user) });
});

// ─── Logout ──────────────────────────────────────────────────────────────────

router.post('/logout', async (req, res) => {
  // Mobile sends refreshToken in body; web sends it via cookie
  const refreshToken = req.body?.refreshToken ?? req.cookies?.sbf_refresh;
  if (refreshToken) {
    const userId = await validateSession(refreshToken);
    await revokeSession(refreshToken, userId);
  }
  if (!isMobile(req)) clearAuthCookies(res);
  return res.status(204).send();
});

// ─── Refresh ─────────────────────────────────────────────────────────────────

router.post('/refresh', async (req, res) => {
  // Mobile sends refreshToken in body; web sends it via cookie
  const oldToken = req.body?.refreshToken ?? req.cookies?.sbf_refresh;
  if (!oldToken) return res.status(401).json({ error: 'No refresh token' });

  const userId = await validateSession(oldToken);
  if (!userId) return res.status(401).json({ error: 'Invalid or expired session' });

  const user = await User.findByPk(userId);
  if (!user || user.isBanned) {
    await revokeSession(oldToken, userId);
    if (!isMobile(req)) clearAuthCookies(res);
    return res.status(401).json({ error: 'Session invalid' });
  }

  const newRefreshToken = await rotateSession(oldToken, userId);
  const accessToken = signAccessToken({
    sub: user.id, username: user.username, email: user.email, isAdmin: user.isAdmin,
  });

  if (isMobile(req)) {
    return res.json({ accessToken, refreshToken: newRefreshToken, user: safeUser(user) });
  }

  setAuthCookies(res, { accessToken, refreshToken: newRefreshToken });
  return res.json({ user: safeUser(user) });
});

// ─── Me ──────────────────────────────────────────────────────────────────────

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findByPk(req.user.sub);
  if (!user) return res.status(401).json({ error: 'User not found' });
  return res.json({ user: safeUser(user) });
});

// ─── Google Sign-In ───────────────────────────────────────────────────────────

router.post('/google', async (req, res) => {
  const { idToken } = req.body ?? {};
  if (!idToken) return res.status(400).json({ error: 'idToken is required' });

  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
  } catch {
    return res.status(401).json({ error: 'Invalid Google token' });
  }

  const { sub: googleId, email, name } = ticket.getPayload();

  let user = await User.findOne({
    where: { [Op.or]: [{ googleId }, { email: email.toLowerCase() }] },
  });

  if (!user) {
    const base = (name ?? 'user').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 24) || 'user';
    let username = base;
    let suffix = 1;
    while (await User.findOne({ where: { username } })) {
      username = `${base}${suffix++}`;
    }
    user = await User.create({ username, email: email.toLowerCase(), googleId, emailVerified: true });
    sendWelcomeEmail(user).catch(() => {});
  } else if (!user.googleId) {
    await user.update({ googleId });
  }

  if (user.isBanned) return res.status(403).json({ error: 'Your account has been suspended' });

  const tokens = await issueAuth(req, res, user);
  return res.json({ ...tokens, user: safeUser(user) });
});

// ─── 2FA Setup ───────────────────────────────────────────────────────────────

router.post('/2fa/setup', requireAuth, async (req, res) => {
  const user = await User.findByPk(req.user.sub);
  if (!user) return res.status(401).json({ error: 'User not found' });
  if (user.twoFactorEnabled) return res.status(400).json({ error: '2FA is already enabled' });

  const { base32, otpauthUrl } = generateTotpSecret(user.username);
  const qrCodeDataURL = await generateQrCode(otpauthUrl);

  await user.update({ twoFactorPending: base32 });
  return res.json({ otpauthUrl, qrCodeDataURL });
});

// ─── 2FA Verify (confirms setup and enables 2FA) ─────────────────────────────

router.post('/2fa/verify', requireAuth, async (req, res) => {
  const { token } = req.body ?? {};
  if (!token) return res.status(400).json({ error: 'token is required' });

  const user = await User.findByPk(req.user.sub);
  if (!user) return res.status(401).json({ error: 'User not found' });
  if (!user.twoFactorPending) return res.status(400).json({ error: 'No 2FA setup in progress' });

  try {
    await checkTotpBrute(user.id);
  } catch (err) {
    return res.status(err.status ?? 429).json({ error: err.message });
  }

  if (!verifyTotp(user.twoFactorPending, token)) {
    await recordTotpFailure(user.id);
    return res.status(401).json({ error: 'Invalid 2FA code' });
  }

  await clearTotpBrute(user.id);
  await user.update({ twoFactorSecret: user.twoFactorPending, twoFactorPending: null, twoFactorEnabled: true });
  return res.json({ success: true });
});

// ─── 2FA Challenge (completes login when 2FA is required) ────────────────────

router.post('/2fa/challenge', async (req, res) => {
  const { token, pendingToken: bodyPendingToken } = req.body ?? {};
  // Mobile sends pendingToken in body; web sends it via cookie
  const rawPending = bodyPendingToken ?? req.cookies?.sbf_pending;

  if (!rawPending) return res.status(401).json({ error: 'No pending 2FA session' });
  if (!token) return res.status(400).json({ error: 'token is required' });

  let payload;
  try {
    payload = verifyPendingToken(rawPending);
  } catch {
    return res.status(401).json({ error: 'Pending session expired, please log in again' });
  }

  const user = await User.findByPk(payload.sub);
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    return res.status(401).json({ error: 'Invalid 2FA session' });
  }

  try {
    await checkTotpBrute(user.id);
  } catch (err) {
    return res.status(err.status ?? 429).json({ error: err.message });
  }

  if (!verifyTotp(user.twoFactorSecret, token)) {
    await recordTotpFailure(user.id);
    return res.status(401).json({ error: 'Invalid 2FA code' });
  }

  await clearTotpBrute(user.id);
  if (!isMobile(req)) res.clearCookie('sbf_pending', { path: '/' });

  const tokens = await issueAuth(req, res, user);
  return res.json({ ...tokens, user: safeUser(user) });
});

// ─── Disable 2FA ─────────────────────────────────────────────────────────────

router.delete('/2fa', requireAuth, async (req, res) => {
  const { token } = req.body ?? {};
  if (!token) return res.status(400).json({ error: 'Current 2FA code is required to disable it' });

  const user = await User.findByPk(req.user.sub);
  if (!user) return res.status(401).json({ error: 'User not found' });
  if (!user.twoFactorEnabled) return res.status(400).json({ error: '2FA is not enabled' });

  if (!verifyTotp(user.twoFactorSecret, token)) {
    return res.status(401).json({ error: 'Invalid 2FA code' });
  }

  await user.update({ twoFactorSecret: null, twoFactorEnabled: false });
  return res.json({ success: true });
});

// ─── Forgot Password ──────────────────────────────────────────────────────────

router.post('/password/forgot', resetLimiter, async (req, res) => {
  const { email } = req.body ?? {};
  if (!email) return res.status(400).json({ error: 'email is required' });

  const normalizedEmail = email.toLowerCase();

  try {
    await checkResetBrute(normalizedEmail);
  } catch {
    return res.json({ message: 'If that email exists, a reset link has been sent' });
  }

  await recordResetRequest(normalizedEmail);

  const user = await User.findOne({ where: { email: normalizedEmail } });
  if (user) {
    const resetToken = crypto.randomBytes(32).toString('hex');
    await user.update({ resetToken, resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000) });
    sendPasswordResetEmail(user, resetToken).catch(() => {});
  }

  return res.json({ message: 'If that email exists, a reset link has been sent' });
});

// ─── Reset Password ───────────────────────────────────────────────────────────

router.post('/password/reset', async (req, res) => {
  const { token, password } = req.body ?? {};
  if (!token || !password) return res.status(400).json({ error: 'token and password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const user = await User.findOne({
    where: { resetToken: token, resetTokenExpiry: { [Op.gt]: new Date() } },
  });
  if (!user) return res.status(400).json({ error: 'Invalid or expired reset token' });

  const hashedPassword = await bcrypt.hash(password, 12);
  await user.update({ password: hashedPassword, resetToken: null, resetTokenExpiry: null });

  await revokeAllSessions(user.id);
  if (!isMobile(req)) clearAuthCookies(res);

  return res.json({ success: true });
});

// ─── Change Password ──────────────────────────────────────────────────────────

router.put('/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const user = await User.findByPk(req.user.sub);
  if (!user?.password) return res.status(400).json({ error: 'Cannot change password for OAuth-only accounts' });

  if (!(await bcrypt.compare(currentPassword, user.password))) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await user.update({ password: hashedPassword });

  // Revoke all sessions and reissue for the current client
  await revokeAllSessions(user.id);
  const tokens = await issueAuth(req, res, user);

  return res.json({ ...tokens, success: true });
});

// ─── Verify Email ─────────────────────────────────────────────────────────────

router.post('/email/verify', async (req, res) => {
  const { token } = req.body ?? {};
  if (!token) return res.status(400).json({ error: 'token is required' });

  const user = await User.findOne({
    where: { verifyToken: token, verifyTokenExpiry: { [Op.gt]: new Date() } },
  });
  if (!user) return res.status(400).json({ error: 'Invalid or expired verification token' });

  await user.update({ emailVerified: true, verifyToken: null, verifyTokenExpiry: null });
  return res.json({ success: true });
});

// ─── Resend Verification ──────────────────────────────────────────────────────

router.post('/email/resend', requireAuth, async (req, res) => {
  const user = await User.findByPk(req.user.sub);
  if (!user) return res.status(401).json({ error: 'User not found' });
  if (user.emailVerified) return res.status(400).json({ error: 'Email is already verified' });

  const verifyToken = crypto.randomBytes(32).toString('hex');
  await user.update({ verifyToken, verifyTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000) });
  sendVerificationEmail(user, verifyToken).catch(() => {});

  return res.json({ message: 'Verification email sent' });
});

// ─── Change Email ─────────────────────────────────────────────────────────────

router.put('/email', requireAuth, async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const user = await User.findByPk(req.user.sub);
  if (!user?.password) return res.status(400).json({ error: 'Cannot change email for OAuth-only accounts' });

  if (!(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  const normalizedEmail = email.toLowerCase();
  const taken = await User.findOne({ where: { email: normalizedEmail } });
  if (taken) return res.status(409).json({ error: 'That email is already in use' });

  const verifyToken = crypto.randomBytes(32).toString('hex');
  await user.update({
    email: normalizedEmail,
    emailVerified: false,
    verifyToken,
    verifyTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  sendEmailChangeEmail(user, verifyToken, normalizedEmail).catch(() => {});
  return res.json({ message: 'Email updated — please verify your new address' });
});

export default router;
