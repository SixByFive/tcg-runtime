import { Router } from 'express';
import { Op } from 'sequelize';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../middleware/requireAuth.js';
import { User, Profile, UserReputation, DiscordLink } from '../models/index.js';
import { PROFILE_STATUSES } from '../models/Profile.js';

const router = Router();

const PUBLIC_USER_ATTRS   = ['id', 'username', 'emailVerified', 'createdAt'];
const PUBLIC_PROFILE_ATTRS = [
  'avatar', 'bio', 'favouritePokemon', 'country', 'showcase',
  'status', 'publicProfile', 'wantsTrade', 'wantsMarketplace',
];

// ---- GET /users/statuses --------------------------------------------------

router.get('/statuses', (_req, res) => {
  res.json(PROFILE_STATUSES);
});

// ---- GET /users/me --------------------------------------------------------

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      include: [
        { model: Profile, as: 'profile' },
        { model: UserReputation, as: 'reputation' },
        {
          model: DiscordLink,
          as: 'discordLink',
          attributes: ['discordUserId', 'discordUsername', 'avatar', 'linkedAt'],
          required: false,
        },
      ],
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- PATCH /users/me ------------------------------------------------------

router.patch('/me', requireAuth, async (req, res) => {
  const ALLOWED = [
    'bio', 'favouritePokemon', 'country', 'showcase', 'status',
    'address1', 'address2', 'city', 'postcode', 'state',
    'phone', 'discord', 'publicProfile', 'wantsTrade', 'wantsMarketplace',
  ];

  try {
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => ALLOWED.includes(k)),
    );

    if (updates.status && !PROFILE_STATUSES.includes(updates.status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const [profile] = await Profile.findOrCreate({
      where: { userId: req.user.id },
      defaults: { userId: req.user.id },
    });

    await profile.update(updates);
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- DELETE /users/me -----------------------------------------------------

router.delete('/me', requireAuth, async (req, res) => {
  const { password, confirm } = req.body;
  if (confirm !== 'DELETE') {
    return res.status(400).json({ error: 'confirm must equal "DELETE"' });
  }

  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.password) {
      if (!password) return res.status(400).json({ error: 'password required' });
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) return res.status(401).json({ error: 'Incorrect password' });
    }

    await Profile.destroy({ where: { userId: req.user.id } });
    await UserReputation.destroy({ where: { userId: req.user.id } });
    await user.destroy();

    res.clearCookie('sbf_access');
    res.clearCookie('sbf_refresh');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- GET /users/me/export -------------------------------------------------

router.get('/me/export', requireAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      include: [{ model: Profile, as: 'profile' }],
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.setHeader('Content-Disposition', `attachment; filename="export-${req.user.id}.json"`);
    res.json({ exportedAt: new Date(), user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- GET /users/search?q= -------------------------------------------------

router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  if (!q) return res.status(400).json({ error: 'q is required' });

  try {
    const users = await User.findAll({
      where: {
        username: { [Op.like]: `%${q}%` },
        isBanned: false,
      },
      attributes: PUBLIC_USER_ATTRS,
      include: [{
        model: Profile,
        as: 'profile',
        attributes: PUBLIC_PROFILE_ATTRS,
        where: { publicProfile: true },
        required: false,
      }],
      limit,
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- GET /users/:username -------------------------------------------------

router.get('/:username', async (req, res) => {
  try {
    const user = await User.findOne({
      where: { username: req.params.username },
      attributes: PUBLIC_USER_ATTRS,
      include: [
        {
          model: Profile,
          as: 'profile',
          attributes: PUBLIC_PROFILE_ATTRS,
          required: false,
        },
        { model: UserReputation, as: 'reputation' },
      ],
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Auto-create a blank profile if none exists yet
    if (!user.profile) {
      await Profile.findOrCreate({ where: { userId: user.id }, defaults: { userId: user.id } });
    }

    // If profile is private, strip sensitive fields
    if (user.profile && !user.profile.publicProfile) {
      user.profile.setDataValue('address1', undefined);
      user.profile.setDataValue('address2', undefined);
      user.profile.setDataValue('city', undefined);
      user.profile.setDataValue('postcode', undefined);
      user.profile.setDataValue('state', undefined);
      user.profile.setDataValue('phone', undefined);
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- GET /users/by-id/:id ------------------------------------------------

router.get('/by-id/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: PUBLIC_USER_ATTRS,
      include: [
        { model: Profile, as: 'profile', attributes: PUBLIC_PROFILE_ATTRS },
        { model: UserReputation, as: 'reputation' },
      ],
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
