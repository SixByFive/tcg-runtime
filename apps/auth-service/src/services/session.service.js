import { getRedis } from '../lib/redis.js';
import { generateRefreshToken, REFRESH_EXPIRY_SECONDS } from './token.service.js';

// Stores refresh tokens in Redis.
// refresh:{token}        → userId  (expires after REFRESH_EXPIRY_SECONDS)
// refresh_set:{userId}   → Set of active token strings (for bulk revocation)

export async function createSession(userId) {
  const token = generateRefreshToken();
  const r = getRedis();
  await r.set(`refresh:${token}`, String(userId), 'EX', REFRESH_EXPIRY_SECONDS);
  await r.sadd(`refresh_set:${userId}`, token);
  await r.expire(`refresh_set:${userId}`, REFRESH_EXPIRY_SECONDS);
  return token;
}

export async function validateSession(token) {
  const userId = await getRedis().get(`refresh:${token}`);
  return userId ?? null;
}

// Delete the old token and create a new one atomically (rotation).
export async function rotateSession(oldToken, userId) {
  const newToken = generateRefreshToken();
  const r = getRedis();
  await r.del(`refresh:${oldToken}`);
  await r.srem(`refresh_set:${userId}`, oldToken);
  await r.set(`refresh:${newToken}`, String(userId), 'EX', REFRESH_EXPIRY_SECONDS);
  await r.sadd(`refresh_set:${userId}`, newToken);
  await r.expire(`refresh_set:${userId}`, REFRESH_EXPIRY_SECONDS);
  return newToken;
}

export async function revokeSession(token, userId) {
  const r = getRedis();
  await r.del(`refresh:${token}`);
  if (userId) await r.srem(`refresh_set:${userId}`, token);
}

// Revoke every active session for a user (password reset, account compromise).
export async function revokeAllSessions(userId) {
  const r = getRedis();
  const tokens = await r.smembers(`refresh_set:${userId}`);
  if (tokens.length > 0) {
    await r.del(tokens.map((t) => `refresh:${t}`));
  }
  await r.del(`refresh_set:${userId}`);
}
