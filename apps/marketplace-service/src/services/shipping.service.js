/**
 * Thin proxy to shipping-service for getting rates inside the marketplace flow.
 *
 * Marketplace uses this so the listing route can offer dynamic shipping quotes
 * without the browser calling shipping-service directly.
 *
 * All actual Parcel2Go logic lives in shipping-service/src/parcel2go.js.
 */

const SHIPPING_URL = process.env.SHIPPING_SERVICE_URL || 'http://localhost:4023';
const INTERNAL_KEY = process.env.INTERNAL_API_KEY;

async function shippingRequest(path, options = {}) {
  const res = await fetch(`${SHIPPING_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(INTERNAL_KEY ? { 'x-internal-key': INTERNAL_KEY } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`shipping-service error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function getRates({ fromAddress, toAddress, parcelSize, parcel }) {
  const data = await shippingRequest('/shipping/rates', {
    method: 'POST',
    body: JSON.stringify({ from: fromAddress, to: toAddress, parcelSize, parcel }),
  });
  return data?.rates ?? [];
}
