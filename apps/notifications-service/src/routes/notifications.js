import { Router } from 'express';
import { Op } from 'sequelize';
import { requireAuth } from '@sbf/auth';
import { Notification, UserNotificationPref } from '../models/index.js';
import {
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  dismissNotification,
} from '../services/notify.service.js';

const router = Router();

// GET /notifications — my notifications (paginated, filterable)
router.get('/', requireAuth, async (req, res) => {
  try {
    const page     = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || 20);

    const where = {
      [Op.or]: [{ userId: req.user.sub }, { isBroadcast: true, userId: null }],
      isSilent: false,
    };
    if (req.query.type)        where.type        = req.query.type;
    if (req.query.isRead)      where.isRead      = req.query.isRead === 'true';
    if (req.query.isDismissed) where.isDismissed = req.query.isDismissed === 'true';

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

// GET /notifications/count — unread count
router.get('/count', requireAuth, async (req, res) => {
  try {
    const count = await getUnreadCount(req.user.sub);
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /notifications/prefs — my delivery preferences
router.get('/prefs', requireAuth, async (req, res) => {
  try {
    const [prefs] = await UserNotificationPref.findOrCreate({
      where: { userId: req.user.sub },
      defaults: { userId: req.user.sub },
    });
    res.json(prefs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /notifications/prefs — update delivery preferences
router.patch('/prefs', requireAuth, async (req, res) => {
  const ALLOWED = ['inappEnabled', 'emailEnabled', 'pushEnabled', 'digest', 'quietStart', 'quietEnd'];
  try {
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => ALLOWED.includes(k)),
    );

    if (updates.digest && !['instant', 'daily'].includes(updates.digest)) {
      return res.status(400).json({ error: 'digest must be "instant" or "daily"' });
    }

    const [prefs] = await UserNotificationPref.findOrCreate({
      where: { userId: req.user.sub },
      defaults: { userId: req.user.sub },
    });
    await prefs.update(updates);
    res.json(prefs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /notifications/:id/read — mark one as read
router.post('/:id/read', requireAuth, async (req, res) => {
  try {
    const ok = await markAsRead(req.params.id, req.user.sub);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /notifications/read-all — mark all as read
router.post('/read-all', requireAuth, async (req, res) => {
  try {
    await markAllAsRead(req.user.sub);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /notifications/:id/dismiss — dismiss a notification
router.post('/:id/dismiss', requireAuth, async (req, res) => {
  try {
    const ok = await dismissNotification(req.params.id, req.user.sub);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
