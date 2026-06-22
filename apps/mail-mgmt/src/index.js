/**
 * mail-mgmt — stores encrypted mailbox credentials for sixbyfive.com
 * addresses and lets the admin app open a one-click, already-signed-in
 * SOGo webmail session for any of them.
 *
 * Flow:
 *   1. Admin app calls POST /mailboxes/:address/sso-token (via gateway,
 *      protected by x-admin-key) to mint a one-time token.
 *   2. Admin app opens https://mail.sixbyfive.com/sso/<token> in a browser.
 *      Nginx on the mail VPS proxies that path straight to this service
 *      (not through mailcow), so any Set-Cookie we issue is first-party
 *      for mail.sixbyfive.com.
 *   3. This service logs into mailcow's own web login (the actual gate in
 *      front of SOGo — see mailcowLogin() below for why), forwards the
 *      resulting MCSESSID cookie to the browser, and redirects to
 *      /SOGo/so/ — the browser lands already authenticated.
 */

import express from 'express';
import crypto  from 'node:crypto';
import https   from 'node:https';
import fs      from 'node:fs';
import path    from 'node:path';

const PORT        = Number(process.env.PORT || 4031);
const ADMIN_KEY    = process.env.ADMIN_API_KEY || '';
const ENC_KEY_HEX  = process.env.MAIL_ENCRYPTION_KEY || '';
const STORE_PATH   = process.env.MAILBOX_STORE_PATH || '/data/mailboxes.enc.json';
// mailcow's nginx only publishes 127.0.0.1:8443 and selects the vhost (and
// therefore its TLS cert) by SNI — a raw IP connection carries no usable
// SNI, so we set it explicitly and skip hostname verification (the cert is
// issued for the hostname, not the loopback IP we connect to).
const SOGO_HOST     = process.env.SOGO_HOST || '127.0.0.1';
const SOGO_PORT     = Number(process.env.SOGO_PORT || 8443);
const SOGO_HOSTNAME = process.env.SOGO_HOSTNAME || 'mail.sixbyfive.com';
const SSO_TOKEN_TTL_MS = 60 * 1000;

function mailcowRequest({ method, path, body, cookie }) {
  return new Promise((resolve, reject) => {
    const headers = {
      Host: SOGO_HOSTNAME,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } : {}),
    };
    const req = https.request({
      host: SOGO_HOST,
      port: SOGO_PORT,
      path,
      method,
      servername: SOGO_HOSTNAME,
      rejectUnauthorized: false,
      headers,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function firstCookiePair(setCookieHeader) {
  // Set-Cookie: NAME=VALUE; path=/; secure; ... — keep only the NAME=VALUE part
  const raw = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  return raw ? raw.split(';')[0] : null;
}

// mailcow doesn't let SOGo handle raw username/password POSTs — every /SOGo/*
// request is gated by an nginx auth_request against mailcow's own session
// cookie (MCSESSID). The real login path is mailcow's own combined
// webmail/admin login form at "/", which we replicate here:
//   1. GET / to obtain a pre-auth MCSESSID + CSRF token embedded in the page.
//   2. POST login_user/pass_user/csrf_token (+ that cookie) back to /.
//   3. A successful login swaps in a fresh, authenticated MCSESSID and
//      302s to /SOGo/so/ — that cookie is what we hand to the browser.
async function mailcowLogin(address, password) {
  const initial = await mailcowRequest({ method: 'GET', path: '/' });
  const preAuthCookie = firstCookiePair(initial.headers['set-cookie']);
  const csrfMatch = initial.body.match(/name=['"]csrf_token['"][^>]*value=['"]([a-f0-9]+)['"]/i)
    || initial.body.match(/value=['"]([a-f0-9]{64})['"]/);
  const csrfToken = csrfMatch?.[1];

  const form = new URLSearchParams({ login_user: address, pass_user: password, csrf_token: csrfToken || '' }).toString();
  const result = await mailcowRequest({ method: 'POST', path: '/', body: form, cookie: preAuthCookie });

  const sessionCookie = firstCookiePair(result.headers['set-cookie']);
  const loggedIn = result.statusCode === 302 && /\/SOGo\//.test(result.headers.location || '');

  return { success: loggedIn, cookie: sessionCookie };
}

// ── Encryption helpers ───────────────────────────────────────────────────────

function encryptionKey() {
  if (!ENC_KEY_HEX) return null;
  const buf = Buffer.from(ENC_KEY_HEX, 'hex');
  return buf.length === 32 ? buf : null;
}

function encrypt(plaintext, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString('hex'), tag: tag.toString('hex'), data: data.toString('hex') };
}

function decrypt(payload, key) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'hex'));
  const data = Buffer.concat([decipher.update(Buffer.from(payload.data, 'hex')), decipher.final()]);
  return data.toString('utf8');
}

// ── Mailbox store (in-memory, persisted to an encrypted JSON file) ──────────

let mailboxes = {}; // address -> { label, iv, tag, data }

function loadStore() {
  try {
    mailboxes = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    mailboxes = {};
  }
}

function saveStore() {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(mailboxes, null, 2));
}

loadStore();

// ── One-time SSO tokens (in-memory only) ─────────────────────────────────────

const ssoTokens = new Map(); // token -> { address, expiresAt }

setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of ssoTokens) {
    if (entry.expiresAt < now) ssoTokens.delete(token);
  }
}, 30 * 1000);

// ── Middleware ────────────────────────────────────────────────────────────────

function requireAdminKey(req, res, next) {
  if (!ADMIN_KEY) return res.status(503).json({ error: 'Admin key not configured on server' });
  if (req.headers['x-admin-key'] !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── App ───────────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'mail-mgmt' });
});

// GET /mailboxes — list addresses + labels, never passwords
app.get('/mailboxes', requireAdminKey, (_req, res) => {
  const list = Object.entries(mailboxes).map(([address, entry]) => ({
    address,
    label: entry.label || '',
  }));
  res.json(list);
});

// POST /mailboxes  { address, password, label? } — add or update credentials
app.post('/mailboxes', requireAdminKey, (req, res) => {
  const { address, password, label } = req.body ?? {};
  if (!address || !password) return res.status(400).json({ error: 'address and password are required' });

  const key = encryptionKey();
  if (!key) return res.status(503).json({ error: 'MAIL_ENCRYPTION_KEY not configured (must be 32 bytes / 64 hex chars)' });

  const enc = encrypt(password, key);
  mailboxes[address] = { label: label || '', ...enc };
  saveStore();
  res.json({ ok: true, address });
});

// DELETE /mailboxes/:address
app.delete('/mailboxes/:address', requireAdminKey, (req, res) => {
  const { address } = req.params;
  if (!mailboxes[address]) return res.status(404).json({ error: 'Mailbox not found' });
  delete mailboxes[address];
  saveStore();
  res.json({ ok: true, address });
});

// POST /mailboxes/:address/sso-token — mint a one-time SOGo login token
app.post('/mailboxes/:address/sso-token', requireAdminKey, (req, res) => {
  const { address } = req.params;
  if (!mailboxes[address]) return res.status(404).json({ error: 'Mailbox not found' });

  const token = crypto.randomBytes(24).toString('hex');
  ssoTokens.set(token, { address, expiresAt: Date.now() + SSO_TOKEN_TTL_MS });

  res.json({ token, url: `https://mail.sixbyfive.com/sso/${token}` });
});

// GET /sso/:token — PUBLIC, but the token is one-time-use and short-lived.
// Reached directly via nginx on mail.sixbyfive.com (not through the gateway)
// so the SOGo session cookie lands as first-party for that domain.
app.get('/sso/:token', async (req, res) => {
  const { token } = req.params;
  const entry = ssoTokens.get(token);
  ssoTokens.delete(token); // always single-use, even on failure

  if (!entry || entry.expiresAt < Date.now()) {
    return res.status(401).send('This webmail link has expired. Generate a new one from the admin app.');
  }

  const key = encryptionKey();
  const stored = mailboxes[entry.address];
  if (!key || !stored) {
    return res.status(500).send('Mailbox credentials unavailable.');
  }

  let password;
  try {
    password = decrypt(stored, key);
  } catch {
    return res.status(500).send('Failed to decrypt mailbox credentials.');
  }

  try {
    const { success, cookie } = await mailcowLogin(entry.address, password);

    if (!success || !cookie) {
      return res.status(502).send('Mailcow rejected the stored credentials for this mailbox — update the password in the admin app.');
    }

    res.append('Set-Cookie', `${cookie}; Path=/; Secure; HttpOnly; SameSite=Lax`);
    res.redirect(302, '/SOGo/so/');
  } catch (err) {
    res.status(502).send(`Could not reach mailcow: ${err.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`[mail-mgmt] listening on :${PORT}`);
  console.log(`[mail-mgmt] Admin key: ${ADMIN_KEY ? '*** (set)' : 'NOT SET — all admin requests will be rejected'}`);
  console.log(`[mail-mgmt] Encryption key: ${encryptionKey() ? '*** (set)' : 'NOT SET — credential storage disabled'}`);
});
