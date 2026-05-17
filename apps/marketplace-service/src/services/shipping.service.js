/**
 * Shipping provider not yet selected.
 *
 * EasyPost was removed (free tier too limited, expensive per-tracking).
 * Shippo was ruled out (US-based; UK carrier support costs $20/carrier/month).
 * A UK-native provider will be integrated here when chosen.
 *
 * Until then:
 * - Label generation returns 501 via the routes layer
 * - Tracking webhooks are a no-op
 * - Manual tracking number entry (POST /:id/ship with trackingNumber in body) still works
 */

export async function getRates() {
  throw new Error('Shipping provider not configured — label generation is a known gap');
}

export async function createLabel() {
  throw new Error('Shipping provider not configured — label generation is a known gap');
}

export function parseTrackingWebhook() {
  return null;
}
