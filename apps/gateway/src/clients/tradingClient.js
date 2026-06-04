/**
 * Internal client for trading-service (port 4015).
 */
function getBaseUrl() {
  return process.env.TRADING_SERVICE_URL || 'http://localhost:4015';
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
    const err = new Error(data?.error || `trading-service ${response.status}`);
    err.code = data?.error;
    throw err;
  }
  return data;
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function browseTrades({ page = 1, pageSize = 20 } = {}) {
  const data = await request(`/trades/browse?page=${page}&pageSize=${pageSize}`);
  return data?.trades ?? [];
}

export async function getMyTrades(token, { page = 1, pageSize = 20, status } = {}) {
  const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (status) p.set('status', status);
  const data = await request(`/trades?${p.toString()}`, {
    headers: authHeaders(token),
  });
  return data?.trades ?? [];
}

export async function getTrade(token, id) {
  return request(`/trades/${encodeURIComponent(id)}`, {
    headers: authHeaders(token),
  });
}

export async function getTradeProofs(token, id) {
  const data = await request(`/trades/${encodeURIComponent(id)}/proof`, {
    headers: authHeaders(token),
  });
  return Array.isArray(data) ? data : (data?.proofs ?? []);
}

export async function adminGetTrades(token, { page = 1, pageSize = 50, status, userId } = {}) {
  const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (status) p.set('status', status);
  if (userId) p.set('userId', userId);
  const data = await request(`/trades/admin/list?${p.toString()}`, {
    headers: authHeaders(token),
  });
  return data?.trades ?? [];
}

export async function adminGetDisputes(token, { status } = {}) {
  const p = new URLSearchParams();
  if (status) p.set('status', status);
  const data = await request(`/trades/admin/disputes?${p.toString()}`, {
    headers: authHeaders(token),
  });
  return Array.isArray(data) ? data : [];
}

export async function adminGetTradeBans(token) {
  const data = await request('/trades/admin/block-user', {
    headers: authHeaders(token),
  });
  return Array.isArray(data) ? data : [];
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function initiateTrade(token, { userId, offeredCards = [], wantedCards = [], topUpAmount = null }) {
  return request('/trades', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      userId,
      offeredCards,
      wantedCards,
      ...(topUpAmount != null ? { topUpAmount } : {}),
    }),
  });
}

export async function respondToTrade(token, id, { accept, counterCards, reason }) {
  return request(`/trades/${encodeURIComponent(id)}/respond`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ accept, counterCards, reason }),
  });
}

export async function cancelTrade(token, id, reason) {
  return request(`/trades/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ reason: reason ?? null }),
  });
}

export async function uploadTradeProof(token, id, { proofImage, proofCode }) {
  return request(`/trades/${encodeURIComponent(id)}/proof`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ proofImage, proofCode }),
  });
}

export async function quoteTradeShipping(token, id) {
  return request(`/trades/${encodeURIComponent(id)}/quote-shipping`, {
    method: 'GET',
    headers: authHeaders(token),
  });
}

export async function setTradeShippingAddress(token, id, address) {
  return request(`/trades/${encodeURIComponent(id)}/address`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ address }),
  });
}

export async function shipTrade(token, id, parcelSize) {
  return request(`/trades/${encodeURIComponent(id)}/ship`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ parcelSize }),
  });
}

export async function submitTradeTracking(token, id, trackingNumber) {
  return request(`/trades/${encodeURIComponent(id)}/tracking`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ trackingNumber }),
  });
}

export async function confirmTradeReceived(token, id) {
  return request(`/trades/${encodeURIComponent(id)}/confirm`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
}

export async function raiseTradeDispute(token, id, reason) {
  return request(`/trades/${encodeURIComponent(id)}/dispute`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ reason }),
  });
}

export async function leaveTradeFeedback(token, id, { rating, review }) {
  return request(`/trades/${encodeURIComponent(id)}/feedback`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ rating, review }),
  });
}

export async function adminResolveTradeDispute(token, id, { resolution, resolvedInFavourOf }) {
  return request(`/trades/admin/${encodeURIComponent(id)}/resolve-dispute`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ resolution, resolvedInFavourOf }),
  });
}

export async function adminApproveTradeProof(token, id, { proofId, party }) {
  return request(`/trades/admin/${encodeURIComponent(id)}/proof-approve`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ proofId, party }),
  });
}

export async function adminBanUserFromTrading(token, userId, reason) {
  await request('/trades/admin/block-user', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ userId, reason: reason ?? null }),
  });
  return true;
}

export async function adminUnbanUserFromTrading(token, userId) {
  await request(`/trades/admin/block-user/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return true;
}
