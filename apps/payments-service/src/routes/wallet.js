import { Router } from 'express';
import { requireAuth } from '@sbf/auth';
import {
  createTopupIntent,
  getWalletSummary,
  completeTopup,
  requestWithdrawal,
} from '../services/wallet.service.js';
import { getStripe } from '../services/stripe.service.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /payments/wallet
 * Returns the user's wallet balance + recent transactions.
 */
router.get('/', async (req, res) => {
  try {
    const limit  = Math.min(Number(req.query.limit)  || 20, 100);
    const offset = Math.max(Number(req.query.offset) || 0,  0);
    const summary = await getWalletSummary(req.user.sub, { limit, offset });
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /payments/wallet/topup
 * Body: { amountPence: number }
 * Returns: { clientSecret, paymentIntentId }
 *
 * Frontend completes payment using Stripe.js with the clientSecret.
 * The webhook credits the wallet on payment_intent.succeeded.
 */
router.post('/topup', async (req, res) => {
  try {
    const { amountPence } = req.body ?? {};
    if (!amountPence) return res.status(400).json({ error: 'amountPence is required' });

    const parsed = parseInt(amountPence, 10);
    if (isNaN(parsed) || parsed !== Number(amountPence)) {
      return res.status(400).json({ error: 'amountPence must be an integer (in pence)' });
    }

    const result = await createTopupIntent(
      req.user.sub,
      req.user.email,
      parsed,
    );
    res.json(result);
  } catch (err) {
    const status = err.message?.startsWith('Minimum') || err.message?.startsWith('Maximum')
      ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

/**
 * POST /payments/wallet/topup/:intentId/confirm
 * Called by the frontend after stripe.confirmCardPayment() succeeds.
 * Verifies the PaymentIntent status directly with Stripe, then credits
 * the wallet — idempotent, safe to call even if the webhook already fired.
 */
router.post('/topup/:intentId/confirm', async (req, res) => {
  try {
    const { intentId } = req.params;
    if (!intentId) return res.status(400).json({ error: 'intentId is required' });

    const stripe = getStripe();
    const intent = await stripe.paymentIntents.retrieve(intentId);

    if (intent.status !== 'succeeded') {
      return res.status(400).json({ error: `Payment not succeeded (status: ${intent.status})` });
    }

    // completeTopup is idempotent — safe if webhook already ran
    await completeTopup(intentId);

    const summary = await getWalletSummary(req.user.sub, { limit: 10, offset: 0 });
    res.json({ ok: true, wallet: summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /payments/wallet/withdraw
 * Body: { amountPence: number }
 * Debits the wallet immediately and creates a pending withdrawal record.
 * Returns the withdrawal transaction.
 */
router.post('/withdraw', async (req, res) => {
  try {
    const { amountPence } = req.body ?? {};
    if (!amountPence) return res.status(400).json({ error: 'amountPence is required' });

    const parsed = parseInt(amountPence, 10);
    if (isNaN(parsed) || parsed !== Number(amountPence)) {
      return res.status(400).json({ error: 'amountPence must be an integer (in pence)' });
    }

    const { sortCode, accountNumber, accountName } = req.body ?? {};
    const result = await requestWithdrawal(req.user.sub, parsed, { sortCode, accountNumber, accountName });
    res.json(result);
  } catch (err) {
    const status = err.message?.startsWith('Minimum') || err.message?.startsWith('Insufficient')
      ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

export default router;
