import { Router } from 'express';
import { Op, fn, col, literal } from 'sequelize';
import { User } from '../models/index.js';
import { requireAuth, requireAdmin } from '../middleware/requireAuth.js';

const router = Router();
const MAX_ATTRIBUTION_LENGTH = 128;

function clean(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_ATTRIBUTION_LENGTH);
}

function nullableMatch(field, value) {
  return value == null ? { [field]: { [Op.is]: null } } : { [field]: value };
}

// Records first-touch campaign attribution for an already authenticated user.
// Existing values are never overwritten: the first campaign that acquired the
// registration remains the source of truth even if the user later revisits via
// a different marketing link.
router.post('/', requireAuth, async (req, res) => {
  const user = await User.findByPk(req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.utmContent || user.utmCampaign || user.utmSource) {
    return res.json({ success: true, recorded: false, reason: 'already-attributed' });
  }

  const attribution = {
    utmSource: clean(req.body?.utmSource),
    utmMedium: clean(req.body?.utmMedium),
    utmCampaign: clean(req.body?.utmCampaign),
    utmContent: clean(req.body?.utmContent),
  };

  // Do not create a meaningless attribution row when the visitor did not arrive
  // through a campaign link.
  if (!attribution.utmSource && !attribution.utmCampaign && !attribution.utmContent) {
    return res.json({ success: true, recorded: false, reason: 'no-attribution' });
  }

  await user.update(attribution);
  return res.json({ success: true, recorded: true });
});

// Aggregate-only admin view. No email, username or user id leaves auth-service.
// An "activated" registration is an attributed user who has at least one real
// collection card (wishlist=false) in the shared platform database.
router.get('/admin', requireAdmin, async (_req, res) => {
  const rows = await User.findAll({
    attributes: [
      'utmSource',
      'utmMedium',
      'utmCampaign',
      'utmContent',
      [fn('COUNT', col('id')), 'registrations'],
      [fn('MIN', col('createdAt')), 'firstRegistrationAt'],
      [fn('MAX', col('createdAt')), 'lastRegistrationAt'],
    ],
    where: {
      [Op.or]: [
        { utmSource: { [Op.ne]: null } },
        { utmCampaign: { [Op.ne]: null } },
        { utmContent: { [Op.ne]: null } },
      ],
    },
    group: ['utmSource', 'utmMedium', 'utmCampaign', 'utmContent'],
    raw: true,
  });

  const campaigns = await Promise.all(rows.map(async (row) => {
    const registrations = Number(row.registrations ?? 0);
    const activatedUsers = await User.count({
      where: {
        [Op.and]: [
          nullableMatch('utmSource', row.utmSource),
          nullableMatch('utmMedium', row.utmMedium),
          nullableMatch('utmCampaign', row.utmCampaign),
          nullableMatch('utmContent', row.utmContent),
          // Same MySQL database is shared by auth and collections services. This
          // keeps the result aggregate-only and avoids sending attributed user IDs
          // through the admin app just to calculate activation.
          { id: { [Op.in]: literal('(SELECT DISTINCT `userId` FROM `collections` WHERE (`wishlist` = 0 OR `wishlist` IS NULL))') } },
        ],
      },
    });

    return {
      source: row.utmSource ?? null,
      medium: row.utmMedium ?? null,
      campaign: row.utmCampaign ?? null,
      campaignId: row.utmContent ?? null,
      registrations,
      activatedUsers: Number(activatedUsers ?? 0),
      activationRate: registrations > 0 ? Number(((activatedUsers / registrations) * 100).toFixed(2)) : 0,
      firstRegistrationAt: row.firstRegistrationAt ? new Date(row.firstRegistrationAt).toISOString() : null,
      lastRegistrationAt: row.lastRegistrationAt ? new Date(row.lastRegistrationAt).toISOString() : null,
    };
  }));

  campaigns.sort((a, b) => b.registrations - a.registrations);

  return res.json({
    totalAttributedRegistrations: campaigns.reduce((sum, item) => sum + item.registrations, 0),
    totalActivatedUsers: campaigns.reduce((sum, item) => sum + item.activatedUsers, 0),
    campaigns,
  });
});

export default router;
