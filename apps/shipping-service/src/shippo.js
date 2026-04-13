/**
 * Shippo REST API wrapper.
 *
 * ENV VARS required:
 *   SHIPPO_API_KEY — starts with "shippo_live_" or "shippo_test_"
 *
 * Platform rules enforced here:
 *   - UK domestic only (country: GB)
 *   - 48hr tracked minimum (TRACKING in attributes AND estimatedDays >= 2)
 */

const BASE_URL = 'https://api.goshippo.com';

export const PARCEL_SIZE_WEIGHTS = {
  LARGE_LETTER: 500,   // max 750g  — single card, top loader, sleeve
  SMALL_PARCEL: 1000,  // max 2kg   — bulk cards, binder pages
  MEDIUM_PARCEL: 5000, // max 20kg  — full binders, large collections
};

function getHeaders() {
  const key = process.env.SHIPPO_API_KEY;
  if (!key) throw new Error('SHIPPO_API_KEY is not configured');
  return {
    'Content-Type': 'application/json',
    Authorization: `ShippoToken ${key}`,
  };
}

async function api(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...getHeaders(), ...(options.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shippo API error ${res.status}: ${text}`);
  }
  return res.json();
}

export function isEligibleRate(rate) {
  const attrs = Array.isArray(rate.attributes) ? rate.attributes : [];
  const days  = typeof rate.estimated_days === 'number' ? rate.estimated_days : 0;
  return attrs.includes('TRACKING') && days >= 2;
}

function mapRate(rate) {
  return {
    id:                rate.object_id,
    carrier:           rate.provider,
    service:           rate.servicelevel?.name || rate.servicelevel_token || '',
    amount:            parseFloat(rate.amount || 0),
    currency:          rate.currency || 'GBP',
    estimatedDays:     rate.estimated_days || null,
    trackingAvailable: true,
    qrAvailable:       Array.isArray(rate.attributes) && rate.attributes.includes('QR_SCAN'),
    attributes:        Array.isArray(rate.attributes) ? rate.attributes : [],
  };
}

export async function createShipment(to, from, parcel) {
  if (to.country && to.country.toUpperCase() !== 'GB') {
    throw new Error('Platform shipping is UK domestic only (country must be GB)');
  }

  const payload = {
    address_from: {
      name:    from.name    || '',
      street1: from.street1,
      street2: from.street2 || '',
      city:    from.city,
      state:   from.state   || '',
      zip:     from.zip,
      country: from.country || 'GB',
      phone:   from.phone   || '',
      email:   from.email   || '',
    },
    address_to: {
      name:    to.name    || '',
      street1: to.street1,
      street2: to.street2 || '',
      city:    to.city,
      state:   to.state   || '',
      zip:     to.zip,
      country: to.country || 'GB',
      phone:   to.phone   || '',
      email:   to.email   || '',
    },
    parcels: [{
      length:        String(parcel.length || 25),
      width:         String(parcel.width  || 18),
      height:        String(parcel.height || 2),
      distance_unit: 'cm',
      weight:        String(parcel.weight || 500),
      mass_unit:     'g',
    }],
    async: false,
  };

  const shipment = await api('/shipments', { method: 'POST', body: JSON.stringify(payload) });

  return {
    ...shipment,
    rates: (shipment.rates || []).filter(isEligibleRate).map(mapRate),
  };
}

export async function buyShipment(shipmentId, rateId) {
  // Re-fetch shipment to re-validate rate is still eligible (server-side guard)
  const shipment = await api(`/shipments/${shipmentId}`);
  const rate     = (shipment.rates || []).find(r => r.object_id === rateId);

  if (!rate) throw new Error('Rate not found on this shipment');
  if (!isEligibleRate(rate)) {
    throw new Error('Selected service does not meet platform requirements (48hr tracked minimum)');
  }

  const transaction = await api('/transactions', {
    method: 'POST',
    body: JSON.stringify({ rate: rateId, label_file_type: 'PDF_4X6', async: false }),
  });

  if (transaction.status === 'ERROR') {
    const msgs = (transaction.messages || []).map(m => m.text).join(', ');
    throw new Error(`Shippo label creation failed: ${msgs || 'unknown error'}`);
  }

  return {
    id:             transaction.object_id,
    trackingNumber: transaction.tracking_number,
    carrier:        rate.provider,
    service:        rate.servicelevel?.name || rate.servicelevel_token,
    labelUrl:       transaction.label_url,
    qrCodeUrl:      transaction.qr_code_url || null,
    status:         transaction.status,
    amount:         parseFloat(rate.amount || 0),
    currency:       rate.currency || 'GBP',
  };
}

export async function refundShipment(transactionId) {
  return api('/refunds', {
    method: 'POST',
    body: JSON.stringify({ transaction: transactionId }),
  });
}

export function parcelSizeToWeight(parcelSize) {
  return PARCEL_SIZE_WEIGHTS[parcelSize] ?? PARCEL_SIZE_WEIGHTS.SMALL_PARCEL;
}
