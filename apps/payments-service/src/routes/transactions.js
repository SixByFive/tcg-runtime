import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { Transaction } from '../models/index.js';

const router = Router();

// ─── GET /payments/transactions — my transaction history ─────────────────────

router.get('/', requireAuth, async (req, res) => {
  try {
    const page     = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || 20);

    const { count, rows } = await Transaction.findAndCountAll({
      where: { userId: req.user.sub },
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    res.json({ transactions: rows, total: count, page, pageSize });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin ────────────────────────────────────────────────────────────────────

router.get('/admin', requireAdmin, async (req, res) => {
  try {
    const page     = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Number(req.query.pageSize) || 50);
    const where    = {};
    if (req.query.userId) where.userId = req.query.userId;
    if (req.query.type)   where.type   = req.query.type;
    if (req.query.status) where.status = req.query.status;

    const { count, rows } = await Transaction.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    res.json({ transactions: rows, total: count, page, pageSize });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
