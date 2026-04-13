import { Router } from 'express';
import { requireAuth } from '@sbf/auth';
import { ShippingLabel } from '../models/index.js';
import {
  createShipment,
  buyShipment,
  refundShipment,
  parcelSizeToWeight,
} from '../shippo.js';

const router = Router();
router.use(requireAuth);

const SHIPPO_FEE = 0.05; // £0.05 per label, passed through to buyer

// POST /shipping/rates — get eligible rates for a shipment
router.post('/rates', async (req, res) => {
  try {
    const { to, from, parcel, parcelSize } = req.body;
    if (!to || !from || !parcel) {
      return res.status(400).json({ error: 'to, from, and parcel are required' });
    }

    const resolvedParcel = parcelSize
      ? { ...parcel, weight: parcelSizeToWeight(parcelSize) }
      : parcel;

    const shipment = await createShipment(to, from, resolvedParcel);
    const shipmentId = shipment.object_id;
    // Embed shipmentId on each rate so the client can pass it back to createLabel,
    // avoiding a redundant second Shippo shipment creation.
    const rates = (shipment.rates || []).map(r => ({ ...r, shipmentId }));
    res.json({ rates, shipmentId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /shipping/labels/:id — retrieve a label (owner only)
router.get('/labels/:id', async (req, res) => {
  try {
    const label = await ShippingLabel.findByPk(req.params.id);
    if (!label || label.userId !== req.user.sub) {
      return res.status(404).json({ error: 'Label not found' });
    }
    res.json(label);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /shipping/labels — purchase a label
router.post('/labels', async (req, res) => {
  const { to, from, parcel, parcelSize, shipmentId, rateId, relatedType, relatedId } = req.body;
  if (!rateId) return res.status(400).json({ error: 'rateId is required' });
  if (!to || !from || !parcel) return res.status(400).json({ error: 'to, from, and parcel are required' });

  try {
    let usableShipmentId = shipmentId;

    // If no shipmentId provided, create a fresh shipment
    if (!usableShipmentId) {
      const resolvedParcel = parcelSize
        ? { ...parcel, weight: parcelSizeToWeight(parcelSize) }
        : parcel;
      const shipment = await createShipment(to, from, resolvedParcel);
      usableShipmentId = shipment.object_id;
    }

    const bought = await buyShipment(usableShipmentId, rateId);

    const label = await ShippingLabel.create({
      userId:         req.user.sub,
      externalLabelId: bought.id,
      trackingNumber: bought.trackingNumber,
      carrier:        bought.carrier,
      service:        bought.service,
      amount:         Number((bought.amount + SHIPPO_FEE).toFixed(2)),
      currency:       bought.currency,
      labelUrl:       bought.labelUrl,
      qrCodeUrl:      bought.qrCodeUrl || null,
      status:         bought.status,
      relatedType:    relatedType || null,
      relatedId:      relatedId   || null,
      meta:           bought,
    });

    res.status(201).json(label);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /shipping/labels/:id — cancel / request refund
router.delete('/labels/:id', async (req, res) => {
  try {
    const label = await ShippingLabel.findByPk(req.params.id);
    if (!label || label.userId !== req.user.sub) {
      return res.status(404).json({ error: 'Label not found' });
    }
    if (label.refundStatus === 'requested') {
      return res.status(409).json({ error: 'Refund already requested' });
    }

    await refundShipment(label.externalLabelId);
    await label.update({ refundStatus: 'requested', refundedAt: new Date() });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
