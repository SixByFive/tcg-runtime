/**
 * Internal client for user-service.
 */
function getBaseUrl() {
  return process.env.USER_SERVICE_URL || 'http://localhost:4021';
}

async function parseJson(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function request(path, options = {}) {
  const url = `${getBaseUrl()}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || `user-service ${response.status}`);
  }
  return data;
}

/**
 * GET /users/:username
 * Returns a UserProfile shape for the GraphQL schema.
 * user-service returns { id, username, emailVerified, createdAt, profile: { ... } }
 */
export async function getProfile(username) {
  const data = await request(`/users/${encodeURIComponent(username)}`);
  if (!data) return null;

  const profile = data.profile || {};

  return {
    id:               profile.id   ?? null,
    userId:           data.id      ?? null,
    bio:              profile.bio  ?? null,
    favouritePokemon: profile.favouritePokemon ?? null,
    avatar:           profile.avatar ?? null,
    user: {
      id:            data.id            ?? null,
      username:      data.username      ?? null,
      emailVerified: data.emailVerified ?? null,
      createdAt:     data.createdAt     ?? null,
    },
  };
}

/**
 * GET /users/by-id/:id
 * Returns a UserProfile shape by numeric/UUID user id.
 */
export async function getProfileById(userId) {
  const data = await request(`/users/by-id/${encodeURIComponent(userId)}`);
  if (!data) return null;

  const profile = data.profile || {};

  return {
    id:               profile.id   ?? null,
    userId:           data.id      ?? null,
    bio:              profile.bio  ?? null,
    favouritePokemon: profile.favouritePokemon ?? null,
    avatar:           profile.avatar ?? null,
    user: {
      id:            data.id            ?? null,
      username:      data.username      ?? null,
      emailVerified: data.emailVerified ?? null,
      createdAt:     data.createdAt     ?? null,
    },
  };
}

/**
 * PATCH /users/me — update the authenticated user's profile fields.
 * Returns a UserProfile shape.
 */
export async function updateProfile(token, updates) {
  const ALLOWED = ['bio', 'favouritePokemon', 'avatar', 'country', 'status',
                   'publicProfile', 'wantsTrade', 'wantsMarketplace'];
  const body = Object.fromEntries(
    Object.entries(updates).filter(([k]) => ALLOWED.includes(k)),
  );

  const profile = await request('/users/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  if (!profile) return null;

  return {
    id:               profile.id               ?? null,
    userId:           profile.userId           ?? null,
    bio:              profile.bio              ?? null,
    favouritePokemon: profile.favouritePokemon ?? null,
    avatar:           profile.avatar           ?? null,
    user: null, // caller can re-fetch if needed; avoids an extra round-trip
  };
}

/**
 * GET /users/search?q=...
 */
export async function searchUsers(q, limit = 10) {
  const p = new URLSearchParams({ q, limit: String(Math.min(50, limit)) });
  const data = await request(`/users/search?${p.toString()}`);
  return Array.isArray(data) ? data : (data?.users ?? []);
}

/**
 * DELETE /users/me — delete own account.
 */
export async function deleteAccount(token, { password, confirm } = {}) {
  await request('/users/me', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ password, confirm }),
  });
  return true;
}

/**
 * GET /users/me/export — download own data export.
 */
export async function exportUserData(token) {
  const data = await request('/users/me/export', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getAchievements(userId) {
  const data = await request(`/achievements/user/${encodeURIComponent(userId)}`);
  return Array.isArray(data) ? data : [];
}
export async function getMyAchievements(token) {
  const data = await request('/achievements/my', { headers: authHeaders(token) });
  return Array.isArray(data) ? data : [];
}
export async function getAllAchievements() {
  const data = await request('/achievements');
  return Array.isArray(data) ? data : [];
}
export async function adminGrantAchievement(token, { userId, achievementId, data }) {
  return request('/achievements/grant', {
    method: 'POST', headers: authHeaders(token),
    body: JSON.stringify({ userId, achievementId, data }),
  });
}

export async function getDiscordShareGuilds(token) {
  const data = await request('/discord/share/guilds', { headers: authHeaders(token) });
  return Array.isArray(data) ? data : [];
}
export async function getDiscordShareChannels(token, guildId) {
  const data = await request(`/discord/share/guilds/${encodeURIComponent(guildId)}/channels`, { headers: authHeaders(token) });
  return Array.isArray(data) ? data : [];
}
export async function shareCollectionToDiscord(token, body) {
  return request('/discord/share/collection', { method: 'POST', headers: authHeaders(token), body: JSON.stringify(body) });
}
export async function shareWishlistToDiscord(token, body) {
  return request('/discord/share/wishlist', { method: 'POST', headers: authHeaders(token), body: JSON.stringify(body) });
}

// ─── Safety ───────────────────────────────────────────────────────────────────

export async function getMySafetyProfile(token) {
  return request('/safety/capabilities', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateSafetyProfile(token, { dob, parentEmail }) {
  return request('/safety/profile', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ dob, parentEmail }),
  });
}

export async function requestParentVerification(token) {
  return request('/safety/request-parent-verification', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
}

export async function adminSetUserRestriction(token, userId, restrictionLevel) {
  return request('/safety/admin/set-restriction', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ userId, restrictionLevel }),
  });
}

export async function adminSetParentVerified(token, userId, verified) {
  return request('/safety/admin/set-parent-verified', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ userId, verified }),
  });
}

export async function adminClearParentLink(token, userId) {
  await request(`/safety/admin/clear-parent-link/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return true;
}

// ─── Rewards ─────────────────────────────────────────────────────────────────

export async function getMyRewards(token) {
  const data = await request('/rewards/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return Array.isArray(data) ? data : [];
}

export async function getUserRewards(userId) {
  const data = await request(`/rewards/user/${encodeURIComponent(userId)}`);
  return Array.isArray(data) ? data : [];
}

export async function grantReward(token, { userId, type, achievementId, data: rewardData }) {
  return request('/rewards/grant', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ userId, type, achievementId, data: rewardData }),
  });
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export async function getAuditLogs(token, { page = 1, pageSize = 50, userId, action, targetId, targetType } = {}) {
  const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (userId)     p.set('userId', userId);
  if (action)     p.set('action', action);
  if (targetId)   p.set('targetId', targetId);
  if (targetType) p.set('targetType', targetType);
  const data = await request(`/audit?${p.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data?.logs ?? [];
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function adminGetUsers(token, { limit = 100, offset = 0, search } = {}) {
  const p = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (search) p.set('search', search);
  const data = await request(`/admin/users?${p.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data?.users ?? [];
}

export async function adminBanUser(token, id) {
  await request(`/admin/users/${encodeURIComponent(id)}/ban`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
  return true;
}

export async function adminUnbanUser(token, id) {
  await request(`/admin/users/${encodeURIComponent(id)}/unban`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
  return true;
}

export async function adminDeleteUser(token, id) {
  await request(`/admin/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return true;
}
