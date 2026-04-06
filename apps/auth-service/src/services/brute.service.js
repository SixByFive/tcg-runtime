// In-memory brute force tracking — matches old backend behaviour.
// Resets on restart (acceptable for single-instance deployments).

const store = new Map(); // key -> { count, resetAt }

function get(key) {
  const entry = store.get(key);
  if (!entry || Date.now() > entry.resetAt) return 0;
  return entry.count;
}

function record(key, windowMs) {
  const entry = store.get(key);
  if (!entry || Date.now() > entry.resetAt) {
    store.set(key, { count: 1, resetAt: Date.now() + windowMs });
  } else {
    entry.count++;
  }
}

function clear(key) {
  store.delete(key);
}

// Login: 7 attempts per 15 min per email
export async function checkLoginBrute(email) {
  if (get(`login:${email}`) >= 7) {
    throw Object.assign(new Error('Too many login attempts, try again later'), { status: 429 });
  }
}

export async function recordLoginFailure(email) {
  record(`login:${email}`, 15 * 60 * 1000);
}

export async function clearLoginBrute(email) {
  clear(`login:${email}`);
}

// TOTP: 5 attempts per 15 min per userId
export async function checkTotpBrute(userId) {
  if (get(`totp:${userId}`) >= 5) {
    throw Object.assign(new Error('Too many 2FA attempts, try again later'), { status: 429 });
  }
}

export async function recordTotpFailure(userId) {
  record(`totp:${userId}`, 15 * 60 * 1000);
}

export async function clearTotpBrute(userId) {
  clear(`totp:${userId}`);
}

// Password reset: 3 requests per hour per email
export async function checkResetBrute(email) {
  if (get(`reset:${email}`) >= 3) {
    throw Object.assign(new Error('Too many reset requests'), { status: 429 });
  }
}

export async function recordResetRequest(email) {
  record(`reset:${email}`, 60 * 60 * 1000);
}
