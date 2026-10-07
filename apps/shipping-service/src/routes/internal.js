/**
 * Internal endpoints for shipping-service.
 *
 * All routes require the x-internal-key header matching INTERNAL_API_KEY.
 * These are NOT exposed publicly — called only by cron jobs or other services.
 *
 * Cron: refresh tracking
 *   POST /internal/shipping/refresh-tracking
 *   Recommended schedule: every 2 hours
 *   0 *\/2 * * * curl -s -X POST .../internal/shipping/refresh-tracking -H "x-internal-key: $INTERNAL_API_KEY"
 */

import { Router }                                from 'express';
import { createLogger }                          from '@sbf/logger';
import { ShippingLabel }                         from '../models/index.js';
import { getTrackingEvents, getQuotes, bookLabel, parcelSizeToDimensions } from '../parcel2go.js';
import { Op }                                    from 'sequelize';
import { getServiceUrl }                         from '@sbf/config';

const router = Router();
const logger = createLogger('shipping-service:internal');

// ─── Internal auth ────────────────────────────────────────────────────────────

const INTERNAL_KEY = process.env.INTERNAL_API_KEY;

router.use((req, res, next) => {
  if (!INTERNAL_KEY || req.headers['x-internal-key'] !== INTERNAL_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// ─── POST /internal/shipping/refresh-tracking ─────────────────────────────────
//
// Polls all "active" labels (not yet delivered/returned/cancelled) for new
// tracking events. Persists any status change and sends a push notification to
// the label owner (seller) and, when the label is linked to a marketplace order
// or trade, also to the related buyer/trader via their notification service.
//
// Returns a summary of how many labels were refreshed and how many changed.

const TERMINAL_STATUSES = new Set(['delivered', 'returned', 'failed_delivery']);
const NOTIFICATIONS_URL  = getServiceUrl('NOTIFICATIONS_SERVICE_URL', 4016);
const INTERNAL_HEADERS   = () => ({
  'Content-Type': 'application/json',
  ...(INTERNAL_KEY ? { 'x-internal-key': INTERNAL_KEY } : {}),
});

async function sendNotification(userId, { title, body, data = {} }) {
  try {
    await fetch(`${NOTIFICATIONS_URL}/internal/notifications`, {
      method:  'POST',
      headers: INTERNAL_HEADERS(),
      body:    JSON.stringify({ userId, title, body, data }),
    });
  } catch (err) {
    logger.warn(`notify failed for userId=${userId}: ${err.message}`);
  }
}

/**
 * Pick which quoted service to book. Business rule: all marketplace shipments
 * use Royal Mail Tracked 48 (drop-off at a Post Office) where available.
 *
 * Royal Mail Tracked 48 is sold as separate P2G products per parcel size.
 * Confirmed slugs for our production account (via GET /api/quotes):
 *
 *   LARGE_LETTER  → royalmail-largeletter-48       (drop-off; £2.90 London→Manchester)
 *   SMALL_PARCEL  → royalmail-int_2606             (drop-off; £3.75)
 *   MEDIUM_PARCEL → royalmail-int_2606_2616        (drop-off; £5.70)
 *
 * Collection variants exist (+£0.50) but default is drop-off — sellers save
 * on each shipment and we don't need to coordinate carrier pickups.
 *
 * Priority:
 *   1. Royal Mail Tracked 48 slug matching the parcel size (production)
 *   2. Any carrier's 48-hour service (dev/sandbox fallback — P2G sandbox has no Royal Mail)
 *   3. Cheapest overall (last resort)
 *
 * Overridable per-call via SHIPPING_PREFERRED_SLUG env var (exact Service.Slug match).
 */
const ROYAL_MAIL_SLUGS_BY_PARCEL_SIZE = {
  LARGE_LETTER:  'royalmail-largeletter-48',
  SMALL_PARCEL:  'royalmail-int_2606',
  MEDIUM_PARCEL: 'royalmail-int_2606_2616',
};

function pickPreferredService(quotes, parcelSize) {
  const override = process.env.SHIPPING_PREFERRED_SLUG;
  if (override) {
    const match = quotes.find((q) => q.id === override);
    if (match) return match;
    logger.warn(`SHIPPING_PREFERRED_SLUG="${override}" not quoted; falling back`);
  }

  // 1. Royal Mail Tracked 48 — exact slug for this parcel size
  const rmSlug = ROYAL_MAIL_SLUGS_BY_PARCEL_SIZE[parcelSize];
  if (rmSlug) {
    const m = quotes.find((q) => q.id === rmSlug);
    if (m) return m;
  }

  // 2. Any 48-hour service (sandbox / fallback) — cheapest wins
  const any48 = quotes.filter((q) => /48/.test(q.service || ''));
  if (any48.length) {
    return any48.reduce((best, q) => (q.amount < best.amount ? q : best));
  }

  // 3. Cheapest tracked (all P2G services are tracked)
  return quotes.reduce((best, q) => (q.amount < best.amount ? q : best), quotes[0]);
}

/**
 * Human-friendly message for each status transition.
 */
function statusMessage(status, service) {
  const svc = service ? ` (${service})` : '';
  switch (status) {
    case 'collected':         return { title: 'Parcel collected',         body: `Your parcel${svc} has been collected by the carrier.` };
    case 'in_transit':        return { title: 'Parcel in transit',        body: `Your parcel${svc} is on its way.` };
    case 'out_for_delivery':  return { title: 'Out for delivery',         body: `Your parcel${svc} is out for delivery today.` };
    case 'delivered':         return { title: 'Parcel delivered! 📦',     body: `Your parcel${svc} has been delivered.` };
    case 'failed_delivery':   return { title: 'Delivery attempt failed',  body: `A delivery attempt for your parcel${svc} was unsuccessful. Check your tracking for next steps.` };
    case 'returned':          return { title: 'Parcel returned',          body: `Your parcel${svc} is being returned to the sender.` };
    default:                  return null;
  }
}

/**
 * Look up the buyer/counterparty userId for a label linked to an Order or Trade.
 * Best-effort — returns null on any error.
 */
async function getBuyerUserId(label) {
  if (!label.relatedType || !label.relatedId) return null;

  const serviceUrl = label.relatedType === 'Order'
    ? getServiceUrl('MARKETPLACE_SERVICE_URL', 4014)
    : getServiceUrl('TRADING_SERVICE_URL',     4015);

  const path = label.relatedType === 'Order'
    ? `/internal/marketplace/orders/${label.relatedId}/buyer`
    : `/internal/trading/trades/${label.relatedId}/counterparty`;

  try {
    const res = await fetch(`${serviceUrl}${path}`, { headers: INTERNAL_HEADERS() });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.userId ?? data?.buyerId ?? null;
  } catch {
    return null;
  }
}

// ─── POST /internal/shipping/quote ───────────────────────────────────────────
//
// Returns the cheapest P2G quote for a route. Called at checkout when
// labelPaidBy === 'buyer' so the label cost is included in the order total.
//
// Body: { to: { postcode }, from: { postcode }, parcelSize, declaredValue }
// Returns: { amount, carrier, service }

router.post('/quote', async (req, res) => {
  const { to, from, parcelSize, declaredValue } = req.body;

  if (!to?.postcode || !from?.postcode || !parcelSize) {
    return res.status(400).json({ error: 'to.postcode, from.postcode and parcelSize are required' });
  }

  const dims   = parcelSizeToDimensions(parcelSize);
  const parcel = { ...dims, value: declaredValue ?? 10 };

  try {
    const quotes = await getQuotes(to, from, parcel);
    if (!quotes.length) {
      return res.status(422).json({ error: 'No shipping quotes available for this route' });
    }
    const cheapest = quotes.reduce((best, q) => (q.amount < best.amount ? q : best), quotes[0]);
    res.json({ amount: cheapest.amount, carrier: cheapest.carrier, service: cheapest.service });
  } catch (err) {
    logger.error(`quote failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /internal/shipping/book-for-order ───────────────────────────────────
//
// Books a tracked P2G label for a marketplace order.
// Always picks the cheapest tracked service.
//
// Body: {
//   orderId,   sellerId,
//   from: { name, line1, line2, city, postcode, country, phone, email },
//   to:   { name, line1, line2, city, postcode, country, phone, email },
//   parcelSize,      // 'LARGE_LETTER' | 'SMALL_PARCEL' | 'MEDIUM_PARCEL'
//   declaredValue,   // GBP float
// }
//
// Returns: { labelId, trackingNumber, trackingUrl, carrier, service, labelUrl, labelBase64, amount }

router.post('/book-for-order', async (req, res) => {
  const { orderId, sellerId, from, to, parcelSize, declaredValue } = req.body;

  if (!orderId || !sellerId || !from || !to || !parcelSize) {
    return res.status(400).json({ error: 'orderId, sellerId, from, to, parcelSize are required' });
  }

  if (!from.postcode || !to.postcode) {
    return res.status(400).json({ error: 'from.postcode and to.postcode are required' });
  }

  const dims = parcelSizeToDimensions(parcelSize);
  const parcel = { ...dims, value: declaredValue ?? 10 };

  try {
    // Get quotes and pick the preferred tracked service.
    // Priority (business rule — all marketplace shipments use RM 48 tracked):
    //   1. Royal Mail Tracked 48 (production only — sandbox has no Royal Mail)
    //   2. Any carrier's "48" tracked service (sandbox fallback, dev testing)
    //   3. Cheapest overall tracked service (last resort)
    const quotes = await getQuotes(to, from, parcel);
    if (!quotes.length) {
      return res.status(422).json({ error: 'No shipping services available for this route' });
    }

    const picked = pickPreferredService(quotes, parcelSize);
    logger.info(`book-for-order: order=${orderId} parcel=${parcelSize} service=${picked.id} carrier=${picked.carrier} amount=${picked.amount}`);

    const result = await bookLabel({
      serviceSlug: picked.id,
      to,
      from,
      parcel,
    });

    // Store ShippingLabel record
    const label = await ShippingLabel.create({
      userId:         sellerId,
      externalLabelId: result.orderId,
      trackingNumber:  result.trackingNumber,
      carrier:         result.carrier ?? cheapest.carrier,
      service:         cheapest.service ?? result.service,
      amount:          result.amount,
      currency:        'GBP',
      labelUrl:        result.trackingUrl,
      qrCodeUrl:       result.trackingUrl,
      relatedType:     'Order',
      relatedId:       orderId,
      trackingStatus:  'booked',
      meta: {
        orderLineId: result.orderLineId,
        p2gOrderId:  result.orderId,
        p2gHash:     result.hash,
      },
    });

    res.json({
      labelId:        label.id,
      trackingNumber: result.trackingNumber,
      trackingUrl:    result.trackingUrl,
      carrier:        result.carrier ?? cheapest.carrier,
      service:        cheapest.service,
      labelUrl:       result.trackingUrl,
      labelBase64:    result.labelBase64,
      amount:         result.amount,
    });
  } catch (err) {
    logger.error(`book-for-order failed for order=${orderId}: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /internal/shipping/book-for-trade ───────────────────────────────────
//
// Books a tracked P2G label for one leg of a trade (each party ships their own cards).
//
// Body: {
//   tradeId, userId,
//   from: { name, line1, line2, city, postcode, country, phone, email },
//   to:   { name, line1, line2, city, postcode, country, phone, email },
//   parcelSize,    // 'LARGE_LETTER' | 'SMALL_PARCEL' | 'MEDIUM_PARCEL'
//   declaredValue, // GBP float
// }
//
// Returns: { labelId, trackingNumber, trackingUrl, carrier, service, labelUrl, labelBase64, amount }

router.post('/book-for-trade', async (req, res) => {
  const { tradeId, userId, from, to, parcelSize, declaredValue } = req.body;

  if (!tradeId || !userId || !from || !to || !parcelSize) {
    return res.status(400).json({ error: 'tradeId, userId, from, to, parcelSize are required' });
  }
  if (!from.postcode || !to.postcode) {
    return res.status(400).json({ error: 'from.postcode and to.postcode are required' });
  }

  const dims   = parcelSizeToDimensions(parcelSize);
  const parcel = { ...dims, value: declaredValue ?? 10 };

  try {
    const quotes = await getQuotes(to, from, parcel);
    if (!quotes.length) {
      return res.status(422).json({ error: 'No shipping services available for this route' });
    }

    const picked = pickPreferredService(quotes, parcelSize);
    logger.info(`book-for-trade: trade=${tradeId} parcel=${parcelSize} service=${picked.id} carrier=${picked.carrier} amount=${picked.amount}`);

    const result = await bookLabel({ serviceSlug: picked.id, to, from, parcel });

    const label = await ShippingLabel.create({
      userId,
      externalLabelId: result.orderId,
      trackingNumber:  result.trackingNumber,
      carrier:         result.carrier ?? cheapest.carrier,
      service:         cheapest.service ?? result.service,
      amount:          result.amount,
      currency:        'GBP',
      labelUrl:        result.trackingUrl,
      qrCodeUrl:       result.trackingUrl,
      relatedType:     'Trade',
      relatedId:       tradeId,
      trackingStatus:  'booked',
      meta: {
        orderLineId: result.orderLineId,
        p2gOrderId:  result.orderId,
        p2gHash:     result.hash,
      },
    });

    res.json({
      labelId:        label.id,
      trackingNumber: result.trackingNumber,
      trackingUrl:    result.trackingUrl,
      carrier:        result.carrier ?? cheapest.carrier,
      service:        cheapest.service,
      labelUrl:       result.trackingUrl,
      labelBase64:    result.labelBase64,
      amount:         result.amount,
    });
  } catch (err) {
    logger.error(`book-for-trade failed for trade=${tradeId}: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /internal/shipping/order/:orderId/tracking ──────────────────────────
// Returns tracking for the shipping label linked to a marketplace order.
// Called by the gateway after it has already verified the requesting user
// is the buyer or seller on that order — no further auth needed here.

router.get('/order/:orderId/tracking', async (req, res) => {
  try {
    const label = await ShippingLabel.findOne({
      where: { relatedType: 'Order', relatedId: req.params.orderId },
    });

    if (!label) {
      return res.status(404).json({ error: 'No shipping label found for this order' });
    }

    const orderLineId = label.meta?.orderLineId ?? label.trackingNumber;
    if (!orderLineId) {
      return res.json({
        labelId: label.id,
        status:  label.trackingStatus ?? 'booked',
        events:  [],
        note:    'No tracking reference available yet',
      });
    }

    const { events, status } = await getTrackingEvents(orderLineId);

    // Persist status updates
    const updates = { lastTrackedAt: new Date() };
    if (status && status !== label.trackingStatus) {
      updates.trackingStatus = status;
      if (status === 'delivered' && !label.deliveredAt) updates.deliveredAt = new Date();
    }
    await label.update(updates);

    res.json({
      labelId:        label.id,
      trackingNumber: label.trackingNumber,
      trackingUrl:    label.qrCodeUrl,
      status,
      events,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /internal/shipping/refresh-tracking ─────────────────────────────────
//
// Polls all "active" labels (not yet delivered/returned/cancelled) for new
// tracking events. Persists any status change and sends a push notification to
// the label owner (seller) and, when the label is linked to a marketplace order
// or trade, also to the related buyer/trader via their notification service.
//
// Returns a summary of how many labels were refreshed and how many changed.

router.post('/refresh-tracking', async (req, res) => {
  const startedAt = Date.now();

  // Find all labels that haven't reached a terminal state and have a tracking ref
  const labels = await ShippingLabel.findAll({
    where: {
      trackingStatus: { [Op.notIn]: [...TERMINAL_STATUSES] },
      trackingNumber: { [Op.not]: null },
    },
  });

  logger.info(`refresh-tracking: checking ${labels.length} active label(s)`);

  let checked  = 0;
  let changed  = 0;
  const errors = [];

  for (const label of labels) {
    const orderLineId = label.meta?.orderLineId ?? label.trackingNumber;
    if (!orderLineId) continue;

    try {
      const { events, status } = await getTrackingEvents(orderLineId);
      checked++;

      const prevStatus = label.trackingStatus ?? 'booked';
      const updates    = { lastTrackedAt: new Date() };

      if (status && status !== prevStatus) {
        updates.trackingStatus = status;
        if (status === 'delivered' && !label.deliveredAt) {
          updates.deliveredAt = new Date();
        }
        changed++;

        logger.info(`label ${label.id}: ${prevStatus} → ${status}`);

        // Notify the label owner (seller / sender)
        const msg = statusMessage(status, label.service);
        if (msg) {
          // Seller notification (always)
          await sendNotification(label.userId, {
            ...msg,
            data: { labelId: label.id, trackingStatus: status, type: 'tracking_update' },
          });

          // Buyer/counterparty notification for delivery/out-for-delivery events
          if (['out_for_delivery', 'delivered', 'failed_delivery'].includes(status)) {
            const buyerMsg = buyerStatusMessage(status, label.service);
            if (buyerMsg) {
              const buyerUserId = await getBuyerUserId(label);
              if (buyerUserId) {
                await sendNotification(buyerUserId, {
                  ...buyerMsg,
                  data: { labelId: label.id, trackingStatus: status, type: 'tracking_update' },
                });
              }
            }
          }
        }
      }

      await label.update(updates);
    } catch (err) {
      logger.warn(`refresh-tracking: label ${label.id} failed — ${err.message}`);
      errors.push({ labelId: label.id, error: err.message });
    }
  }

  res.json({
    ok:          true,
    labels:      labels.length,
    checked,
    changed,
    errors:      errors.length ? errors : undefined,
    durationMs:  Date.now() - startedAt,
  });
});

// Buyer-facing copy of status messages (reworded for the recipient side)
function buyerStatusMessage(status, service) {
  const svc = service ? ` (${service})` : '';
  switch (status) {
    case 'out_for_delivery': return { title: 'Your order is out for delivery', body: `Your order${svc} should arrive today.` };
    case 'delivered':        return { title: 'Your order has arrived! 📦',    body: `Your order${svc} has been delivered.` };
    case 'failed_delivery':  return { title: 'Delivery attempt failed',       body: `A delivery attempt for your order${svc} was unsuccessful. Check your tracking for next steps.` };
    default:                 return null;
  }
}

export default router;
