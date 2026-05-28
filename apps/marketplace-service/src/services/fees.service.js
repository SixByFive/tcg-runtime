import { createLogger } from '@sbf/logger';

const logger = createLogger('marketplace-service:fees');

// Free-tier default — matches payments-service seed data
const FREE_TIER_FEE_PCT = 7;

/**
 * Returns the platform fee percentage for a seller based on their subscription.
 * Calls payments-service /internal/capabilities/:userId.
 * Falls back to FREE_TIER_FEE_PCT if the service is unavailable.
 */
export async function getSellerFeePercent(sellerId) {
  if (!sellerId) return FREE_TIER_FEE_PCT;

  const paymentsUrl = process.env.PAYMENTS_SERVICE_URL || 'http://localhost:4019';
  const key         = process.env.INTERNAL_API_KEY;

  try {
    const res = await fetch(
      `${paymentsUrl}/internal/capabilities/${encodeURIComponent(sellerId)}`,
      { headers: key ? { 'x-internal-key': key } : {} },
    );
    if (!res.ok) return FREE_TIER_FEE_PCT;
    const data = await res.json();
    return Number(data.platformFeePercent) || FREE_TIER_FEE_PCT;
  } catch (err) {
    logger.warn(`getSellerFeePercent failed for ${sellerId}: ${err.message} — using default`);
    return FREE_TIER_FEE_PCT;
  }
}

/**
 * Calculate the platform fee in pence for a seller.
 * Uses their subscription tier rate (Free=8%, Collector=7%, Elite=6%, Vendor=5%).
 */
export async function calculateFeeForSeller(amountPence, sellerId) {
  const feePct = await getSellerFeePercent(sellerId);
  return Math.round(amountPence * feePct / 100);
}
