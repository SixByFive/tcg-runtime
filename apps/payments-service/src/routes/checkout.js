import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Transaction } from '../models/index.js';
import { getOrCreateCustomer, createProductCheckout } from '../services/stripe.service.js';

const router = Router();

/**
 * POST /payments/checkout
 *
 * One-off Stripe Checkout for physical products / merch.
 *
 * Body: {
 *   items: [{ name: string, amount: number (pence), quantity?: number }],
 *   description?: string,
 *   email?: string
 * }
 *
 * Returns { url, sessionId } — redirect the user to url.
 */
router.post('/', requireAuth, async (req, res) => {
  const { items, description, email } = req.body;
  if (!items?.length) return res.status(400).json({ error: 'items array is required' });

  for (const item of items) {
    if (!item.name || !item.amount || item.amount < 1) {
      return res.status(400).json({ error: 'Each item requires name and amount (pence)' });
    }
  }

  try {
    const customer = await getOrCreateCustomer(req.user.sub, email || req.user.email);

    const session = await createProductCheckout({
      customerId: customer.id,
      lineItems:  items,
      userId:     req.user.sub,
      description: description || 'SBF TCG Store purchase',
    });

    // Record pending transaction — webhook will mark it completed
    const total = items.reduce((sum, i) => sum + i.amount * (i.quantity || 1), 0);
    await Transaction.create({
      userId:      req.user.sub,
      type:        'product_purchase',
      status:      'pending',
      amount:      total / 100,
      currency:    'GBP',
      description: description || 'Store purchase',
      sourceType:  'checkout_session',
      sourceId:    session.id,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
