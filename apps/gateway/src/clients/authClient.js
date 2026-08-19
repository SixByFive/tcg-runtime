/**
 * Internal client for auth-service.
 *
 * Calls auth-service as a "mobile" client (X-Client-Type: mobile) so that
 * tokens are returned in the response body rather than set as HttpOnly cookies
 * (which would be lost in a server-to-server call anyway).
 */
function getAuthServiceBaseUrl() {
  return process.env.AUTH_SERVICE_URL || 'http://localhost:4011';
}

async function parseJson(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function request(path, options = {}) {
  const url = `${getAuthServiceBaseUrl()}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      // Tell auth-service to return tokens in the body (not cookies)
      'X-Client-Type': 'mobile',
      ...(options.headers || {}),
    },
  });

  const data = await parseJson(response);

  if (!response.ok) {
    const message = data?.error || data?.message || `Auth service request failed: ${response.status}`;
    throw new Error(message);
  }

  return data;
}

/** Normalise auth-service user shape → gateway User type. */
function normaliseUser(user) {
  if (!user) return null;
  return {
    ...user,
    mfaEnabled: user.mfaEnabled ?? user.twoFactorEnabled ?? false,
    avatar: user.avatar ?? null,
    oauthProvider: user.oauthProvider ?? null,
    oauthId: user.oauthId ?? null,
    discordId: user.discordId ?? null,
    discordUsername: user.discordUsername ?? null,
  };
}

export async function getMe(token) {
  const data = await request('/auth/me', {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { user: normaliseUser(data?.user ?? data) };
}

export async function login(input) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      username: input.username,
      password: input.password,
    }),
  });

  return {
    token: data?.accessToken ?? null,
    refreshToken: data?.refreshToken ?? null,
    user: normaliseUser(data?.user),
  };
}

export async function register(input) {
  const data = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username: input.username,
      email: input.email,
      password: input.password,
      referrerId: input.referrerId,
    }),
  });

  return {
    token: data?.accessToken ?? null,
    refreshToken: data?.refreshToken ?? null,
    user: normaliseUser(data?.user),
  };
}

// ─── Password reset ───────────────────────────────────────────────────────────

export async function requestPasswordReset(email) {
  await request('/auth/password/forgot', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  return true;
}

export async function resetPassword(token, newPassword) {
  const data = await request('/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify({ token, password: newPassword }),
  });
  return data?.success ?? true;
}

export async function changePassword(token, currentPassword, newPassword) {
  await request('/auth/password', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return true;
}

export async function changeEmail(token, newEmail, currentPassword) {
  await request('/auth/email', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ email: newEmail, password: currentPassword }),
  });
  return true;
}

// ─── Two-factor auth ──────────────────────────────────────────────────────────

export async function enableTwoFactor(token) {
  return request('/auth/2fa/setup', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
}

export async function verifyTwoFactor(token, code) {
  const data = await request('/auth/2fa/verify', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ token: code }),
  });
  return data?.success ?? true;
}

export async function disableTwoFactor(token, code) {
  const data = await request('/auth/2fa', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ token: code }),
  });
  return data?.success ?? true;
}

// ─── Marketing attribution admin ──────────────────────────────────────────────

export async function adminGetMarketingAttribution(token) {
  return request('/auth/attribution/admin', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}
