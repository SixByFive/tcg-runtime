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
    maxCollectionCards: 500,
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

export async function adminGetSubscriptions(token, { page = 1, pageSize = 50 } = {}) {
  const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const data = await request(`/payments/admin?${p.toString()}`, {
    headers: authHeaders(token),
  });
  return data?.subscriptions ?? data ?? [];
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function getMyTransactions(token, { page = 1, pageSize = 20 } = {}) {
  const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const data = await request(`/payments/transactions?${p.toString()}`, {
    headers: authHeaders(token),
  });
  return data?.transactions ?? data ?? [];
}

export async function adminGetTransactions(token, { page = 1, pageSize = 50 } = {}) {
  const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const data = await request(`/payments/admin/transactions?${p.toString()}`, {
    headers: authHeaders(token),
  });
  return data?.transactions ?? data ?? [];
}
