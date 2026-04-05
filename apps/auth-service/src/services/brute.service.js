import { getRedis } from '../lib/redis.js';

async function increment(key, windowSec) {
  const r = getRedis();
  const n = await r.incr(key);
  if (n === 1) await r.expire(key, windowSec);
  return n;
}

// Login: 7 attempts per 15 min per email (matches old backend behaviour)
export async function checkLoginBrute(email) {
  const count = Number((await getRedis().get(`brute:login:${email}`)) ?? 0);
  if (count >= 7) {
    throw Object.assign(new Error('Too many login attempts, try again later'), { status: 429 });
  }
}

export async function recordLoginFailure(email) {
  await increment(`brute:login:${email}`, 15 * 60);
}

export async function clearLoginBrute(email) {
  await getRedis().del(`brute:login:${email}`);
}

// TOTP: 5 attempts per 15 min per userId
export async function checkTotpBrute(userId) {
  const count = Number((await getRedis().get(`brute:totp:${userId}`)) ?? 0);
  if (count >= 5) {
    throw Object.assign(new Error('Too many 2FA attempts, try again later'), { status: 429 });
  }
}

export async function recordTotpFailure(userId) {
  await increment(`brute:totp:${userId}`, 15 * 60);
}

export async function clearTotpBrute(userId) {
  await getRedis().del(`brute:totp:${userId}`);
}

// Password reset: 3 requests per hour per email
export async function checkResetBrute(email) {
  const count = Number((await getRedis().get(`brute:reset:${email}`)) ?? 0);
  if (count >= 3) {
    throw Object.assign(new Error('Too many reset requests'), { status: 429 });
  }
}

export async function recordResetRequest(email) {
  await increment(`brute:reset:${email}`, 60 * 60);
}
