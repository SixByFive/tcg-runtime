// Discord OAuth helpers + token encryption/refresh

import crypto from 'node:crypto';

const BASE        = process.env.DISCORD_OAUTH_BASE    || 'https://discord.com/api';
const CLIENT_ID   = () => process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = () => process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI  = () => process.env.DISCORD_REDIRECT_URI;

// ---- OAuth ----------------------------------------------------------------

export function buildAuthorizeUrl(state, scope = 'identify guilds') {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID(),
    response_type: 'code',
    scope,
    redirect_uri:  REDIRECT_URI(),
    state,
    prompt:        'consent',
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code) {
  const body = new URLSearchParams({
    client_id:     CLIENT_ID(),
    client_secret: CLIENT_SECRET(),
    grant_type:    'authorization_code',
    code,
    redirect_uri:  REDIRECT_URI(),
  });

  const res = await fetch(`${BASE}/oauth2/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) throw new Error(`Discord token exchange failed: ${res.status}`);
  return res.json();
}

export async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    client_id:     CLIENT_ID(),
    client_secret: CLIENT_SECRET(),
    grant_type:    'refresh_token',
    refresh_token: refreshToken,
    redirect_uri:  REDIRECT_URI(),
  });

  const res = await fetch(`${BASE}/oauth2/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) throw new Error(`Discord token refresh failed: ${res.status}`);
  return res.json();
}

export async function fetchDiscordMe(accessToken) {
  const res = await fetch(`${BASE}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Discord /users/@me failed: ${res.status}`);
  return res.json();
}

// ---- Token encryption (AES-256-GCM) --------------------------------------

function tokenSecret() { return process.env.DISCORD_TOKEN_SECRET || ''; }

function canEncrypt() {
  return tokenSecret().length >= 32;
}

function makeKey() {
  return crypto.createHash('sha256').update(tokenSecret()).digest();
}

export function encryptToken(text) {
  if (!canEncrypt()) return null;
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', makeKey(), iv);
  const enc    = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.');
}

export function decryptToken(enc) {
  if (!canEncrypt() || !enc || typeof enc !== 'string') return null;
  const parts = enc.split('.');
  if (parts.length !== 3) return null;
  const [ivB64, tagB64, dataB64] = parts;
  const decipher = crypto.createDecipheriv('aes-256-gcm', makeKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}

// ---- Valid token helper ---------------------------------------------------

function isExpired(expiresAt, skewMs = 60_000) {
  if (!expiresAt) return true;
  const t = new Date(expiresAt).getTime();
  return !Number.isFinite(t) || Date.now() + skewMs >= t;
}

export async function getValidAccessToken(UserDiscordLink, userId) {
  const link = await UserDiscordLink.findOne({ where: { userId: String(userId) } });
  if (!link) return { ok: false, error: 'discord_not_linked' };

  const access  = decryptToken(link.discordAccessTokenEnc);
  const refresh = decryptToken(link.discordRefreshTokenEnc);

  if (access && !isExpired(link.discordTokenExpiresAt)) {
    return { ok: true, accessToken: access };
  }

  if (!refresh) return { ok: false, error: 'discord_refresh_missing' };

  const next       = await refreshAccessToken(refresh);
  const nextAccess  = next?.access_token  || null;
  const nextRefresh = next?.refresh_token || null;
  const expiresAt   = next?.expires_in
    ? new Date(Date.now() + next.expires_in * 1000)
    : new Date(Date.now() + 3600_000);

  await UserDiscordLink.update({
    discordAccessTokenEnc:  nextAccess  ? encryptToken(nextAccess)  : link.discordAccessTokenEnc,
    discordRefreshTokenEnc: nextRefresh ? encryptToken(nextRefresh) : link.discordRefreshTokenEnc,
    discordTokenExpiresAt:  expiresAt,
  }, { where: { userId: String(userId) } });

  if (!nextAccess) return { ok: false, error: 'discord_refresh_failed' };
  return { ok: true, accessToken: nextAccess };
}
