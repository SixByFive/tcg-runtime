/**
 * Tracking Refresh
 *
 * Calls shipping-service to poll all active shipments for tracking
 * updates and fire push notifications on status changes.
 *
 * Schedule: every 2 hours
 */
import { getServiceUrl } from '@sbf/config';
import { createLogger } from '@sbf/logger';

const logger = createLogger('worker:tracking-refresh');

const SHIPPING_URL  = getServiceUrl('SHIPPING_SERVICE_URL', 4023);
const INTERNAL_KEY  = process.env.INTERNAL_API_KEY;

export async function runTrackingRefreshJob() {
  logger.info('Running tracking refresh…');

  const res = await fetch(`${SHIPPING_URL}/internal/shipping/refresh-tracking`, {
    method:  'POST',
    headers: {
      'Content-Type':   'application/json',
      'x-internal-key': INTERNAL_KEY ?? '',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`shipping-service refresh-tracking failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  logger.info(`Tracking refresh: checked=${data.checked} changed=${data.changed} labels=${data.labels}`);
  if (data.errors?.length) {
    logger.warn(`Tracking refresh errors: ${JSON.stringify(data.errors)}`);
  }
}
