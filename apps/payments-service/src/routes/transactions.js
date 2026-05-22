import { Router } from 'express';
import { Op } from 'sequelize';
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

// GET /payments/transactions/admin/revenue-summary — aggregated revenue stats
router.get('/admin/revenue-summary', requireAdmin, async (req, res) => {
  try {
    const now   = new Date();
    const day30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const day7  = new Date(now - 7  * 24 * 60 * 60 * 1000);

    const all = await Transaction.findAll({
      where: { status: 'completed' },
      attributes: ['amount', 'currency', 'type', 'createdAt'],
    });

    const sum = (rows) => rows.reduce((acc, r) => acc + Number(r.amount), 0);

    const totalRevenue   = sum(all);
    const revenue30d     = sum(all.filter((r) => new Date(r.createdAt) >= day30));
    const revenue7d      = sum(all.filter((r) => new Date(r.createdAt) >= day7));
    const subRevenue     = sum(all.filter((r) => r.type === 'subscription_payment'));
    const productRevenue = sum(all.filter((r) => r.type === 'product_purchase'));
    const refunds        = sum(all.filter((r) => r.type.includes('refund')));

    res.json({
      totalRevenue,
      revenue30d,
      revenue7d,
      subRevenue,
      productRevenue,
      refunds,
      currency: 'GBP',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
