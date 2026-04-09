import { verifyAccessToken } from './jwt.js';

/**
 * Extracts a Bearer token from the Authorization header, or falls back to
 * the sbf_access HttpOnly cookie (set by web login).
 */
export function extractToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return req.cookies?.sbf_access ?? null;
}

/**
 * Express middleware — attaches verified JWT payload to req.user.
 * Accepts both Authorization: Bearer <token> and sbf_access cookie.
 */
export function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

/**
 * Express middleware — same as requireAuth but also asserts isAdmin.
 */
export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user?.isAdmin) return res.status(403).json({ error: 'Forbidden' });
    next();
  });
}
