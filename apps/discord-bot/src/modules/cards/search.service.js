// src/modules/cards/search.service.js
//
// UPDATED (2026-01-22):
// - Uses schema-supported cardsearch resolvers:
//     - cardsearchSearchCards(input: CardSearchInput!)
//     - cardsearchCardById(cardId: ID!, variant: String)
// - Adds robust DEBUG logging (request URL, variables, results, errors)
// - Adds a "file loaded" boot marker to prove this file is actually running
//
// Enable logs by setting:
//   DEBUG_BOT=1
// (You can also use DEBUG=1 if you prefer; see env.js note below.)

import { ENV } from "../../config/env.js";

/* ---------------- Debug logger ---------------- */

const DEBUG =
  ENV.DEBUG_BOT === true ||
  ENV.DEBUG_BOT === "1" ||
  ENV.DEBUG_BOT === 1 ||
  ENV.DEBUG === true ||
  ENV.DEBUG === "1" ||
  ENV.DEBUG === 1;

function dbg(...args) {
  if (!DEBUG) return;
  // eslint-disable-next-line no-console
  console.log("[CardSearch]", ...args);
}

function errlog(...args) {
  // always log errors (even when DEBUG off)
  // eslint-disable-next-line no-console
  console.error("[CardSearch]", ...args);
}

// BOOT MARKER: proves this file is actually being imported/executed
dbg("search.service.js loaded ✅ (DEBUG on)");
if (!DEBUG) {
  // Still leave a subtle marker once, helps confirm which version is running.
  // eslint-disable-next-line no-console
  console.log("[CardSearch] search.service.js loaded (DEBUG off)");
}

/* ---------------- GraphQL helper ---------------- */

async function gqlRequest(opName, query, variables) {
  const url = ENV.BACKEND_GRAPHQL_URL;
  if (!url) throw new Error("BACKEND_GRAPHQL_URL is not set");

  dbg(`${opName} -> POST`, url);
  dbg(`${opName} variables:`, JSON.stringify(variables, null, 2));

  let r;
  try {
    r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
  } catch (e) {
    // Network-level failure (DNS, refused, etc.)
    errlog(`${opName} fetch failed:`, e);
    throw e;
  }

  const text = await r.text().catch(() => "");
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // non-json response
  }

  if (!r.ok) {
    errlog(`${opName} HTTP ${r.status} ${r.statusText}`);
    errlog(`${opName} raw body:`, text?.slice?.(0, 2000) || text);
    throw new Error(
      `GraphQL HTTP ${r.status} ${r.statusText} :: body=${json ? JSON.stringify(json) : text}`
    );
  }

  if (json?.errors?.length) {
    errlog(`${opName} GraphQL errors:`, JSON.stringify(json.errors, null, 2));
    throw new Error(`GraphQL error :: ${JSON.stringify(json.errors)}`);
  }

  dbg(`${opName} ok`);
  return json?.data || null;
}

/* ---------------- Queries (schema-aligned) ---------------- */

const CARDSEARCH_BY_ID = /* GraphQL */ `
  query BotCardById($cardId: ID!, $variant: String) {
    cardsearchCardById(cardId: $cardId, variant: $variant) {
      id
      cardId
      name
      number
      setCode
      rarity
      images { small large }
      set { code name }
      variants { key label }
    }
  }
`;

const CARDSEARCH_SEARCH = /* GraphQL */ `
  query BotCardSearch($input: CardSearchInput!) {
    cardsearchSearchCards(input: $input) {
      total
      limit
      offset
      items {
        id
        cardId
        name
        number
        setCode
        rarity
        images { small large }
        set { code name }
        variants { key label }
      }
    }
  }
`;

/* ---------------- Small helpers ---------------- */

// Matches canonical IDs like: sv08-123, swsh12pt5gg-70, base1-4, etc.
function looksLikeCanonicalCardId(s) {
  return /^[a-z0-9]+[a-z0-9]*-\d+[a-z0-9]*$/i.test(String(s || "").trim());
}

function normalizeSetToken(raw) {
  if (!raw) return null;

  let s = String(raw).trim();
  if (!s) return null;

  s = s.replace(/[^a-z0-9]/gi, "");
  s = s.toUpperCase();

  // Normalize SV8 -> SV08
  const m = s.match(/^SV(\d{1,2})$/);
  if (m) return `SV${m[1].padStart(2, "0")}`;

  return s; // SSP, SCR, etc.
}

function extractSetAndNumber(query) {
  let q = String(query || "").trim();

  let set = null;
  let number = null;

  // (#250) or #250
  const numMatch =
    q.match(/\(#?\s*([0-9]{1,4})\s*\)/i) ||
    q.match(/#\s*([0-9]{1,4})\b/i);

  if (numMatch) {
    number = String(numMatch[1]);
    q = q.replace(numMatch[0], " ").trim();
  }

  // in sv08 / in ssp
  const inMatch = q.match(/\bin\s+([a-z0-9-]{2,20})\b/i);
  if (inMatch) {
    set = normalizeSetToken(inMatch[1]);
    q = q.replace(inMatch[0], " ").trim();
  }

  q = q.replace(/\s{2,}/g, " ").trim();
  return { name: q, set, number };
}

function buildCardSearchInput(query, limit = 10, { includeSetAndNumber = true } = {}) {
  const { name, set, number } = extractSetAndNumber(query);

  const input = {
    name: name || null,
    fuzzy: true,
    limit,
    offset: 0,
    orderBy: "RELEVANCE",
  };

  if (includeSetAndNumber) {
    if (set) input.set = set;
    if (number) input.number = number;
  }

  return input;
}

/* ---------------- Public API used by commands ---------------- */

export async function lookupSingleCard({ query, variant = null }) {
  const q = String(query || "").trim();
  if (!q) return null;

  dbg("lookupSingleCard query:", q, "variant:", variant ?? "(none)");

  // Direct ID lookup
  if (looksLikeCanonicalCardId(q)) {
    const data = await gqlRequest("cardById", CARDSEARCH_BY_ID, { cardId: q, variant });
    const card = data?.cardsearchCardById || null;
    dbg("cardById result:", card ? card.cardId : null);
    return card;
  }

  // 1) Primary: parsed set/number included
  let input = buildCardSearchInput(q, 10, { includeSetAndNumber: true });
  dbg("search input (with set/number):", JSON.stringify(input, null, 2));

  let data = await gqlRequest("searchCards(primary)", CARDSEARCH_SEARCH, { input });
  let result = data?.cardsearchSearchCards || null;
  let items = result?.items || [];
  dbg("primary results:", { total: result?.total, returned: items.length });

  if (items[0]) return items[0];

  // 2) Fallback: name-only
  input = buildCardSearchInput(q, 10, { includeSetAndNumber: false });
  dbg("search input (name-only fallback):", JSON.stringify(input, null, 2));

  data = await gqlRequest("searchCards(fallback)", CARDSEARCH_SEARCH, { input });
  result = data?.cardsearchSearchCards || null;
  items = result?.items || [];
  dbg("fallback results:", { total: result?.total, returned: items.length });

  return items[0] || null;
}

export async function lookupCardsMultiple({ query, limit = 10 }) {
  const q = String(query || "").trim();
  if (!q) return [];

  dbg("lookupCardsMultiple query:", q, "limit:", limit);

  if (looksLikeCanonicalCardId(q)) {
    const data = await gqlRequest("cardById(list)", CARDSEARCH_BY_ID, { cardId: q, variant: null });
    const card = data?.cardsearchCardById;
    dbg("cardById(list) result:", card ? card.cardId : null);
    return card ? [card] : [];
  }

  const input = buildCardSearchInput(q, Math.min(Math.max(limit, 1), 25));
  dbg("search input (multi):", JSON.stringify(input, null, 2));

  const data = await gqlRequest("searchCards(multi)", CARDSEARCH_SEARCH, { input });
  const result = data?.cardsearchSearchCards || null;
  const items = result?.items || [];
  dbg("multi results:", { total: result?.total, returned: items.length });

  return items;
}
