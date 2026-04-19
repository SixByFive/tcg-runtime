import { Router } from 'express';
import { requireAdmin } from '../middleware/requireAuth.js';
import { User, Profile, UserReputation, AdminAction } from '../models/index.js';

async function logAdminAction(req, action, targetId, targetType, details) {
  try {
    await AdminAction.create({
      adminId: req.user?.sub || req.user?.id || 'unknown',
      action,
      targetId: targetId ? String(targetId) : null,
      targetType: targetType || null,
      details: details || null,
      ip: req.ip || req.headers['x-forwarded-for'] || null,
    });
  } catch { /* audit log failure must not break the main action */ }
}

const router = Router();

router.use(requireAdmin);

// GET /admin/users?limit=100&offset=0
router.get('/users', async (req, res) => {
  const limit  = Math.min(Number(req.query.limit)  || 100, 500);
  const offset = Number(req.query.offset) || 0;
  try {
    const { count, rows } = await User.findAndCountAll({
      attributes: { exclude: ['password'] },
      include: [{ model: Profile, as: 'profile', required: false }],
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });
    res.json({ total: count, users: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/users/:id/ban
router.post('/users/:id/ban', async (req, res) => {
  const userId = req.params.id;
  const { reason } = req.body;
  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await user.update({ isBanned: true });
    await logAdminAction(req, 'ban_user', userId, 'user', { reason });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/users/:id/unban
router.post('/users/:id/unban', async (req, res) => {
  const userId = req.params.id;
  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await user.update({ isBanned: false });
    await logAdminAction(req, 'unban_user', userId, 'user', {});
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /admin/users/:id
router.delete('/users/:id', async (req, res) => {
  const userId = req.params.id;
  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await Profile.destroy({ where: { userId } });
    await UserReputation.destroy({ where: { userId } });
    await user.destroy();
    await logAdminAction(req, 'delete_user', userId, 'user', {});
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
