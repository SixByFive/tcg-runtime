import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchDiscordMe,
  encryptToken,
  getValidAccessToken,
} from '../services/discord.service.js';
import { UserDiscordLink } from '../models/index.js';

const router = Router();

const FRONTEND_BASE = () => process.env.FRONTEND_BASE_URL || 'http://localhost:3000';

// ---- State signing --------------------------------------------------------

function signState(payload) {
  const secret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('No secret configured for Discord state signing');
  return jwt.sign(payload, secret, { expiresIn: '10m' });
}

function verifyState(token) {
  const secret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('No secret configured for Discord state signing');
  return jwt.verify(token, secret);
}

function normalizeReturnPath(p) {
  const fallback = '/account?tab=security';
  if (!p || typeof p !== 'string') return fallback;
  const s = p.trim();
  if (!s.startsWith('/') || s.startsWith('//')) return fallback;
  if (s.includes('\\') || s.includes('\0')) return fallback;
  return s;
}

// ---- GET /auth/discord — link status for current user --------------------

router.get('/', requireAuth, async (req, res) => {
  try {
    const link = await UserDiscordLink.findOne({ where: { userId: req.user.id } });
    if (!link) return res.json({ linked: false });
    res.json({
      linked:          true,
      discordUserId:   link.discordUserId,
      discordUsername: link.discordUsername,
      avatar:          link.avatar,
      linkedAt:        link.linkedAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- GET /auth/discord/start-url — return authorize URL as JSON ----------

router.get('/start-url', requireAuth, (req, res) => {
  try {
    const returnPath = typeof req.query.return === 'string'
      ? normalizeReturnPath(req.query.return)
      : '/account?tab=security';
    const state = signState({ u: String(req.user.id), r: returnPath });
    res.json({ url: buildAuthorizeUrl(state) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- GET /auth/discord/start — redirect to Discord OAuth -----------------

router.get('/start', requireAuth, (req, res) => {
  try {
    const returnPath = typeof req.query.return === 'string'
      ? normalizeReturnPath(req.query.return)
      : '/account?tab=security';
    const state = signState({ u: String(req.user.id), r: returnPath });
    res.redirect(buildAuthorizeUrl(state));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- GET /auth/discord/callback — OAuth callback -------------------------

router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) return res.status(400).send('Missing code or state');

  let parsed;
  try {
    parsed = verifyState(String(state));
  } catch {
    return res.status(401).send('Invalid or expired state');
  }

  const userId     = String(parsed.u || '');
  const returnPath = normalizeReturnPath(parsed.r);
  if (!userId) return res.status(400).send('Missing user in state');

  try {
    const token = await exchangeCodeForToken(String(code));
    const me    = await fetchDiscordMe(token.access_token);

    await UserDiscordLink.upsert({
      userId,
      discordUserId:         me.id,
      discordUsername:       me.global_name || me.username || null,
      avatar:                me.avatar || null,
      linkedAt:              new Date(),
      discordAccessTokenEnc:  token.access_token  ? encryptToken(token.access_token)  : null,
      discordRefreshTokenEnc: token.refresh_token ? encryptToken(token.refresh_token) : null,
      discordTokenExpiresAt:  token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000)
        : null,
    });

    const sep = returnPath.includes('?') ? '&' : '?';
    return res.redirect(`${FRONTEND_BASE()}${returnPath}${sep}linked=discord`);
  } catch (err) {
    console.error('[DiscordAuth] callback error:', err.message);
    const sep = returnPath.includes('?') ? '&' : '?';
    return res.redirect(`${FRONTEND_BASE()}${returnPath}${sep}linked=discord&error=linking_failed`);
  }
});

// ---- POST /auth/discord/unlink -------------------------------------------

router.post('/unlink', requireAuth, async (req, res) => {
  try {
    await UserDiscordLink.destroy({ where: { userId: req.user.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { getValidAccessToken };
export default router;
