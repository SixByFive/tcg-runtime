/**
 * Internal client for shipping-service (port 4023).
 */
function getBaseUrl() {
  return process.env.SHIPPING_SERVICE_URL || 'http://localhost:4023';
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
    const err = new Error(data?.error || `shipping-service ${response.status}`);
    err.code = data?.error;
    throw err;
  }
  return data;
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getRates(token, { to, from, parcel, parcelSize }) {
  const data = await request('/shipping/rates', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ to, from, parcel, parcelSize }),
  });
  return data?.rates ?? [];
}

export async function getLabel(token, id) {
  return request(`/shipping/labels/${encodeURIComponent(id)}`, {
    headers: authHeaders(token),
  });
}

export async function createLabel(token, { to, from, parcel, parcelSize, shipmentId, rateId, relatedType, relatedId }) {
  return request('/shipping/labels', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ to, from, parcel, parcelSize, shipmentId, rateId, relatedType, relatedId }),
  });
}

export async function cancelLabel(token, id) {
  await request(`/shipping/labels/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return true;
}
