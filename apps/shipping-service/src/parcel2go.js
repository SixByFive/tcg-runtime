/**
 * Parcel2Go REST API wrapper.
 *
 * Required env vars:
 *   P2G_CLIENT_ID     — from My Account → Settings → API
 *   P2G_CLIENT_SECRET — from My Account → Settings → API
 *   P2G_SANDBOX       — set to "true" to use sandbox.parcel2go.com
 *
 * Auth: OAuth 2.0 client_credentials. Token is cached in-process and
 * refreshed automatically before the 2-hour expiry.
 *
 * Booking flow:
 *   1. getQuotes(to, from, parcel) → array of rates (Service.Slug as id)
 *   2. bookLabel({ serviceSlug, to, from, parcel }) →
 *        a. POST /api/orders           (create order, get OrderId + Hash)
 *        b. POST /api/orders/:id/paywithprepay?hash=  (charge PrePay balance)
 *        c. GET  /api/labels/:id?hash= (fetch base64 PDF label)
 *
 * The PrePay account must have a sufficient balance at booking time.
 * Top up at: https://www.parcel2go.com/prepay
 *
 * Platform rules enforced here:
 *   - UK domestic only (country GBR)
 *   - CollectionType "Shop" (drop-off) or "Collection" (home pickup) both supported
 */

import { createLogger } from '@sbf/logger';

const logger = createLogger('shipping-service:parcel2go');

function getBaseUrl() {
  return process.env.P2G_SANDBOX === 'true'
    ? 'https://sandbox.parcel2go.com'
    : 'https://www.parcel2go.com';
}

// ─── Token cache ──────────────────────────────────────────────────────────────

let _tokenCache = null;

async function getToken() {
  // Reuse cached token if it has at least 5 minutes left
  if (_tokenCache && _tokenCache.expiresAt > Date.now() + 300_000) {
    return _tokenCache.token;
  }

  const clientId     = process.env.P2G_CLIENT_ID;
  const clientSecret = process.env.P2G_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('P2G_CLIENT_ID and P2G_CLIENT_SECRET must be set');
  }

  const res = await fetch(`${getBaseUrl()}/auth/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     clientId,
      client_secret: clientSecret,
      scope:         'public-api payment',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Parcel2Go auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  _tokenCache = {
    token:     data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  logger.info('Parcel2Go token refreshed');
  return _tokenCache.token;
}

// ─── Base fetch wrapper ───────────────────────────────────────────────────────

async function api(path, options = {}) {
  const token = await getToken();
  const url   = `${getBaseUrl()}/api${path}`;

  const res = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(45_000), // P2G recommends 45s timeout
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${token}`,
      ClientApp:      'SixByFiveTCG',
      AppVersion:     '1.0.0',
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 204) return null;

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Parcel2Go API error ${res.status} ${path}: ${text}`);
  }

  return res.json();
}

// ─── Parcel size presets ──────────────────────────────────────────────────────

/**
 * Maps our internal parcelSize keys to P2G dimensions.
 * Weight in kg, dimensions in cm.
 */
export const PARCEL_SIZE_DIMENSIONS = {
  LARGE_LETTER: { weight: 0.5, length: 35, width: 25, height: 2  },
  SMALL_PARCEL:  { weight: 1.0, length: 45, width: 35, height: 16 },
  MEDIUM_PARCEL: { weight: 5.0, length: 60, width: 46, height: 46 },
};

export function parcelSizeToDimensions(parcelSize) {
  return PARCEL_SIZE_DIMENSIONS[parcelSize] ?? PARCEL_SIZE_DIMENSIONS.SMALL_PARCEL;
}

/**
 * Convert our internal parcel object (grams + mm) to P2G's expected shape (kg + cm).
 * If parcel already has .weight in kg-range (< 50), assume it's already in kg.
 */
function normParcel(parcel) {
  const weight = parcel.weight > 50
    ? parcel.weight / 1000   // grams → kg
    : parcel.weight || 0.5;

  const length = parcel.length > 100
    ? parcel.length / 10     // mm → cm
    : parcel.length || 35;

  const width = parcel.width > 100
    ? parcel.width / 10
    : parcel.width || 25;

  const height = parcel.height > 50
    ? parcel.height / 10
    : parcel.height || 2;

  return { weight, length, width, height };
}

function normAddress(a) {
  return {
    postcode: a.zip ?? a.postcode ?? '',
    street1:  a.street1 ?? a.property ?? a.line1 ?? '',
    street2:  a.street2 ?? a.line2 ?? '',
    city:     a.city ?? a.town ?? '',
    county:   a.state ?? a.county ?? '',
    name:     a.name ?? '',
    email:    a.email ?? '',
    phone:    a.phone ?? '',
  };
}

// ─── Get quotes ───────────────────────────────────────────────────────────────

/**
 * Fetch shipping quotes for a UK domestic shipment.
 *
 * @param {object} to      Delivery address (must include postcode)
 * @param {object} from    Collection address (must include postcode)
 * @param {object} parcel  { weight (g or kg), length, width, height, value }
 * @returns {Array}        Rate objects compatible with the ShippingRate GraphQL type
 */
export async function getQuotes(to, from, parcel) {
  const p = normParcel(parcel);

  const data = await api('/quotes', {
    method: 'POST',
    body: JSON.stringify({
      CollectionAddress: {
        Country:  'GBR',
        Postcode: normAddress(from).postcode,
      },
      DeliveryAddress: {
        Country:  'GBR',
        Postcode: normAddress(to).postcode,
      },
      Parcels: [{
        Value:  parcel.value ?? 10,
        Weight: p.weight,
        Length: p.length,
        Width:  p.width,
        Height: p.height,
      }],
      Extras: [],
    }),
  });

  const quotes = data?.Quotes ?? [];

  if (data?.Errors?.length) {
    logger.warn(`P2G quote warnings: ${JSON.stringify(data.Errors)}`);
  }

  const now = Date.now();
  return quotes
    .filter(q => q.Service && q.TotalPrice)
    .map(q => {
      const deliveryDate = q.EstimatedDeliveryDate ? new Date(q.EstimatedDeliveryDate) : null;
      const estimatedDays = deliveryDate
        ? Math.max(1, Math.ceil((deliveryDate - now) / 86_400_000))
        : null;

      return {
        id:                q.Service.Slug,          // used as rateId / serviceSlug in booking
        shipmentId:        null,                    // P2G has no intermediate shipment step
        carrier:           q.Service.CourierName,
        service:           q.Service.Name,
        collectionType:    q.Service.CollectionType, // 'Shop' (drop-off) | 'Collection'
        amount:            q.TotalPrice,
        currency:          'GBP',
        estimatedDays,
        estimatedDate:     q.EstimatedDeliveryDate ?? null,
        cutOff:            q.CutOff ?? null,
        trackingAvailable: true,
        qrAvailable:       false,
      };
    });
}

// ─── Book label (create order → pay → fetch label) ───────────────────────────

/**
 * Books a shipment with Parcel2Go and returns the label as a base64 PDF.
 *
 * @param {object} opts
 * @param {string} opts.serviceSlug  The Service.Slug from a getQuotes() result
 * @param {object} opts.to           Full delivery address
 * @param {object} opts.from         Full collection address
 * @param {object} opts.parcel       Parcel dimensions/weight/value
 * @param {string} [opts.collectionDate]  YYYY-MM-DD (defaults to today — OK for drop-off)
 *
 * @returns {{
 *   orderId: string,
 *   orderLineId: number|null,
 *   hash: string,
 *   trackingNumber: string|null,
 *   trackingUrl: string|null,
 *   carrier: string|null,
 *   service: string,
 *   labelBase64: string|null,
 *   amount: number,
 *   currency: string,
 *   status: string,
 * }}
 */
export async function bookLabel({ serviceSlug, to, from, parcel, collectionDate }) {
  const p    = normParcel(parcel);
  const toA  = normAddress(to);
  const frA  = normAddress(from);
  const date = collectionDate ?? new Date().toISOString().slice(0, 10);
  const itemId = crypto.randomUUID();

  // ── Step 1: Create order ──────────────────────────────────────────────────
  const orderRes = await api('/orders', {
    method: 'POST',
    body: JSON.stringify({
      Items: [{
        Id:             itemId,
        Service:        serviceSlug,
        CollectionDate: date,
        Upsells:        [],
        CollectionAddress: {
          CountryIsoCode: 'GBR',
          Property:    frA.street1,
          Street:      frA.street2 || frA.street1,
          Town:        frA.city,
          County:      frA.county,
          Postcode:    frA.postcode,
          ContactName: frA.name,
          Email:       frA.email,
          Phone:       frA.phone,
          ShopId:      null,
        },
        Parcels: [{
          Id:              '00000000-0000-0000-0000-000000000000',
          EstimatedValue:  parcel.value ?? 10,
          Weight:          p.weight,
          Length:          p.length,
          Width:           p.width,
          Height:          p.height,
          ContentsSummary: 'Trading cards',
          DeliveryAddress: {
            CountryIsoCode: 'GBR',
            Property:    toA.street1,
            Street:      toA.street2 || toA.street1,
            Town:        toA.city,
            County:      toA.county,
            Postcode:    toA.postcode,
            ContactName: toA.name,
            Email:       toA.email,
            Phone:       toA.phone,
            SpecialInstructions: '',
          },
        }],
      }],
      CustomerDetails: {
        Email:    frA.email,
        Forename: frA.name.split(' ')[0] || '',
        Surname:  frA.name.split(' ').slice(1).join(' ') || '',
        OptInToEmails: false,
        OptInToPhone:  false,
        OptInToPost:   false,
        OptInToOther:  false,
      },
    }),
  });

  const { OrderId, Hash, TotalPrice, OrderlineIdMap } = orderRes;
  const orderLineId = OrderlineIdMap?.[0]?.OrderLineId ?? null;

  logger.info(`P2G order created: OrderId=${OrderId} OrderLineId=${orderLineId}`);

  // ── Step 2: Pay with PrePay ───────────────────────────────────────────────
  await api(`/orders/${OrderId}/paywithprepay?hash=${encodeURIComponent(Hash)}`, {
    method: 'POST',
  });

  logger.info(`P2G order paid: OrderId=${OrderId}`);

  // ── Step 3: Fetch label (base64 PDF) ─────────────────────────────────────
  let labelBase64 = null;
  try {
    const labelRes = await api(
      `/labels/${OrderId}?hash=${encodeURIComponent(Hash)}&referenceType=OrderId&detailLevel=All&labelMedia=A6&labelFormat=PDF`,
    );
    labelBase64 = labelRes?.Base64EncodedLabels?.[0] ?? null;
  } catch (err) {
    // Label may take a moment — caller can retry via GET /shipping/labels/:id/pdf
    logger.warn(`P2G label fetch failed for OrderId=${OrderId}: ${err.message}`);
  }

  return {
    orderId:        String(OrderId),
    orderLineId,
    hash:           Hash,
    trackingNumber: orderLineId ? String(orderLineId) : null,
    trackingUrl:    orderLineId ? `https://www.parcel2go.com/tracking/${orderLineId}` : null,
    carrier:        null,   // carrier tracking number arrives after first carrier scan
    service:        serviceSlug,
    labelBase64,
    amount:         TotalPrice,
    currency:       'GBP',
    status:         'SUCCESS',
  };
}

// ─── Re-fetch label (retry if first attempt failed) ──────────────────────────

export async function fetchLabel(orderId, hash) {
  const res = await api(
    `/labels/${orderId}?hash=${encodeURIComponent(hash)}&referenceType=OrderId&detailLevel=All&labelMedia=A6&labelFormat=PDF`,
  );
  return res?.Base64EncodedLabels?.[0] ?? null;
}

// ─── Cancel order ─────────────────────────────────────────────────────────────

/**
 * Attempt to cancel an order. The P2G cancel endpoint is not fully documented;
 * this makes a best-effort DELETE call and returns true on success, false on failure.
 * Pre-collection only — orders that have been collected cannot be cancelled via API.
 */
export async function cancelOrder(orderId, hash) {
  try {
    await api(`/orders/${orderId}?hash=${encodeURIComponent(hash)}`, {
      method: 'DELETE',
    });
    logger.info(`P2G order cancelled: ${orderId}`);
    return true;
  } catch (err) {
    logger.warn(`P2G cancel failed for ${orderId}: ${err.message}`);
    return false;
  }
}

// ─── Check PrePay balance ─────────────────────────────────────────────────────

export async function getPrePayBalance() {
  return api('/prepay');
}

// ─── Tracking ─────────────────────────────────────────────────────────────────

/**
 * Normalise a free-text P2G/carrier event description into a platform status.
 * Returns null for events that don't map to a meaningful state change.
 *
 * Statuses (ordered from earliest to latest in a shipment lifecycle):
 *   booked → collected → in_transit → out_for_delivery → delivered
 *                                   ↘ failed_delivery
 *                                   ↘ returned
 */
export function normaliseTrackingStatus(description) {
  const d = (description ?? '').toLowerCase();

  // Delivery attempts / problems first (before generic "delivery" match)
  if (
    d.includes('failed') || d.includes('missed') || d.includes('unable to deliver') ||
    d.includes('no answer') || d.includes('attempted') || d.includes('not delivered') ||
    d.includes('could not deliver')
  ) return 'failed_delivery';

  if (d.includes('returned') || d.includes('return to sender') || d.includes(' rts'))
    return 'returned';

  // Successful delivery
  if (d.includes('delivered') || d.includes('delivery successful') || d.includes('signed for'))
    return 'delivered';

  // Out for delivery
  if (
    d.includes('out for delivery') || d.includes('with courier') ||
    d.includes('on vehicle') || d.includes('driver') || d.includes('on its way to you')
  ) return 'out_for_delivery';

  // Collected by carrier
  if (
    d.includes('collected') || d.includes('picked up') ||
    d.includes('collection') || d.includes('accepted by carrier')
  ) return 'collected';

  // General in-transit
  if (
    d.includes('transit') || d.includes('depot') || d.includes('hub') ||
    d.includes('processing') || d.includes('sorting') || d.includes('arrived at') ||
    d.includes('departed') || d.includes('received')
  ) return 'in_transit';

  return null; // unrecognised — don't change overall status
}

/**
 * Fetch tracking events for a shipment and return a normalised summary.
 *
 * @param {number|string} orderLineId  The OrderLineId from the P2G order response
 * @returns {{ events: Array, status: string }}
 */
export async function getTrackingEvents(orderLineId) {
  const data   = await api(`/tracking/${orderLineId}`);
  const raw    = data?.Results ?? [];

  const events = raw.map(e => ({
    description: e.Description ?? '',
    dateTime:    e.DateTime ?? null,
    status:      normaliseTrackingStatus(e.Description),
  }));

  // Walk events newest-first to find the most meaningful status
  const overallStatus = [...events]
    .reverse()
    .find(e => e.status !== null)
    ?.status ?? 'booked';

  return { events, status: overallStatus };
}
