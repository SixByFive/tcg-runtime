import { Router } from 'express';
import { requireAuth, requireAdmin } from '@sbf/auth';
import { Reward } from '../models/index.js';
import { AuditLog } from '../models/index.js';

const router = Router();

// GET /rewards/me — my rewards
router.get('/me', requireAuth, async (req, res) => {
  try {
    const rewards = await Reward.findAll({
      where:  { userId: req.user.sub },
      order:  [['createdAt', 'DESC']],
    });
    res.json(rewards);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /rewards/user/:userId — any user's rewards (public-ish)
router.get('/user/:userId', requireAuth, async (req, res) => {
  try {
    const rewards = await Reward.findAll({
      where:  { userId: req.params.userId },
      order:  [['createdAt', 'DESC']],
    });
    res.json(rewards);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /rewards/grant — admin: grant a reward
router.post('/grant', requireAdmin, async (req, res) => {
  const { userId, type, achievementId, data } = req.body;
  if (!userId || !type) return res.status(400).json({ error: 'userId and type are required' });

  try {
    const reward = await Reward.create({
      userId,
      type,
      achievementId: achievementId || null,
      data:          data || null,
      grantedBy:     req.user.sub,
    });

    // Log the admin action
    await AuditLog.create({
      userId:     req.user.sub,
      action:     'GRANT_REWARD',
      targetId:   userId,
      targetType: 'User',
      details:    { rewardId: reward.id, type, achievementId },
      ip:         req.ip,
      userAgent:  req.headers['user-agent'],
    }).catch(() => {});

    res.status(201).json(reward);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
