import { verifyAccessToken } from '../services/token.service.js';

export function requireAuth(req, res, next) {
  // Mobile sends Authorization: Bearer <token>; web sends sbf_access cookie
  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : req.cookies?.sbf_access;

  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}
