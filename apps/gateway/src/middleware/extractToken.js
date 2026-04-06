/**
 * Extracts auth token from Authorization header first,
 * then falls back to cookies if present.
 *
 * This mirrors the existing backend behavior at the edge,
 * but keeps the token parsing logic in one place.
 */
export function extractToken(req) {
  const auth = req.headers.authorization || '';

  if (auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }

  const cookieHeader = req.headers.cookie || '';
  if (!cookieHeader) {
    return null;
  }

  const cookies = Object.fromEntries(
    cookieHeader
      .split(';')
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const index = pair.indexOf('=');

        if (index === -1) {
          return [pair, ''];
        }

        return [pair.slice(0, index), decodeURIComponent(pair.slice(index + 1))];
      })
  );

  return cookies.sbf_access ?? null;
}