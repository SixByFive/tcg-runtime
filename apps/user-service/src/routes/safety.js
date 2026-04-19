import { Router } from 'express';
import { createHash, randomBytes } from 'crypto';
import { requireAuth, requireAdmin } from '@sbf/auth';
import { Profile } from '../models/index.js';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function ageFromDob(dob) {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

function deriveRestrictionLevel(profile) {
  // Admin override takes precedence
  if (profile.restrictionLevel) return profile.restrictionLevel;
  const age = ageFromDob(profile.dob);
  if (age === null)    return 'none';
  if (age < 13)       return 'child';
  if (age < 16) {
    return profile.parentVerifiedAt ? 'teen' : 'teen_unverified';
  }
  return 'none';
}

function computeCapabilities(profile) {
  const level = deriveRestrictionLevel(profile);
  const isChild         = level === 'child';
  const isTeen          = level === 'teen' || level === 'teen_unverified';
  const parentVerified  = !!profile.parentVerifiedAt;

  return {
    canTrade:           !isChild && (!isTeen || parentVerified),
    canPost:            !isChild,
    canMessage:         !isChild && (!isTeen || parentVerified),
    canConnectDiscord:  !isChild,
    canBuyMarketplace:  !isChild,
    canSellMarketplace: !isChild && (!isTeen || parentVerified),
    restrictionLevel:   level,
  };
}

function safetyResult(profile) {
  return {
    dob:             profile.dob             ?? null,
    parentEmail:     profile.parentEmail     ?? null,
    parentVerifiedAt: profile.parentVerifiedAt ?? null,
    restrictionLevel: deriveRestrictionLevel(profile),
    capabilities:    computeCapabilities(profile),
  };
}

// ── User routes ───────────────────────────────────────────────────────────────

// PATCH /safety/profile — update DOB and/or parent email
router.patch('/profile', requireAuth, async (req, res) => {
  try {
    const profile = await Profile.findOne({ where: { userId: req.user.sub } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const updates = {};

    // DOB is locked once set
    if (req.body.dob !== undefined) {
      if (profile.dob) {
        return res.status(409).json({ error: 'Date of birth is already set and cannot be changed' });
      }
      updates.dob = req.body.dob;
    }

    // Parent email only relevant for teens
    if (req.body.parentEmail !== undefined) {
      const age = ageFromDob(updates.dob ?? profile.dob);
      if (age !== null && (age < 13 || age >= 16)) {
        return res.status(400).json({ error: 'Parent email is only applicable for accounts aged 13–15' });
      }
      updates.parentEmail = req.body.parentEmail || null;
      // Clear verification if email changes
      if (updates.parentEmail !== profile.parentEmail) {
        updates.parentVerifiedAt = null;
      }
    }

    await profile.update(updates);
    res.json(safetyResult(profile.reload ? await profile.reload() : profile));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /safety/request-parent-verification — send verification email to parent
router.post('/request-parent-verification', requireAuth, async (req, res) => {
  try {
    const profile = await Profile.findOne({ where: { userId: req.user.sub } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    if (!profile.parentEmail) return res.status(400).json({ error: 'No parent email set' });
    if (profile.parentVerifiedAt) return res.status(409).json({ error: 'Parent already verified' });

    const age = ageFromDob(profile.dob);
    if (age === null || age < 13 || age >= 16) {
      return res.status(400).json({ error: 'Parent verification only required for accounts aged 13–15' });
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiry = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await profile.update({ parentVerificationToken: tokenHash, parentVerificationTokenExpiry: expiry });

    const verifyUrl = (process.env.API_BASE_URL || 'http://localhost:4021') + '/parent-verify?uid=' + req.user.sub + '&token=' + rawToken;
    const notifUrl = (process.env.NOTIFICATIONS_SERVICE_URL || 'http://localhost:4016') + '/internal/notify';
    fetch(notifUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.INTERNAL_API_KEY || '' },
      body: JSON.stringify({
        userId: req.user.sub,
        type: 'PARENT_VERIFY_REQUEST',
        title: 'Parent verification requested',
        body: `Your child has requested parental verification. Click to approve: ${verifyUrl}`,
        userEmail: profile.parentEmail,
        isSilent: true,
      }),
    }).catch(() => {});

    res.json({ ok: true, message: 'Verification email sent to parent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /safety/capabilities — get current user's computed capabilities
router.get('/capabilities', requireAuth, async (req, res) => {
  try {
    const profile = await Profile.findOne({ where: { userId: req.user.sub } });
    if (!profile) return res.json(computeCapabilities({}));
    res.json(safetyResult(profile));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin routes ──────────────────────────────────────────────────────────────

// POST /safety/admin/set-restriction — override restriction level
router.post('/admin/set-restriction', requireAdmin, async (req, res) => {
  const { userId, restrictionLevel } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  const VALID = ['none', 'teen', 'child', 'full'];
  if (restrictionLevel && !VALID.includes(restrictionLevel)) {
    return res.status(400).json({ error: `restrictionLevel must be one of: ${VALID.join(', ')}` });
  }

  try {
    const profile = await Profile.findOne({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const updates = { restrictionLevel: restrictionLevel || null };
    // Clear parent link if forcing adult state
    if (!restrictionLevel || restrictionLevel === 'none') {
      updates.parentEmail = null;
      updates.parentVerifiedAt = null;
    }

    await profile.update(updates);
    res.json(safetyResult(await profile.reload()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /safety/admin/set-parent-verified — manually approve/deny parent
router.post('/admin/set-parent-verified', requireAdmin, async (req, res) => {
  const { userId, verified } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const profile = await Profile.findOne({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    await profile.update({ parentVerifiedAt: verified ? new Date() : null });
    res.json(safetyResult(await profile.reload()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /safety/admin/clear-parent-link/:userId — wipe all parent fields
router.delete('/admin/clear-parent-link/:userId', requireAdmin, async (req, res) => {
  try {
    const profile = await Profile.findOne({ where: { userId: req.params.userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    await profile.update({ parentEmail: null, parentVerifiedAt: null });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
