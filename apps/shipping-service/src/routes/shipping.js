import { Router } from 'express';
import { requireAuth } from '@sbf/auth';
import { ShippingLabel } from '../models/index.js';
import {
  getQuotes,
  bookLabel,
  fetchLabel,
  cancelOrder,
  getTrackingEvents,
  parcelSizeToDimensions,
} from '../parcel2go.js';

const router = Router();

// ─── POST /shipping/rates ─────────────────────────────────────────────────────
// Get quotes for a UK domestic shipment.
// No auth required — used by the listing flow before a buyer commits.

router.post('/rates', async (req, res) => {
  try {
    const { to, from, parcel, parcelSize } = req.body;
    if (!to || !from) {
      return res.status(400).json({ error: 'to and from addresses are required' });
    }

    // If caller passes a parcelSize key, use preset dimensions and merge with any
    // extra fields the caller provided (e.g. a declared value).
    const resolvedParcel = parcelSize
      ? { ...parcelSizeToDimensions(parcelSize), ...(parcel ?? {}) }
      : (parcel ?? {});

    const rates = await getQuotes(to, from, resolvedParcel);
    // P2G has no intermediate shipment object — shipmentId is null for all rates.
    res.json({ rates, shipmentId: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /shipping/labels/:id ─────────────────────────────────────────────────
// Retrieve a label record (owner only). Does NOT stream the PDF — use /pdf for that.

router.get('/labels/:id', requireAuth, async (req, res) => {
  try {
    const label = await ShippingLabel.findByPk(req.params.id);
    if (!label || label.userId !== req.user.sub) {
      return res.status(404).json({ error: 'Label not found' });
    }
    // Don't send the raw base64 blob in the JSON response — clients should use /pdf
    const { meta, ...rest } = label.toJSON();
    res.json({ ...rest, meta: { ...meta, labelBase64: undefined } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /shipping/labels/:id/pdf ─────────────────────────────────────────────
// Stream the label as a PDF. Falls back to re-fetching from P2G if the first
// booking call failed to retrieve the label.

router.get('/labels/:id/pdf', requireAuth, async (req, res) => {
  try {
    const label = await ShippingLabel.findByPk(req.params.id);
    if (!label || label.userId !== req.user.sub) {
      return res.status(404).json({ error: 'Label not found' });
    }

    let base64 = label.meta?.labelBase64 ?? null;

    // If we didn't get the label at booking time, try fetching it now
    if (!base64 && label.externalLabelId && label.meta?.hash) {
      base64 = await fetchLabel(label.externalLabelId, label.meta.hash);
      if (base64) {
        await label.update({ meta: { ...label.meta, labelBase64: base64 } });
      }
    }

    if (!base64) {
      return res.status(404).json({ error: 'Label PDF not yet available — try again shortly' });
    }

    const buffer = Buffer.from(base64, 'base64');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="label-${label.id}.pdf"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /shipping/labels ────────────────────────────────────────────────────
// Purchase a label.
//
// Body:
//   to, from       — full addresses (street, city, postcode, name, email, phone)
//   parcel         — { weight, length, width, height, value }
//   parcelSize     — optional preset key: LARGE_LETTER | SMALL_PARCEL | MEDIUM_PARCEL
//   rateId         — the Service.Slug from a /rates response (e.g. "P2G_EVRI_PARCELSHOP_STANDARD")
//   collectionDate — optional YYYY-MM-DD (defaults to today, which is fine for drop-off)
//   relatedType    — optional: 'Order' | 'Trade'
//   relatedId      — optional: UUID of the related record
//
// shipmentId is accepted for API compatibility but ignored (P2G has no shipment step).

router.post('/labels', requireAuth, async (req, res) => {
  const {
    to, from, parcel, parcelSize,
    rateId,          // this IS the serviceSlug for P2G
    collectionDate,
    relatedType, relatedId,
  } = req.body;

  if (!rateId) return res.status(400).json({ error: 'rateId (service slug) is required' });
  if (!to || !from) return res.status(400).json({ error: 'to and from addresses are required' });

  try {
    const resolvedParcel = parcelSize
      ? { ...parcelSizeToDimensions(parcelSize), ...(parcel ?? {}) }
      : (parcel ?? {});

    const booked = await bookLabel({
      serviceSlug:    rateId,
      to,
      from,
      parcel:         resolvedParcel,
      collectionDate: collectionDate ?? null,
    });

    // Derive the URL that serves the PDF from our own API
    const selfUrl = process.env.SHIPPING_SERVICE_PUBLIC_URL
      ?? process.env.SHIPPING_SERVICE_URL
      ?? 'http://localhost:4023';

    const label = await ShippingLabel.create({
      userId:          req.user.sub,
      externalLabelId: booked.orderId,
      trackingNumber:  booked.trackingNumber,
      carrier:         booked.carrier,
      service:         booked.service,
      amount:          booked.amount,
      currency:        booked.currency,
      labelUrl:        null,   // filled in below once we have the label ID
      qrCodeUrl:       booked.trackingUrl,   // P2G public tracking page
      status:          booked.status,
      refundStatus:    null,
      relatedType:     relatedType ?? null,
      relatedId:       relatedId   ?? null,
      meta: {
        orderId:      booked.orderId,
        orderLineId:  booked.orderLineId,
        hash:         booked.hash,
        trackingUrl:  booked.trackingUrl,
        labelBase64:  booked.labelBase64,
      },
    });

    // Now we have the DB ID, set the labelUrl to our PDF endpoint
    await label.update({
      labelUrl: `${selfUrl}/shipping/labels/${label.id}/pdf`,
    });
    await label.reload();

    // Return without the raw base64 blob
    const { meta, ...rest } = label.toJSON();
    res.status(201).json({ ...rest, meta: { ...meta, labelBase64: undefined } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /shipping/labels/:id ──────────────────────────────────────────────
// Request cancellation of a label. P2G cancel is best-effort (pre-collection only).

router.delete('/labels/:id', requireAuth, async (req, res) => {
  try {
    const label = await ShippingLabel.findByPk(req.params.id);
    if (!label || label.userId !== req.user.sub) {
      return res.status(404).json({ error: 'Label not found' });
    }
    if (label.refundStatus === 'requested') {
      return res.status(409).json({ error: 'Cancellation already requested' });
    }

    const orderId = label.meta?.orderId ?? label.externalLabelId;
    const hash    = label.meta?.hash ?? null;

    let cancelled = false;
    if (orderId && hash) {
      cancelled = await cancelOrder(orderId, hash);
    }

    await label.update({
      refundStatus: 'requested',
      refundedAt:   new Date(),
    });

    res.json({
      ok: true,
      cancelled,
      note: cancelled
        ? 'Order cancelled with Parcel2Go.'
        : 'Cancellation could not be confirmed via API — contact Parcel2Go support if the parcel has not been collected.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /shipping/labels/:id/tracking ───────────────────────────────────────
// Fetch live tracking events for a label. Accessible by the owner (seller).
// Updates the stored trackingStatus in the DB on each call.

router.get('/labels/:id/tracking', requireAuth, async (req, res) => {
  try {
    const label = await ShippingLabel.findByPk(req.params.id);
    if (!label || label.userId !== req.user.sub) {
      return res.status(404).json({ error: 'Label not found' });
    }

    const orderLineId = label.meta?.orderLineId ?? label.trackingNumber;
    if (!orderLineId) {
      return res.json({
        labelId:  label.id,
        status:   label.trackingStatus ?? 'booked',
        events:   [],
        note:     'No tracking reference available yet',
      });
    }

    const { events, status } = await getTrackingEvents(orderLineId);

    // Persist status change if it has moved on
    const updates = { lastTrackedAt: new Date() };
    if (status && status !== label.trackingStatus) {
      updates.trackingStatus = status;
      if (status === 'delivered' && !label.deliveredAt) {
        updates.deliveredAt = new Date();
      }
    }
    await label.update(updates);

    res.json({
      labelId:         label.id,
      trackingNumber:  label.trackingNumber,
      trackingUrl:     label.qrCodeUrl,
      status,
      events,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /shipping/prepay ─────────────────────────────────────────────────────
// Admin convenience — check the P2G PrePay account balance.

router.get('/prepay', requireAuth, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const { getPrePayBalance } = await import('../parcel2go.js');
    const balance = await getPrePayBalance();
    res.json(balance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
