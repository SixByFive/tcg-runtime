/**
 * Internal client for payments-service (port 4019).
 */
function getBaseUrl() {
  return process.env.PAYMENTS_SERVICE_URL || 'http://localhost:4019';
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
    const err = new Error(data?.error || `payments-service ${response.status}`);
    err.code = data?.error;
    throw err;
  }
  return data;
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Plans ────────────────────────────────────────────────────────────────────

export async function getPlans() {
  const data = await request('/payments/plans');
  return data?.plans ?? data ?? [];
}

export async function adminGetPlans(token) {
  const data = await request('/payments/admin/plans', {
    headers: authHeaders(token),
  });
  return data?.plans ?? data ?? [];
}

export async function adminCreatePlan(token, input) {
  return request('/payments/admin/plans', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export async function adminUpdatePlan(token, id, input) {
  return request(`/payments/admin/plans/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

// ─── Capabilities ─────────────────────────────────────────────────────────────

export async function getMyCapabilities(userId) {
  const key = process.env.INTERNAL_API_KEY;
  const FREE_DEFAULTS = {
    planName: 'Free',
    platformFeePercent: 8,
    maxBinders: 3,
    maxCollectionCards: null, // unlimited — collection is never capped
    maxActiveListings: 5,
    maxActiveTrades: 3,
    features: [],
  };
  if (!userId) return FREE_DEFAULTS;
  try {
    return await request(`/internal/capabilities/${encodeURIComponent(userId)}`, {
      headers: key ? { 'x-internal-key': key } : {},
    });
  } catch {
    return FREE_DEFAULTS;
  }
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export async function getMySubscription(token) {
  return request('/payments/subscription', {
    headers: authHeaders(token),
  });
}

export async function createSubscription(token, { planId, paymentMethodId }) {
  return request('/payments/subscription', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ planId, paymentMethodId }),
  });
}

export async function cancelSubscription(token) {
  return request('/payments/subscription/cancel', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
}

export async function resumeSubscription(token) {
  return request('/payments/subscription/resume', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
}

export async function getSubscriptionPortal(token) {
  return request('/payments/subscription/portal', {
    headers: authHeaders(token),
  });
}

export async function adminGetSubscriptions(token, { status, page = 1, pageSize = 50 } = {}) {
  const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (status) p.set('status', status);
  return request(`/payments/subscription/admin?${p.toString()}`, { headers: authHeaders(token) });
}

export async function adminCancelSubscription(token, id) {
  return request(`/payments/subscription/admin/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
}

export async function adminResumeSubscription(token, id) {
  return request(`/payments/subscription/admin/${encodeURIComponent(id)}/resume`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
}

export async function adminChangePlan(token, id, planId) {
  return request(`/payments/subscription/admin/${encodeURIComponent(id)}/change-plan`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ planId }),
  });
}

export async function adminGrantSubscription(token, { userId, planId, periodDays }) {
  return request('/payments/subscription/admin/grant', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ userId, planId, periodDays }),
  });
}

export async function adminRevokeSubscription(token, id) {
  return request(`/payments/subscription/admin/${encodeURIComponent(id)}/revoke`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function getMyTransactions(token, { page = 1, pageSize = 20 } = {}) {
  const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const data = await request(`/payments/transactions?${p.toString()}`, {
    headers: authHeaders(token),
  });
  return data?.transactions ?? data ?? [];
}

export async function adminGetTransactions(token, { page = 1, pageSize = 50, type, status } = {}) {
  const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (type)   p.set('type', type);
  if (status) p.set('status', status);
  return request(`/payments/transactions/admin?${p.toString()}`, { headers: authHeaders(token) });
}

export async function adminGetRevenueSummary(token) {
  return request('/payments/transactions/admin/revenue-summary', { headers: authHeaders(token) });
}

export async function adminUpdatePlanDetails(token, id, input) {
  return request(`/payments/plans/admin/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

// ─── Wallet ───────────────────────────────────────────────────────────────────

export async function getMyWallet(token, { limit = 20, offset = 0 } = {}) {
  const p = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return request(`/payments/wallet?${p.toString()}`, {
    headers: authHeaders(token),
  });
}

export async function createTopupIntent(token, { amountPence }) {
  return request('/payments/wallet/topup', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ amountPence }),
  });
}

export async function confirmTopup(token, paymentIntentId) {
  return request(`/payments/wallet/topup/${encodeURIComponent(paymentIntentId)}/confirm`, {
    method: 'POST',
    headers: authHeaders(token),
  });
}

export async function requestWithdrawal(token, { amountPence, sortCode, accountNumber, accountName }) {
  return request('/payments/wallet/withdraw', {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ amountPence, sortCode, accountNumber, accountName }),
  });
}
