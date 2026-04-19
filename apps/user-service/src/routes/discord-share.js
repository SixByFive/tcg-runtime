import { Router } from 'express';
import { createDecipheriv } from 'crypto';
import { requireAuth } from '@sbf/auth';
import { DiscordLink } from '../models/index.js';

const router = Router();

// ── Token decryption ──────────────────────────────────────────────────────────

function decryptToken(enc) {
  const secret = process.env.DISCORD_TOKEN_SECRET;
  if (!secret || !enc) return null;
  try {
    const key = Buffer.from(secret.padEnd(32, '0').slice(0, 32));
    const [ivHex, encrypted] = enc.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
  } catch { return null; }
}

// ── In-memory rate limiter (5/min, 50/day, 30s dedup) ────────────────────────

const rateLimits = new Map(); // userId -> { minute: [timestamps], day: [timestamps], lastPayload: string }
function checkShareRateLimit(userId, payload) {
  const now = Date.now();
  const state = rateLimits.get(userId) || { minute: [], day: [], lastPayload: null, lastPayloadAt: 0 };
  state.minute = state.minute.filter(t => now - t < 60_000);
  state.day = state.day.filter(t => now - t < 86_400_000);
  if (state.minute.length >= 5) return { allowed: false, reason: 'Rate limit: 5 shares per minute' };
  if (state.day.length >= 50) return { allowed: false, reason: 'Rate limit: 50 shares per day' };
  if (payload && state.lastPayload === payload && now - state.lastPayloadAt < 30_000) return { allowed: false, reason: 'Duplicate share — wait 30 seconds' };
  state.minute.push(now); state.day.push(now);
  if (payload) { state.lastPayload = payload; state.lastPayloadAt = now; }
  rateLimits.set(userId, state);
  return { allowed: true };
}

// ── Helper: get user's Discord access token ───────────────────────────────────

async function getUserAccessToken(userId) {
  const link = await DiscordLink.findOne({ where: { userId } });
  if (!link || !link.discordAccessTokenEnc) return null;
  return decryptToken(link.discordAccessTokenEnc);
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /discord/share/guilds — list guilds the user is in where the bot is also present
router.get('/guilds', requireAuth, async (req, res) => {
  try {
    const accessToken = await getUserAccessToken(req.user.sub);
    if (!accessToken) return res.status(400).json({ error: 'Discord account not linked or token unavailable' });

    const userGuildsRes = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userGuildsRes.ok) return res.status(502).json({ error: 'Failed to fetch user guilds from Discord' });
    const userGuilds = await userGuildsRes.json();

    const botToken = process.env.DISCORD_BOT_TOKEN;
    const results = await Promise.all(
      userGuilds.map(async guild => {
        try {
          const botRes = await fetch(`https://discord.com/api/v10/guilds/${guild.id}`, {
            headers: { Authorization: `Bot ${botToken}` },
          });
          return botRes.ok ? guild : null;
        } catch { return null; }
      })
    );

    res.json(results.filter(Boolean));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /discord/share/guilds/:guildId/channels — text channels in a guild (bot-visible)
router.get('/guilds/:guildId/channels', requireAuth, async (req, res) => {
  try {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const channelsRes = await fetch(`https://discord.com/api/v10/guilds/${req.params.guildId}/channels`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (!channelsRes.ok) return res.status(502).json({ error: 'Failed to fetch channels from Discord' });
    const channels = await channelsRes.json();
    res.json(channels.filter(c => c.type === 0)); // type 0 = GUILD_TEXT
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /discord/share/collection — share a collection card to a Discord channel
router.post('/collection', requireAuth, async (req, res) => {
  const { guildId, channelId, cardId, cardName, variation, quantity, imageUrl } = req.body;
  if (!guildId || !channelId || !cardName) {
    return res.status(400).json({ error: 'guildId, channelId, and cardName are required' });
  }

  const payload = JSON.stringify({ type: 'collection', cardId, cardName, variation, quantity, channelId });
  const rateCheck = checkShareRateLimit(req.user.sub, payload);
  if (!rateCheck.allowed) return res.status(429).json({ error: rateCheck.reason });

  try {
    const link = await DiscordLink.findOne({ where: { userId: req.user.sub } });
    const username = link?.discordUsername || 'A user';
    const content = `📦 ${username} has ${cardName}${variation ? ` (${variation})` : ''} (x${quantity ?? 1}) in their collection!${imageUrl ? ` ${imageUrl}` : ''}`;

    const botToken = process.env.DISCORD_BOT_TOKEN;
    const msgRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!msgRes.ok) {
      const err = await msgRes.json().catch(() => ({}));
      return res.status(502).json({ error: 'Discord message failed', detail: err });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /discord/share/wishlist — share a wishlist card to a Discord channel
router.post('/wishlist', requireAuth, async (req, res) => {
  const { guildId, channelId, cardId, cardName, variation, imageUrl } = req.body;
  if (!guildId || !channelId || !cardName) {
    return res.status(400).json({ error: 'guildId, channelId, and cardName are required' });
  }

  const payload = JSON.stringify({ type: 'wishlist', cardId, cardName, variation, channelId });
  const rateCheck = checkShareRateLimit(req.user.sub, payload);
  if (!rateCheck.allowed) return res.status(429).json({ error: rateCheck.reason });

  try {
    const link = await DiscordLink.findOne({ where: { userId: req.user.sub } });
    const username = link?.discordUsername || 'A user';
    const content = `🎯 ${username} is looking for ${cardName}${variation ? ` (${variation})` : ''}!${imageUrl ? ` ${imageUrl}` : ''}`;

    const botToken = process.env.DISCORD_BOT_TOKEN;
    const msgRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!msgRes.ok) {
      const err = await msgRes.json().catch(() => ({}));
      return res.status(502).json({ error: 'Discord message failed', detail: err });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
