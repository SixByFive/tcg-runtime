export function requireAdminKey(req, res, next) {
  const ADMIN_KEY = process.env.ADMIN_API_KEY;
  if (!ADMIN_KEY) {
    return res.status(503).json({ error: 'Admin key not configured' });
  }
  const provided = req.headers['x-admin-key'] || req.query.adminKey;
  if (!provided || provided !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Invalid or missing admin key' });
  }
  next();
}
