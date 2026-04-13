import { Router } from 'express';
import { requireAdmin } from '@sbf/auth';
import { Op } from 'sequelize';
import { AuditLog } from '../models/index.js';

const router = Router();
router.use(requireAdmin);

// GET /audit — paginated audit log (admin only)
router.get('/', async (req, res) => {
  try {
    const page     = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Number(req.query.pageSize) || 50);
    const where    = {};

    if (req.query.userId)     where.userId     = req.query.userId;
    if (req.query.action)     where.action     = req.query.action;
    if (req.query.targetId)   where.targetId   = req.query.targetId;
    if (req.query.targetType) where.targetType = req.query.targetType;

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      order:  [['createdAt', 'DESC']],
      limit:  pageSize,
      offset: (page - 1) * pageSize,
    });

    res.json({ logs: rows, total: count, page, pageSize });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
