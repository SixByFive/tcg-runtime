/**
 * Internal client for messaging-service (port 4022).
 */
function getBaseUrl() {
  return process.env.MESSAGING_SERVICE_URL || 'http://localhost:4022';
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
    const err = new Error(data?.error || `messaging-service ${response.status}`);
    err.code  = data?.error; // propagate CHAT_BANNED / CHAT_AGREEMENT_REQUIRED etc.
    throw err;
  }
  return data;
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getMyChats(token, { page = 1, pageSize = 20 } = {}) {
  const data = await request(`/messages/chats?page=${page}&pageSize=${pageSize}`, {
    headers: authHeaders(token),
  });
  // Return array of { userId, lastMessage, unreadCount }
  return data?.chats ?? [];
}

export async function getMessages(token, userId, { page = 1, pageSize = 50 } = {}) {
  const data = await request(
    `/messages/chats/${encodeURIComponent(userId)}?page=${page}&pageSize=${pageSize}`,
    { headers: authHeaders(token) },
  );
  return data?.messages ?? [];
}

export async function getUnreadCount(token) {
  const data = await request('/messages/unread-count', { headers: authHeaders(token) });
  return data?.count ?? 0;
}

export async function hasAgreedToChatRules(token) {
  const data = await request('/messages/agreed', { headers: authHeaders(token) });
  return data?.agreed ?? false;
}

export async function getChatRulesText() {
  const data = await request('/messages/rules');
  return data?.text ?? '';
}

export async function getMyMutes(token) {
  const data = await request('/messages/mutes', { headers: authHeaders(token) });
  return data?.mutes ?? [];
}

export async function getMyBlocks(token) {
  const data = await request('/messages/blocks', { headers: authHeaders(token) });
  return data?.blocks ?? [];
}

export async function adminGetReportedUsers(token, { page = 1, pageSize = 50, isCleared } = {}) {
  const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (isCleared !== undefined) p.set('isCleared', String(isCleared));
  const data = await request(`/messages/admin/reports/users?${p.toString()}`, {
    headers: authHeaders(token),
  });
  return data?.reports ?? [];
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function sendMessage(token, { receiverId, content, meta }) {
  return request('/messages/send', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ receiverId, content, meta }),
  });
}

export async function markRead(token, userId) {
  await request(`/messages/read/${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
  return true;
}

export async function deleteChat(token, userId) {
  await request(`/messages/chat/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return true;
}

export async function reportMessage(token, { messageId, reason, details }) {
  await request('/messages/report/message', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ messageId, reason, details }),
  });
  return true;
}

export async function reportUser(token, { userId, reason, details }) {
  await request('/messages/report/user', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ userId, reason, details }),
  });
  return true;
}

export async function agreeToChatRules(token) {
  await request('/messages/agree', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
  return true;
}

export async function muteConversation(token, userId, mutedUntil) {
  await request(`/messages/mute/${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ mutedUntil: mutedUntil ?? null }),
  });
  return true;
}

export async function unmuteConversation(token, userId) {
  await request(`/messages/mute/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return true;
}

export async function blockUser(token, userId, reason) {
  await request(`/messages/block/${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ reason: reason ?? null }),
  });
  return true;
}

export async function unblockUser(token, userId) {
  await request(`/messages/block/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return true;
}

export async function adminBanUserFromChat(token, userId, reason) {
  await request(`/messages/admin/ban/${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ reason: reason ?? null }),
  });
  return true;
}

export async function adminUnbanUserFromChat(token, userId) {
  await request(`/messages/admin/ban/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return true;
}

export async function adminDeleteMessage(token, id) {
  await request(`/messages/admin/messages/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return true;
}

export async function adminClearUserReport(token, userId) {
  await request(`/messages/admin/clear-report/${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
  return true;
}

export async function adminSendSystemMessage(token, { receiverId, content, meta }) {
  return request('/messages/admin/send-system', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ receiverId, content, meta }),
  });
}
