import EasyPostClient from '@easypost/api';
import { createLogger } from '@sbf/logger';

const logger = createLogger('marketplace-service:shipping');

// Weight in grams passed to EasyPost for each parcel size tier
const PARCEL_WEIGHTS = {
  LARGE_LETTER: 500,
  SMALL_PARCEL:  1000,
  MEDIUM_PARCEL: 5000,
};

// Dimensions in cm
const PARCEL_DIMENSIONS = {
  LARGE_LETTER: { length: 35.3, width: 25.0, height: 2.5 },
  SMALL_PARCEL:  { length: 45.0, width: 35.0, height: 16.0 },
  MEDIUM_PARCEL: { length: 61.0, width: 46.0, height: 46.0 },
};

let _client;
function getClient() {
  if (!_client) {
    if (!process.env.EASYPOST_API_KEY) throw new Error('EASYPOST_API_KEY is not set');
    _client = new EasyPostClient(process.env.EASYPOST_API_KEY);
  }
  return _client;
}

/**
 * Get eligible shipping rates for a parcel.
 *
 * Rules enforced:
 *   - UK domestic only (country: GB)
 *   - Tracked services only (TRACKING attribute)
 *   - Minimum 48hr delivery (deliveryDays >= 2)
 *
 * @param {object} opts
 * @param {object} opts.fromAddress   { name, street1, city, state, zip, country }
 * @param {object} opts.toAddress     { name, street1, city, state, zip }
 * @param {string} opts.parcelSize    LARGE_LETTER | SMALL_PARCEL | MEDIUM_PARCEL
 * @returns {{ shipmentId: string, rates: object[] }}
 */
export async function getRates({ fromAddress, toAddress, parcelSize }) {
  const ep = getClient();
  const weight = PARCEL_WEIGHTS[parcelSize] ?? PARCEL_WEIGHTS.LARGE_LETTER;
  const dims   = PARCEL_DIMENSIONS[parcelSize] ?? PARCEL_DIMENSIONS.LARGE_LETTER;

  const shipment = await ep.Shipment.create({
    from_address: { ...fromAddress, country: 'GB' },
    to_address:   { ...toAddress,   country: 'GB' },
    parcel: {
      weight: weight,        // grams
      length: dims.length,
      width:  dims.width,
      height: dims.height,
    },
  });

  const eligible = (shipment.rates || []).filter((rate) => {
    const attrs        = rate.attributes || [];
    const isTracked    = attrs.includes('TRACKING') ||
                         (rate.service || '').toLowerCase().includes('track');
    const deliveryDays = rate.delivery_days ?? 99;
    return isTracked && deliveryDays >= 2;
  });

  return { shipmentId: shipment.id, rates: eligible };
}

/**
 * Create a shipping label by buying a rate.
 *
 * @param {object} opts
 * @param {string} opts.shipmentId   from getRates()
 * @param {string} opts.rateId       selected rate ID
 * @param {string} opts.format       PNG (default) | PDF — PNG enables QR drop-off scan
 * @returns {{ trackingNumber, labelUrl, carrier, service, apiFee }}
 */
export async function createLabel({ shipmentId, rateId, format = 'PNG' }) {
  const ep = getClient();
  const shipment = await ep.Shipment.buy(shipmentId, rateId, undefined, {
    label_format: format,
  });

  return {
    trackingNumber: shipment.tracking_code,
    labelUrl:       shipment.postage_label?.label_url,
    carrier:        shipment.selected_rate?.carrier,
    service:        shipment.selected_rate?.service,
    apiFee:         Number(shipment.selected_rate?.rate ?? 0),
  };
}

/**
 * Handle an EasyPost tracking webhook event.
 * Returns the updated tracking status and tracking code.
 */
export function parseTrackingWebhook(body) {
  try {
    const { result } = body;
    if (!result) return null;
    return {
      trackingCode:   result.tracking_code,
      status:         result.status,          // pre_transit, in_transit, delivered, etc.
      estimatedDelivery: result.est_delivery_date,
    };
  } catch (err) {
    logger.error(`parseTrackingWebhook error: ${err.message}`);
    return null;
  }
}
