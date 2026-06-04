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
    const err = new Error(data?.error || `marketplace-service ${response.status}`);
    err.status = response.status;
    err.data   = data;
    throw err;
  }
  return data;
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Listings ─────────────────────────────────────────────────────────────────

export async function getMyListings(token, { status, limit = 50, offset = 0 } = {}) {
  const p = new URLSearchParams({ pageSize: String(limit), page: String(Math.floor(offset / limit) + 1) });
  if (status) p.set('status', status);
  const data = await request(`/marketplace/listings/mine?${p.toString()}`, { headers: authHeaders(token) });
  return data?.listings ?? [];
}

export async function getListings({ cardId, sellerId, condition, variation, sort, status, minPrice, maxPrice, limit = 50, offset = 0 } = {}) {
  const p = new URLSearchParams({ pageSize: String(limit), page: String(Math.floor(offset / limit) + 1) });
  if (cardId)    p.set('cardId',    cardId);
  if (sellerId)  p.set('sellerId',  sellerId);
  if (condition) p.set('condition', condition);
  if (variation) p.set('variation', variation);
  if (sort)      p.set('sort',      sort);
  if (status)    p.set('status',    status);
  if (minPrice != null) p.set('minPrice', String(minPrice));
  if (maxPrice != null) p.set('maxPrice', String(maxPrice));
  const data = await request(`/marketplace/listings?${p.toString()}`);
  return data?.listings ?? [];
}

// ─── Marketplace rules agreement ──────────────────────────────────────────────

export async function getMarketplaceRules() {
  return request('/marketplace/listings/rules');
}

export async function hasAgreedToMarketplaceRules(token) {
  const data = await request('/marketplace/listings/agreed', { headers: authHeaders(token) });
  return data?.agreed ?? false;
}

export async function agreeToMarketplaceRules(token) {
  const data = await request('/marketplace/listings/agree', {
    method: 'POST',
    headers: authHeaders(token),
  });
  return data?.ok ?? false;
}

export async function submitListingProof(token, id, image) {
  return request(`/marketplace/listings/${encodeURIComponent(id)}/proof`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ image }),
  });
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

export async function submitListingProof(token, id, image) {
  return request(`/marketplace/listings/${encodeURIComponent(id)}/proof`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ image }),
  });
}

export async function updateListing(token, id, input) {
  return request(`/marketplace/listings/${encodeURIComponent(id)}`, {
    method: 'PATCH',
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
export async function buyListing(token, listingId, { buyerAddress, shippingRateId, shipmentId, walletAmountPence } = {}) {
  return request(`/marketplace/listings/${encodeURIComponent(listingId)}/buy`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ buyerAddress, shippingRateId, shipmentId, walletAmountPence }),
  });
}

export async function submitOrderTracking(token, id, { trackingNumber, trackingCarrier }) {
  return request(`/marketplace/orders/${encodeURIComponent(id)}/ship`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ trackingNumber, trackingCarrier }),
  });
}

export async function applyWalletToOrder(token, orderId, walletAmountPence) {
  return request(`/marketplace/orders/${encodeURIComponent(orderId)}/apply-wallet`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ walletAmountPence }),
  });
}

export async function shipOrder(token, id) {
  return request(`/marketplace/orders/${encodeURIComponent(id)}/ship`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
}

export async function getSellerAddress(token) {
  return request('/marketplace/seller/address', {
    headers: authHeaders(token),
  });
}

export async function updateSellerAddress(token, input) {
  return request('/marketplace/seller/address', {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export async function confirmOrderReceived(token, id) {
  return request(`/marketplace/orders/${encodeURIComponent(id)}/received`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
}

export async function raiseOrderDispute(token, id, reason) {
  return request(`/marketplace/orders/${encodeURIComponent(id)}/dispute`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ reason }),
  });
}

export async function cancelOrder(token, id, reason) {
  return request(`/marketplace/orders/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ reason: reason ?? null }),
  });
}

export async function leaveOrderFeedback(token, id, { rating, review }) {
  return request(`/marketplace/orders/${encodeURIComponent(id)}/feedback`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ rating, review }),
  });
}

export async function disputeOrderReview(token, id, reason) {
  return request(`/marketplace/orders/${encodeURIComponent(id)}/dispute-review`, {
    method:  'POST',
    headers: authHeaders(token),
    body:    JSON.stringify({ reason: reason ?? null }),
  });
}

export async function getAdminReviewQueue(token, { status, limit, offset } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (limit)  params.set('limit', String(limit));
  if (offset) params.set('offset', String(offset));
  return request(`/marketplace/admin/reviews?${params}`, { headers: authHeaders(token) });
}

export async function adminResolveReview(token, listingId, action) {
  return request(`/marketplace/admin/reviews/${encodeURIComponent(listingId)}/resolve`, {
    method:  'POST',
    headers: authHeaders(token),
    body:    JSON.stringify({ action }),
  });
}

export async function getSellerReputation(userId) {
  return request(`/marketplace/seller/${encodeURIComponent(userId)}/reputation`);
}

export async function getSellerReviews(userId, { limit = 20, offset = 0 } = {}) {
  return request(`/marketplace/seller/${encodeURIComponent(userId)}/reviews?limit=${limit}&offset=${offset}`);
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

export async function getMyIncomingOffers(token) {
  const data = await request('/marketplace/offers/incoming', { headers: authHeaders(token) });
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

export async function adminGetMarketplaceRevenue(token) {
  return request('/marketplace/admin/revenue-summary', { headers: authHeaders(token) });
}

export async function adminGetProofQueue(token) {
  return request('/marketplace/admin/listings/proof-queue', { headers: authHeaders(token) });
}

export async function adminApproveProof(token, id) {
  return request(`/marketplace/admin/listings/${encodeURIComponent(id)}/approve-proof`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
}

export async function adminRejectProof(token, id, reason) {
  return request(`/marketplace/admin/listings/${encodeURIComponent(id)}/reject-proof`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ reason }),
  });
}

export async function adminGetDisputes(token, status = 'open') {
  const p = new URLSearchParams({ status });
  return request(`/marketplace/admin/disputes?${p.toString()}`, { headers: authHeaders(token) });
}

export async function adminResolveDispute(token, id, { resolution, resolvedInFavourOf }) {
  return request(`/marketplace/admin/disputes/${encodeURIComponent(id)}/resolve`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ resolution, resolvedInFavourOf }),
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

// ─── Bulk listing ─────────────────────────────────────────────────────────────

export async function createBulkListings(token, listings) {
  return request('/marketplace/listings/batch', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ listings }),
  });
}

export async function submitBulkProof(token, batchId, image) {
  return request(`/marketplace/listings/batch/${encodeURIComponent(batchId)}/proof`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ image }),
  });
}
