/**
 * Internal client for notifications-service.
 */
function getBaseUrl() {
  return process.env.NOTIFICATIONS_SERVICE_URL || 'http://localhost:4016';
}

const INTERNAL_KEY = () => process.env.INTERNAL_API_KEY || '';

async function parseJson(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function authedRequest(path, token, options = {}) {
  const url = `${getBaseUrl()}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || `notifications-service ${response.status}`);
  }
  return data;
}

async function internalRequest(path, body) {
  const url = `${getBaseUrl()}${path}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-key': INTERNAL_KEY(),
    },
    body: JSON.stringify(body),
  });
  const data = await parseJson(response);
  if (!response.ok) throw new Error(data?.error || `notifications-service ${response.status}`);
  return data;
}

export async function getMyNotifications(token, { page = 1, pageSize = 20, filter } = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (filter?.isRead     !== undefined) params.set('isRead',     String(filter.isRead));
  if (filter?.isDismissed !== undefined) params.set('isDismissed', String(filter.isDismissed));
  if (filter?.type)                      params.set('type',        filter.type);
  const data = await authedRequest(`/notifications?${params}`, token, { method: 'GET' });
  return {
    notifications: data?.notifications ?? data?.items ?? [],
    total:    data?.total    ?? 0,
    page:     data?.page     ?? page,
    pageSize: data?.pageSize ?? pageSize,
  };
}

export async function getUnreadCount(token) {
  const data = await authedRequest('/notifications/count', token, { method: 'GET' });
  return { count: data?.count ?? data?.unreadCount ?? 0 };
}

export async function markRead(token, id) {
  return authedRequest(`/notifications/${id}/read`, token, { method: 'POST', body: JSON.stringify({}) });
}

export async function markAllRead(token) {
  return authedRequest('/notifications/read-all', token, { method: 'POST', body: JSON.stringify({}) });
}

export async function dismiss(token, id) {
  return authedRequest(`/notifications/${id}/dismiss`, token, { method: 'POST', body: JSON.stringify({}) });
}

// ─── Push tokens ─────────────────────────────────────────────────────────────

export async function registerPushToken(token, { expoPushToken, platform, deviceName, appVersion }) {
  return authedRequest('/push/register', token, {
    method: 'POST',
    body: JSON.stringify({ expoPushToken, platform, deviceName, appVersion }),
  });
}

export async function unregisterPushToken(token, expoPushToken) {
  return authedRequest('/push/unregister', token, {
    method: 'POST',
    body: JSON.stringify({ expoPushToken }),
  });
}

export async function sendTestPush(token, { title, body }) {
  return authedRequest('/push/test', token, {
    method: 'POST',
    body: JSON.stringify({ title, body }),
  });
}

export async function adminDeleteNotification(token, id) {
  return authedRequest(`/notifications/admin/${encodeURIComponent(id)}`, token, {
    method: 'DELETE',
  });
}

export async function adminGetNotifications(token, { page = 1, pageSize = 50, userId, type } = {}) {
  const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (userId) p.set('userId', userId);
  if (type)   p.set('type', type);
  const data = await authedRequest(`/notifications/admin/list?${p.toString()}`, token, { method: 'GET' });
  return {
    notifications: data?.notifications ?? [],
    total:    data?.total    ?? 0,
    page:     data?.page     ?? page,
    pageSize: data?.pageSize ?? pageSize,
  };
}

export async function getPrefs(token) {
  return authedRequest('/notifications/prefs', token, { method: 'GET' });
}

export async function adminBroadcast(token, input) {
  return authedRequest('/notifications/admin/broadcast', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function setPrefs(token, prefs) {
  return authedRequest('/notifications/prefs', token, {
    method: 'PATCH',
    body: JSON.stringify(prefs),
  });
}

// ─── Web Push ─────────────────────────────────────────────────────────────────

export async function getVapidPublicKey() {
  const url = `${getBaseUrl()}/push/vapid-key`;
  const res = await fetch(url, { method: 'GET' });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || 'Failed to get VAPID key');
  return data?.publicKey ?? null;
}

export async function subscribeWebPush(token, { endpoint, keys, userAgent }) {
  return authedRequest('/push/web/subscribe', token, {
    method: 'POST',
    body: JSON.stringify({ endpoint, keys, userAgent }),
  });
}

export async function unsubscribeWebPush(token, endpoint) {
  return authedRequest('/push/web/unsubscribe', token, {
    method: 'POST',
    body: JSON.stringify({ endpoint }),
  });
}
