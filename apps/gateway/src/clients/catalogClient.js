/**
 * Internal client for catalog-service.
 */
function getCatalogServiceBaseUrl() {
  return process.env.CATALOG_SERVICE_URL || 'http://localhost:4012';
}

async function parseJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function request(path, options = {}) {
  const url = `${getCatalogServiceBaseUrl()}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await parseJson(response);

  if (!response.ok) {
    const message =
      data?.error ||
      data?.message ||
      `Catalog service request failed: ${response.status}`;
    throw new Error(message);
  }

  return data;
}

export async function getHealth() {
  return request('/health', { method: 'GET' });
}

// ─── Sets ─────────────────────────────────────────────────────────────────────

export async function getSets({ limit = 50, offset = 0 } = {}) {
  return request(`/sets?limit=${limit}&offset=${offset}`, { method: 'GET' });
}

export async function getSetByCode(code) {
  return request(`/sets/${encodeURIComponent(code)}`, { method: 'GET' });
}

// ─── Cards ────────────────────────────────────────────────────────────────────

/**
 * Normalise a raw DB card row (snake_case) into the shape the GraphQL schema
 * expects (camelCase with nested images/set/variants/latestPrices objects).
 */
function normaliseCard(c) {
  return {
    id:      c.id,
    cardId:  c.id,
    name:    c.name,
    number:  c.number,
    rarity:  c.rarity,
    setCode: c.set_code,
    images:
      c.image_small || c.image_large
        ? {
            small: c.image_small ? `${c.image_small}/low.webp`  : null,
            large: c.image_large ? `${c.image_large}/high.webp` : null,
          }
        : null,
    set: c.Set
      ? { code: c.Set.code, name: c.Set.name }
      : null,
    variants: (() => {
      const vArr = Array.isArray(c.variants) && c.variants.length
        ? c.variants
        : Array.isArray(c.CardVariants) && c.CardVariants.length
          ? c.CardVariants
          : null;
      return vArr
        ? vArr.map((v) => ({ key: v.variant, label: v.display_name ?? v.variant, default: false }))
        : null;
    })(),
    latestPrices:
      Array.isArray(c.prices) && c.prices.length
        ? c.prices.map((p) => ({
            variation: p.variant    ?? null,
            currency:  'GBP',
            gbp:       p.amount_gbp != null ? Number(p.amount_gbp) : null,
            market:    p.amount_gbp != null ? Number(p.amount_gbp) : null,
            mid:       p.amount_gbp != null ? Number(p.amount_gbp) : null,
            low:       null,
            high:      null,
            updatedAt: p.updated_at ?? null,
            provider:  p.source     ?? 'unknown',
          }))
        : null,
  };
}

export async function searchCards(input = {}) {
  const params = new URLSearchParams();

  // Accept `name` (GraphQL field) or legacy `query`
  const q = input.name || input.query;
  if (q)            params.set('q',         q);
  if (input.setCode) params.set('setCode',  input.setCode);
  if (input.rarity)  params.set('rarity',   input.rarity);

  // Pagination: GraphQL uses limit/offset, catalog-service uses pageSize/page
  const limit  = input.limit  ?? 50;
  const offset = input.offset ?? 0;
  params.set('pageSize', String(limit));
  params.set('page',     String(Math.floor(offset / limit) + 1));

  // Always include prices so latestPrices is populated
  params.set('withPrices', 'true');

  const result = await request(`/cards?${params.toString()}`, { method: 'GET' });

  // Normalise into the shape the resolver + GraphQL schema expect
  const rawCards = result?.cards ?? result?.items ?? [];
  return {
    total:  result?.total  ?? 0,
    limit,
    offset,
    items:  rawCards.map(normaliseCard),
  };
}

export async function getCardsBatch(ids) {
  if (!Array.isArray(ids) || !ids.length) return [];
  const result = await request('/cards/batch', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
  return Array.isArray(result) ? result.map(normaliseCard) : [];
}

export async function getCard(id, variant) {
  const params = variant ? `?variant=${encodeURIComponent(variant)}` : '';
  return request(`/cards/${encodeURIComponent(id)}${params}`, { method: 'GET' });
}

// ─── Prices ───────────────────────────────────────────────────────────────────

export async function getPriceObservations(cardId, variant, limit = 90) {
  const params = new URLSearchParams({ cardId, limit: String(limit) });
  if (variant) params.set('variant', variant);
  return request(`/prices/observations?${params.toString()}`, { method: 'GET' });
}

export async function getPriceRollups(cardId, variant) {
  const params = new URLSearchParams({ cardId });
  if (variant) params.set('variant', variant);
  return request(`/prices/rollups?${params.toString()}`, { method: 'GET' });
}

// ─── Price Alerts ─────────────────────────────────────────────────────────────

/**
 * Normalise service field names → frontend-friendly shape:
 *   variant      → variation
 *   targetPrice  → value
 *   enabled      → isActive
 *   triggeredAt  → lastFiredAt
 */
function normalisePriceAlert(a) {
  if (!a) return null;
  return {
    id:          a.id,
    cardId:      a.cardId,
    variation:   a.variant,
    currency:    a.currency,
    value:       a.targetPrice != null ? Number(a.targetPrice) : null,
    isActive:    a.enabled ?? true,
    lastFiredAt: a.triggeredAt ?? null,
    createdAt:   a.createdAt,
    updatedAt:   a.updatedAt,
  };
}

export async function getPriceAlerts(token) {
  const data = await request('/prices/alerts', {
    method:  'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  return Array.isArray(data) ? data.map(normalisePriceAlert) : [];
}

export async function upsertPriceAlert(token, input) {
  const { id, cardId, variation, value, currency, isActive } = input;

  if (id) {
    // Update existing
    const data = await request(`/prices/alerts/${encodeURIComponent(id)}`, {
      method:  'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(value    != null ? { targetPrice: value }       : {}),
        ...(isActive != null ? { enabled:     isActive }    : {}),
      }),
    });
    return normalisePriceAlert(data);
  }

  // Create new
  const data = await request('/prices/alerts', {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cardId,
      variant:     variation,
      targetPrice: value,
      currency:    currency ?? 'GBP',
      enabled:     isActive ?? true,
    }),
  });
  return normalisePriceAlert(data);
}

export async function deletePriceAlert(token, id) {
  await request(`/prices/alerts/${encodeURIComponent(id)}`, {
    method:  'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return true;
}

export async function togglePriceAlert(token, id, active) {
  const data = await request(`/prices/alerts/${encodeURIComponent(id)}`, {
    method:  'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: active }),
  });
  return normalisePriceAlert(data);
}
