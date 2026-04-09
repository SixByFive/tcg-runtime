import jwt from 'jsonwebtoken';

export function requireUser(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = auth.slice(7);
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret) return res.status(503).json({ error: 'Auth not configured' });

  try {
    const payload = jwt.verify(token, secret);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
