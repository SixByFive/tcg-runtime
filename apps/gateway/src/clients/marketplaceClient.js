/**
 * Internal client for marketplace-service (port 4014).
 */
function getBaseUrl() {
  return process.env.MARKETPLACE_SERVICE_URL || 'http://localhost:4014';
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
    throw new Error(data?.error || `marketplace-service ${response.status}`);
  }
  return data;
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Listings ─────────────────────────────────────────────────────────────────

export async function getListings({ cardId, sellerId, condition, status, minPrice, maxPrice, limit = 50, offset = 0 } = {}) {
  const p = new URLSearchParams({ pageSize: String(limit), page: String(Math.floor(offset / limit) + 1) });
  if (cardId)    p.set('cardId',    cardId);
  if (sellerId)  p.set('sellerId',  sellerId);
  if (condition) p.set('condition', condition);
  if (status)    p.set('status',    status);
  if (minPrice != null) p.set('minPrice', String(minPrice));
  if (maxPrice != null) p.set('maxPrice', String(maxPrice));
  const data = await request(`/marketplace/listings?${p.toString()}`);
  return data?.listings ?? [];
}

export async function getListing(id) {
  return request(`/marketplace/listings/${encodeURIComponent(id)}`);
}

export async function createListing(token, input) {
  return request('/marketplace/listings', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export async function deleteListing(token, id) {
  await request(`/marketplace/listings/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return true;
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export async function getMyOrders(token, { role, paymentStatus, fulfilmentStatus, limit = 20, offset = 0 } = {}) {
  const p = new URLSearchParams({ pageSize: String(limit), page: String(Math.floor(offset / limit) + 1) });
  if (role)             p.set('role', role);
  if (paymentStatus)    p.set('paymentStatus', paymentStatus);
  if (fulfilmentStatus) p.set('fulfilmentStatus', fulfilmentStatus);
  const data = await request(`/marketplace/orders?${p.toString()}`, { headers: authHeaders(token) });
  return data?.orders ?? [];
}

export async function getOrder(token, id) {
  return request(`/marketplace/orders/${encodeURIComponent(id)}`, { headers: authHeaders(token) });
}

/**
 * POST /marketplace/listings/:id/buy — buy-it-now, creates an order and Stripe PaymentIntent.
 * Returns { orderId, clientSecret, totalAmount }.
 */
export async function buyListing(token, listingId, { buyerAddress, shippingRateId, shipmentId } = {}) {
  return request(`/marketplace/listings/${encodeURIComponent(listingId)}/buy`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ buyerAddress, shippingRateId, shipmentId }),
  });
}

// ─── Seller ───────────────────────────────────────────────────────────────────

export async function getSellerStatus(token) {
  return request('/marketplace/seller/status', { headers: authHeaders(token) });
}

export async function connectStripe(token) {
  return request('/marketplace/seller/connect', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
}

// ─── Offers ───────────────────────────────────────────────────────────────────

export async function getListingOffers(token, listingId) {
  const data = await request(`/marketplace/listings/${encodeURIComponent(listingId)}/offers`, {
    headers: authHeaders(token),
  });
  return Array.isArray(data) ? data : [];
}

export async function getMyOffers(token) {
  const data = await request('/marketplace/offers', { headers: authHeaders(token) });
  return Array.isArray(data) ? data : [];
}

export async function createOffer(token, listingId, { amount, message }) {
  return request(`/marketplace/listings/${encodeURIComponent(listingId)}/offers`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ amount, message }),
  });
}

export async function respondToOffer(token, offerId, { action, counterAmount, counterMessage, buyerAddress }) {
  return request(`/marketplace/offers/${encodeURIComponent(offerId)}/respond`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ action, counterAmount, counterMessage, buyerAddress }),
  });
}

export async function withdrawOffer(token, offerId) {
  await request(`/marketplace/offers/${encodeURIComponent(offerId)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return true;
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function adminGetListings(token, { status, sellerId, limit = 50, offset = 0 } = {}) {
  const p = new URLSearchParams({ pageSize: String(limit), page: String(Math.floor(offset / limit) + 1) });
  if (status)   p.set('status', status);
  if (sellerId) p.set('sellerId', sellerId);
  const data = await request(`/marketplace/admin/listings?${p.toString()}`, { headers: authHeaders(token) });
  return data?.listings ?? [];
}

export async function adminGetOrders(token, { paymentStatus, fulfilmentStatus, limit = 50, offset = 0 } = {}) {
  const p = new URLSearchParams({ pageSize: String(limit), page: String(Math.floor(offset / limit) + 1) });
  if (paymentStatus)    p.set('paymentStatus', paymentStatus);
  if (fulfilmentStatus) p.set('fulfilmentStatus', fulfilmentStatus);
  const data = await request(`/marketplace/admin/orders?${p.toString()}`, { headers: authHeaders(token) });
  return data?.orders ?? [];
}

export async function adminUpdateOrderFulfilmentStatus(token, orderId, status) {
  return request(`/marketplace/admin/orders/${encodeURIComponent(orderId)}/fulfilment-status`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ status }),
  });
}

export async function adminCreateProductListing(token, input) {
  return request('/marketplace/admin/product-listings', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export async function adminUpdateProductListing(token, id, input) {
  return request(`/marketplace/admin/product-listings/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}
