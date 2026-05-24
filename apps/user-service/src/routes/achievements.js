import { Router } from 'express';
import { requireAuth, requireAdmin } from '@sbf/auth';
import { Achievement, UserAchievement } from '../models/index.js';

const router = Router();

// GET /achievements — public list
router.get('/', async (req, res) => {
  try {
    const rows = await Achievement.findAll({ where: req.query.includeHidden === 'true' ? {} : { hidden: false }, order: [['tier','ASC'],['name','ASC']] });
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /achievements/my — my earned achievements
router.get('/my', requireAuth, async (req, res) => {
  try {
    const rows = await UserAchievement.findAll({ where: { userId: req.user.sub }, include: [{ model: Achievement, as: 'achievement' }], order: [['earnedAt','DESC']] });
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /achievements/user/:userId — a user's public achievements
router.get('/user/:userId', async (req, res) => {
  try {
    const rows = await UserAchievement.findAll({
      where: { userId: req.params.userId },
      include: [{ model: Achievement, as: 'achievement', where: { hidden: false }, required: true }],
      order: [['earnedAt','DESC']],
    });
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /achievements/grant — admin: grant achievement to user
router.post('/grant', requireAdmin, async (req, res) => {
  const { userId, achievementId, data, meta } = req.body;
  if (!userId || !achievementId) return res.status(400).json({ error: 'userId and achievementId required' });
  try {
    const [ua, created] = await UserAchievement.findOrCreate({ where: { userId, achievementId }, defaults: { userId, achievementId, meta: meta ?? data, earnedAt: new Date() } });
    res.status(created ? 201 : 200).json(ua);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /achievements/admin — admin: create achievement
router.post('/admin', requireAdmin, async (req, res) => {
  try {
    const a = await Achievement.create(req.body);
    res.status(201).json(a);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
