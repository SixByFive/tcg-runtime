import { Router } from 'express';
import { requireAdmin } from '../middleware/requireAuth.js';
import { User, Profile, UserReputation } from '../models/index.js';

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
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await user.update({ isBanned: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/users/:id/unban
router.post('/users/:id/unban', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await user.update({ isBanned: false });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /admin/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await Profile.destroy({ where: { userId: req.params.id } });
    await UserReputation.destroy({ where: { userId: req.params.id } });
    await user.destroy();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
