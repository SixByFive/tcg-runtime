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
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
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
    const message =
      data?.error ||
      data?.message ||
      `Auth service request failed: ${response.status}`;
    throw new Error(message);
  }

  return data;
}

/**
 * Normalise auth-service user shape → gateway User type.
 * auth-service uses twoFactorEnabled; schema exposes both twoFactorEnabled + mfaEnabled.
 */
function normaliseUser(user) {
  if (!user) return null;
  return {
    ...user,
    // Alias — some frontend code uses mfaEnabled, some twoFactorEnabled
    mfaEnabled: user.mfaEnabled ?? user.twoFactorEnabled ?? false,
    avatar: user.avatar ?? null,
    oauthProvider: user.oauthProvider ?? null,
    oauthId: user.oauthId ?? null,
    discordId: user.discordId ?? null,
    discordUsername: user.discordUsername ?? null,
  };
}

/**
 * GET /auth/me — returns { user } or throws if unauthenticated.
 */
export async function getMe(token) {
  const data = await request('/auth/me', {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { user: normaliseUser(data?.user ?? data) };
}

/**
 * POST /auth/login → { token, user }
 * Maps auth-service's accessToken → token for the GraphQL schema.
 */
export async function login(input) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email:    input.email,
      username: input.username,
      password: input.password,
    }),
  });

  return {
    token:        data?.accessToken  ?? null,
    refreshToken: data?.refreshToken ?? null,
    user:         normaliseUser(data?.user),
  };
}

/**
 * POST /auth/register → { token, refreshToken, user }
 */
export async function register(input) {
  const data = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username: input.username,
      email:    input.email,
      password: input.password,
    }),
  });

  return {
    token:        data?.accessToken  ?? null,
    refreshToken: data?.refreshToken ?? null,
    user:         normaliseUser(data?.user),
  };
}

// ─── Password reset ───────────────────────────────────────────────────────────

/**
 * POST /auth/password/forgot — sends a reset email; always returns true.
 */
export async function requestPasswordReset(email) {
  await request('/auth/password/forgot', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  return true;
}

/**
 * POST /auth/password/reset — consumes a reset token and sets a new password.
 */
export async function resetPassword(token, newPassword) {
  const data = await request('/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify({ token, password: newPassword }),
  });
  return data?.success ?? true;
}

/**
 * PUT /auth/password — change password while authenticated.
 * Returns true; the service also re-issues tokens but the GraphQL layer ignores them.
 */
export async function changePassword(token, currentPassword, newPassword) {
  await request('/auth/password', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return true;
}

/**
 * PUT /auth/email — change email while authenticated; triggers re-verification.
 */
export async function changeEmail(token, newEmail, currentPassword) {
  await request('/auth/email', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ email: newEmail, password: currentPassword }),
  });
  return true;
}

// ─── Two-factor auth ──────────────────────────────────────────────────────────

/**
 * POST /auth/2fa/setup → { otpauthUrl, qrCodeDataURL }
 */
export async function enableTwoFactor(token) {
  return request('/auth/2fa/setup', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
}

/**
 * POST /auth/2fa/verify — confirms setup and enables 2FA.
 */
export async function verifyTwoFactor(token, code) {
  const data = await request('/auth/2fa/verify', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ token: code }),
  });
  return data?.success ?? true;
}

/**
 * DELETE /auth/2fa — disables 2FA; requires current TOTP code.
 */
export async function disableTwoFactor(token, code) {
  const data = await request('/auth/2fa', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ token: code }),
  });
  return data?.success ?? true;
}
