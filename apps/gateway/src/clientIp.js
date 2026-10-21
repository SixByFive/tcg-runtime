import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Real client IP propagation.
 *
 * Every backend service sits behind the gateway, so without this they all see the gateway
 * container's IP as the caller and their per-IP rate limits (e.g. auth-service's "10
 * registrations per hour", catalog's "300 requests per minute") end up capping the whole
 * site instead of each client.
 *
 * - `clientIpMiddleware` records `req.ip` for the lifetime of each request (AsyncLocalStorage).
 *   `req.ip` is the real client because the app trusts only private-range proxy hops
 *   (see `app.set('trust proxy', ...)` in app.js) and nginx appends the true remote address.
 * - `installForwardedIpFetch` wraps global fetch so calls to our own internal services carry
 *   `X-Forwarded-For: <client ip>`. Services opt in with the same `trust proxy` setting.
 *   Calls to anything else (Stripe, Discord, ...) are left untouched.
 */

const store = new AsyncLocalStorage();

export function clientIpMiddleware(req, _res, next) {
  store.run({ ip: req.ip }, next);
}

export function getClientIp() {
  return store.getStore()?.ip ?? null;
}

let internalOrigins = null;

function isInternalUrl(input) {
  let url;
  try {
    url = new URL(typeof input === 'string' || input instanceof URL ? input : input?.url);
  } catch {
    return false;
  }
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return true;

  if (!internalOrigins) {
    internalOrigins = new Set(
      Object.entries(process.env)
        .filter(([key, value]) => /_SERVICE_URL$/.test(key) && value)
        .map(([, value]) => {
          try {
            return new URL(value).origin;
          } catch {
            return null;
          }
        })
        .filter(Boolean),
    );
  }
  return internalOrigins.has(url.origin);
}

let installed = false;

export function installForwardedIpFetch() {
  if (installed) return;
  installed = true;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = function fetchWithClientIp(input, init = {}) {
    const ip = getClientIp();
    // Request objects carry their own headers; every client in this gateway passes a URL string.
    if (!ip || input instanceof Request || !isInternalUrl(input)) return originalFetch(input, init);

    const headers = new Headers(init.headers || {});
    if (!headers.has('x-forwarded-for')) headers.set('x-forwarded-for', ip);
    return originalFetch(input, { ...init, headers });
  };
}
