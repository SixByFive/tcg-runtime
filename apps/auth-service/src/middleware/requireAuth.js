import { verifyAccessToken } from '../services/token.service.js';

export function requireAuth(req, res, next) {
  const token = req.cookies?.sbf_access;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}
