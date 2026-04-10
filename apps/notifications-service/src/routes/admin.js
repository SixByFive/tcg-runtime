import { Router } from 'express';
import { requireAdmin } from '@sbf/auth';
import { Notification } from '../models/index.js';
import { notifyUser } from '../services/notify.service.js';

const router = Router();

router.use(requireAdmin);

// POST /notifications/admin/broadcast — send broadcast notification (admin UI)
router.post('/broadcast', async (req, res) => {
  const { type = 'system', title, body, iconUrl, linkUrl, meta, expiresAt } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'title and body are required' });

  try {
    const notification = await Notification.create({
      userId: null,
      type, title, body, iconUrl, linkUrl, meta,
      isBroadcast: true,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });
    res.status(201).json(notification);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /notifications/admin/:id — hard delete any notification
router.delete('/:id', async (req, res) => {
  try {
    const n = await Notification.findByPk(req.params.id);
    if (!n) return res.status(404).json({ error: 'Not found' });
    await n.destroy();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /notifications/admin/list — paginated list of all notifications
router.get('/list', async (req, res) => {
  try {
    const page     = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Number(req.query.pageSize) || 50);
    const where    = {};
    if (req.query.userId) where.userId = req.query.userId;
    if (req.query.type)   where.type   = req.query.type;

    const { count, rows } = await Notification.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    res.json({ notifications: rows, total: count, page, pageSize });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
