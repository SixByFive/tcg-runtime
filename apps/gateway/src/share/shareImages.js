import { createHash } from 'node:crypto';
import * as usersClient from '../clients/usersClient.js';
import * as collectionsClient from '../clients/collectionsClient.js';
import * as marketplaceClient from '../clients/marketplaceClient.js';
import * as catalogClient from '../clients/catalogClient.js';
import * as tradingClient from '../clients/tradingClient.js';
import { hydrateCards } from '../graphql/resolvers/utils.js';

/**
 * Share images: the gateway gathers + hydrates the data (DEC-0005), then asks
 * media-service to draw it. Output is a 1200x630 PNG usable as an OG/link
 * preview, a Discord attachment, or a native share sheet image on mobile.
 */

const MEDIA_URL = () => process.env.MEDIA_SERVICE_URL || 'http://localhost:4017';

const WISHLIST_FETCH = 100;
const STATUS_LABELS = {
  ACTIVE: 'Active Hunt',
  GRAIL: 'Grail Board',
  EVENTUAL: 'Someday List',
  UPGRADE: 'Upgrade Targets',
};

export class ShareImageError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* --------------------------------- cache --------------------------------- */

const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 200;
const cache = new Map();

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  // refresh recency
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function cacheSet(key, value) {
  cache.set(key, { ...value, expires: Date.now() + TTL_MS });
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
}

/* --------------------------------- helpers -------------------------------- */

function absoluteMediaUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const p = url.startsWith('/') ? url : `/uploads/${url}`;
  return `${MEDIA_URL()}${p}`;
}

function pickPrice(card, variation) {
  const prices = Array.isArray(card?.latestPrices) ? card.latestPrices : [];
  const match = variation ? prices.find((p) => p.variation === variation && p.gbp != null) : null;
  const any = match || prices.find((p) => p.gbp != null);
  return any ? Number(any.gbp) : null;
}

function cardImage(card) {
  return card?.images?.large || card?.images?.small || null;
}

function setLabel(card) {
  return (card?.set?.code || card?.setCode || '').toUpperCase() || null;
}

async function renderViaMedia(kind, data) {
  let res;
  try {
    res = await fetch(`${MEDIA_URL()}/render/share`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.INTERNAL_API_KEY ? { 'x-internal-key': process.env.INTERNAL_API_KEY } : {}),
      },
      body: JSON.stringify({ kind, data }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ShareImageError(502, 'media-service unavailable');
  }
  if (!res.ok) throw new ShareImageError(res.status === 503 ? 503 : 502, 'Image render failed');
  return Buffer.from(await res.arrayBuffer());
}

// Concurrent requests for the same image share one render instead of each starting
// their own (a shared link being opened by many people at once would otherwise
// queue N identical renders behind the renderer's concurrency cap).
const inflight = new Map();

async function cached(key, build) {
  const hit = cacheGet(key);
  if (hit) return hit;
  if (inflight.has(key)) return inflight.get(key);

  const promise = (async () => {
    const png = await build();
    const value = { png, etag: `"${createHash('sha1').update(png).digest('hex').slice(0, 16)}"` };
    cacheSet(key, value);
    return value;
  })().finally(() => inflight.delete(key));

  inflight.set(key, promise);
  return promise;
}

/* --------------------------------- wishlist -------------------------------- */

async function buildWishlistData(username, statusFilter) {
  const profile = await usersClient.getProfile(username).catch(() => null);
  if (!profile?.user?.id) throw new ShareImageError(404, 'User not found');
  if (profile.publicProfile === false) throw new ShareImageError(404, 'User not found');

  const status = statusFilter ? String(statusFilter).toUpperCase() : null;
  if (status && !STATUS_LABELS[status]) throw new ShareImageError(400, 'Unknown status');

  const page = await collectionsClient.getWishlist(profile.user.id, { page: 1, pageSize: WISHLIST_FETCH });
  const rawEntries = Array.isArray(page) ? page : page?.entries || [];
  const total = Array.isArray(page) ? rawEntries.length : page?.total ?? rawEntries.length;

  const hydrated = await hydrateCards(rawEntries, catalogClient, null);
  let entries = Array.isArray(hydrated) ? hydrated : [];
  if (status) entries = entries.filter((e) => (e.status || 'ACTIVE') === status);

  // Grails first; otherwise keep the service's newest-first order.
  entries = [...entries].sort((a, b) => Number(b.status === 'GRAIL') - Number(a.status === 'GRAIL'));

  const cards = entries.map((e) => ({
    name: e.card?.name || 'Unknown card',
    setLabel: setLabel(e.card),
    number: e.card?.number ?? null,
    price: pickPrice(e.card, e.variation),
    currency: 'GBP',
    grail: e.status === 'GRAIL',
    imageUrl: cardImage(e.card),
  }));

  // Only quote a value when we saw the whole list.
  const sawAll = !status && rawEntries.length >= total;
  const estValue = sawAll
    ? entries.reduce((sum, e) => sum + (pickPrice(e.card, e.variation) ?? 0) * (e.quantity || 1), 0)
    : null;

  return {
    username: profile.user.username,
    avatarUrl: absoluteMediaUrl(profile.avatar),
    label: status ? STATUS_LABELS[status] : 'Wishlist',
    total: status ? cards.length : total,
    estValue: estValue && estValue > 0 ? estValue : null,
    currency: 'GBP',
    cards,
  };
}

export function wishlistShareImage(username, { status } = {}) {
  const key = `wishlist:${String(username).toLowerCase()}:${status || ''}`;
  return cached(key, async () => renderViaMedia('wishlist', await buildWishlistData(username, status)));
}

/* --------------------------------- listing --------------------------------- */

async function buildListingData(id) {
  let listing;
  try {
    listing = await marketplaceClient.getListing(id, { includeItems: true });
  } catch (err) {
    if (err.status === 404 || err.status === 400) throw new ShareImageError(404, 'Listing not found');
    throw new ShareImageError(502, 'marketplace-service unavailable');
  }
  // Non-active listings are 404 for anonymous callers upstream; belt and braces.
  if (!listing || listing.status !== 'ACTIVE') throw new ShareImageError(404, 'Listing not found');

  const kind = listing.listingKind || 'SINGLE';
  let subtitle = null;
  let imageUrls = [];

  if (kind === 'SINGLE' && listing.cardId) {
    const [card] = await hydrateCards([{ cardId: listing.cardId }], catalogClient, null).then((r) =>
      Array.isArray(r) ? r : [r],
    );
    const c = card?.card;
    subtitle = [c?.set?.name, setLabel(c), c?.number ? `#${c.number}` : null].filter(Boolean).join('  ·  ') || null;
    imageUrls = [cardImage(c)].filter(Boolean);
  } else if (kind === 'BULK_TRACKED') {
    // Showcase the three most-represented cards in the lot.
    const byCard = new Map();
    for (const item of listing.items || []) {
      byCard.set(item.cardId, (byCard.get(item.cardId) || 0) + (item.quantity || 1));
    }
    const top = [...byCard.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([cardId]) => ({ cardId }));
    const hydrated = await hydrateCards(top, catalogClient, null);
    imageUrls = (Array.isArray(hydrated) ? hydrated : []).map((e) => cardImage(e.card)).filter(Boolean);
  }

  const sellerProfile = listing.sellerId
    ? await usersClient.getProfileById(listing.sellerId).catch(() => null)
    : null;

  return {
    kind,
    title: listing.title,
    subtitle,
    price: listing.price != null ? Number(listing.price) : null,
    currency: listing.currency || 'GBP',
    condition: listing.condition || null,
    conditionMin: listing.conditionMin || null,
    conditionMax: listing.conditionMax || null,
    variant: listing.variant || null,
    cardCount: listing.cardCount ?? null,
    inclusions: listing.guaranteedInclusionsJson || [],
    shippingType: listing.shippingType || null,
    shippingPrice: listing.shippingPrice != null ? Number(listing.shippingPrice) : null,
    allowOffers: !!listing.allowOffers,
    willTrade: !!listing.willTrade,
    seller: sellerProfile?.user?.username
      ? { username: sellerProfile.user.username, avatarUrl: absoluteMediaUrl(sellerProfile.avatar) }
      : null,
    imageUrls,
  };
}

export function listingShareImage(id) {
  return cached(`listing:${id}`, async () => renderViaMedia('listing', await buildListingData(id)));
}

/* ---------------------------------- trade ---------------------------------- */

async function buildTradeData(id) {
  let trade;
  try {
    trade = await tradingClient.getPublicTrade(id);
  } catch (err) {
    if (err.message?.includes('not found') || err.message?.includes('404')) {
      throw new ShareImageError(404, 'Trade not found');
    }
    throw new ShareImageError(502, 'trading-service unavailable');
  }
  if (!trade || trade.status !== 'INITIATED') throw new ShareImageError(404, 'Trade not found');

  const rows = Array.isArray(trade.cards) ? trade.cards : [];
  const hydrated = await hydrateCards(
    rows.map((r) => ({ ...r })),
    catalogClient,
    null,
  );
  const entries = Array.isArray(hydrated) ? hydrated : rows;

  // Cards owned by the initiator are what they're offering; the rest are what they want.
  const toCard = (e) => ({
    name: e.card?.name || 'Unknown card',
    setLabel: setLabel(e.card),
    number: e.card?.number ?? null,
    quantity: e.quantity || 1,
    imageUrl: cardImage(e.card),
  });
  const offering = entries.filter((e) => e.userId === trade.initiatorId).map(toCard);
  const wanting = entries.filter((e) => e.userId !== trade.initiatorId).map(toCard);

  const initiator = trade.initiatorId
    ? await usersClient.getProfileById(trade.initiatorId).catch(() => null)
    : null;
  if (!initiator?.user?.username || initiator.publicProfile === false) {
    throw new ShareImageError(404, 'Trade not found');
  }

  return {
    username: initiator.user.username,
    avatarUrl: absoluteMediaUrl(initiator.avatar),
    offering,
    wanting,
    topUpAmount: trade.topUpAmount != null ? Number(trade.topUpAmount) : null,
    currency: 'GBP',
  };
}

export function tradeShareImage(id) {
  return cached(`trade:${id}`, async () => renderViaMedia('trade', await buildTradeData(id)));
}

/* ----------------------------- URLs for GraphQL ---------------------------- */

/** Public origin of this gateway, for links handed to clients. */
export function publicBaseUrl(req) {
  const fixed = process.env.PUBLIC_GATEWAY_URL;
  if (fixed) return fixed.replace(/\/$/, '');
  const proto = req?.headers?.['x-forwarded-proto']?.split(',')[0] || req?.protocol || 'http';
  const host = req?.headers?.['x-forwarded-host'] || req?.headers?.host;
  return host ? `${proto}://${host}` : '';
}

export function wishlistShareUrl(req, username, status) {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return `${publicBaseUrl(req)}/share/wishlist/${encodeURIComponent(username)}.png${q}`;
}

export function tradeShareUrl(req, id) {
  return `${publicBaseUrl(req)}/share/trade/${encodeURIComponent(id)}.png`;
}

export function listingShareUrl(req, id) {
  return `${publicBaseUrl(req)}/share/listing/${encodeURIComponent(id)}.png`;
}
