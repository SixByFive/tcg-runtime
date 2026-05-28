import { Router } from 'express';
import { requireAuth } from '@sbf/auth';
import {
  adminListWithdrawals,
  adminCompleteWithdrawal,
  adminRejectWithdrawal,
} from '../services/wallet.service.js';

const router = Router();
router.use(requireAuth);

// Lightweight admin check — same pattern used by other admin routes in this service
function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
  next();
}

router.use(requireAdmin);

/**
 * GET /payments/admin/withdrawals
 * Query: status (pending|completed|failed|all), limit, offset
 */
router.get('/', async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const limit  = Math.min(Number(req.query.limit)  || 20, 100);
    const offset = Math.max(Number(req.query.offset) || 0,  0);
    const result = await adminListWithdrawals({ status, limit, offset });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /payments/admin/withdrawals/:id/complete
 * Mark a pending withdrawal as completed (bank transfer sent).
 */
router.post('/:id/complete', async (req, res) => {
  try {
    const tx = await adminCompleteWithdrawal(req.params.id);
    res.json({ ok: true, withdrawal: tx });
  } catch (err) {
    const status = err.message.includes('not found') ? 404
      : err.message.includes('Cannot') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

/**
 * POST /payments/admin/withdrawals/:id/reject
 * Body: { reason?: string }
 * Rejects the withdrawal and refunds the balance.
 */
router.post('/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body ?? {};
    const tx = await adminRejectWithdrawal(req.params.id, reason);
    res.json({ ok: true, withdrawal: tx });
  } catch (err) {
    const status = err.message.includes('not found') ? 404
      : err.message.includes('Cannot') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

export default router;
