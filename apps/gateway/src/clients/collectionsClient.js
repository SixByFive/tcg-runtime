function getBaseUrl() {
  return process.env.COLLECTIONS_SERVICE_URL || 'http://localhost:4013';
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
    const message = data?.error || data?.message || `Collections service error: ${response.status}`;
    throw new Error(message);
  }

  return data;
}

function authHeaders(token, req) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // Forward cookies for web clients
  if (req?.headers?.cookie) headers['Cookie'] = req.headers.cookie;
  return headers;
}

// ── Collection ────────────────────────────────────────────────────────────────

export async function getMyCollection(token, req) {
  return request('/collection', { method: 'GET', headers: authHeaders(token, req) });
}

export async function getCollection(userId) {
  return request(`/collection/${userId}`, { method: 'GET' });
}

export async function getCollectionEntry(token, req, { cardId, variation }) {
  const params = new URLSearchParams({ cardId });
  if (variation) params.set('variation', variation);
  return request(`/collection/entry?${params}`, { method: 'GET', headers: authHeaders(token, req) });
}

export async function addToCollection(token, req, input) {
  return request('/collection', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: authHeaders(token, req),
  });
}

export async function updateCollection(token, req, input) {
  return request('/collection', {
    method: 'PATCH',
    body: JSON.stringify(input),
    headers: authHeaders(token, req),
  });
}

export async function removeFromCollection(token, req, input) {
  return request('/collection', {
    method: 'DELETE',
    body: JSON.stringify(input),
    headers: authHeaders(token, req),
  });
}

export async function bulkAddToCollection(token, req, { cards }) {
  return request('/collection/bulk-add', {
    method: 'POST',
    body: JSON.stringify({ cards }),
    headers: authHeaders(token, req),
  });
}

export async function moveToWishlist(token, req, input) {
  return request('/collection/move-to-wishlist', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: authHeaders(token, req),
  });
}

export async function moveFromWishlist(token, req, input) {
  return request('/collection/move-from-wishlist', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: authHeaders(token, req),
  });
}

// ── Wishlist ──────────────────────────────────────────────────────────────────

export async function getMyWishlist(token, req, { page, pageSize } = {}) {
  const params = new URLSearchParams();
  if (page) params.set('page', page);
  if (pageSize) params.set('pageSize', pageSize);
  return request(`/wishlist?${params}`, { method: 'GET', headers: authHeaders(token, req) });
}

export async function getWishlist(userId, { page, pageSize } = {}) {
  const params = new URLSearchParams({ });
  if (page) params.set('page', page);
  if (pageSize) params.set('pageSize', pageSize);
  return request(`/wishlist/${userId}?${params}`, { method: 'GET' });
}

export async function getWishlistEntry(token, req, { cardId, variation }) {
  const params = new URLSearchParams({ cardId });
  if (variation) params.set('variation', variation);
  return request(`/wishlist/entry?${params}`, { method: 'GET', headers: authHeaders(token, req) });
}

export async function addToWishlist(token, req, input) {
  return request('/wishlist', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: authHeaders(token, req),
  });
}

export async function updateWishlistEntry(token, req, input) {
  return request('/wishlist', {
    method: 'PATCH',
    body: JSON.stringify(input),
    headers: authHeaders(token, req),
  });
}

export async function removeFromWishlist(token, req, input) {
  return request('/wishlist', {
    method: 'DELETE',
    body: JSON.stringify(input),
    headers: authHeaders(token, req),
  });
}

// ── Binder ────────────────────────────────────────────────────────────────────

export async function getMyBinders(token, req) {
  return request('/binder', { method: 'GET', headers: authHeaders(token, req) });
}

export async function browseBinders({ page, pageSize, userId, search } = {}) {
  const params = new URLSearchParams();
  if (page) params.set('page', page);
  if (pageSize) params.set('pageSize', pageSize);
  if (userId) params.set('userId', userId);
  if (search) params.set('search', search);
  return request(`/binder/browse?${params}`, { method: 'GET' });
}

export async function getBinder(idOrSlug, token, req) {
  return request(`/binder/${idOrSlug}`, { method: 'GET', headers: authHeaders(token, req) });
}

export async function createBinder(token, req, input) {
  return request('/binder', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: authHeaders(token, req),
  });
}

export async function updateBinder(token, req, id, input) {
  return request(`/binder/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
    headers: authHeaders(token, req),
  });
}

export async function deleteBinder(token, req, id, { permanent } = {}) {
  const params = permanent ? '?permanent=true' : '';
  return request(`/binder/${id}${params}`, {
    method: 'DELETE',
    headers: authHeaders(token, req),
  });
}

export async function saveBinderPagesAndSlots(token, req, id, pages) {
  return request(`/binder/${id}/pages`, {
    method: 'PUT',
    body: JSON.stringify({ pages }),
    headers: authHeaders(token, req),
  });
}

export async function addCardToBinder(token, req, pageId, input) {
  return request(`/binder/pages/${encodeURIComponent(pageId)}/slots`, {
    method: 'POST',
    body: JSON.stringify(input),
    headers: authHeaders(token, req),
  });
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function adminGetBinders(token, { limit = 200, offset = 0 } = {}) {
  return request(`/binder/admin?limit=${limit}&offset=${offset}`, {
    headers: authHeaders(token, null),
  });
}

export async function adminDeleteBinder(token, id, permanent = false) {
  const result = await request(`/binder/admin/${encodeURIComponent(id)}${permanent ? '?permanent=true' : ''}`, {
    method: 'DELETE',
    headers: authHeaders(token, null),
  });
  return result?.ok ?? true;
}

export async function adminGetCollectionSummary(token, { search, limit = 200 } = {}) {
  const p = new URLSearchParams({ limit: String(limit) });
  if (search) p.set('search', search);
  return request(`/collection/admin/summary?${p.toString()}`, {
    headers: authHeaders(token, null),
  });
}
