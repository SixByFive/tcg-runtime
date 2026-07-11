/**
 * Enrich collection/wishlist entries with full card data from the catalog service
 * (variants, latestPrices, images, set). Handles both array and WishlistPage shapes.
 * Falls back gracefully if the catalog call fails.
 */
export async function hydrateCards(entriesOrPage, catalogClient, logger) {
  const isPage = entriesOrPage
    && typeof entriesOrPage === 'object'
    && !Array.isArray(entriesOrPage)
    && Array.isArray(entriesOrPage.entries);

  const isSingle = entriesOrPage
    && typeof entriesOrPage === 'object'
    && !Array.isArray(entriesOrPage)
    && !isPage;

  const entries = isPage
    ? entriesOrPage.entries
    : isSingle
      ? [entriesOrPage]
      : Array.isArray(entriesOrPage)
        ? entriesOrPage
        : [];

  if (!entries.length) return entriesOrPage;

  const ids = [...new Set(entries.map(e => e.cardId).filter(Boolean))];
  if (!ids.length) return entriesOrPage;

  let catalogCards = [];
  try {
    catalogCards = await catalogClient.getCardsBatch(ids);
  } catch (e) {
    logger?.warn?.(`hydrateCards: batch fetch failed — ${e.message}`);
    return entriesOrPage;
  }

  const cardMap = new Map(catalogCards.map(c => [c.id || c.cardId, c]));
  const hydrated = entries.map(entry => ({
    ...entry,
    card: cardMap.get(entry.cardId) || entry.card || null,
  }));

  if (isPage)   return { ...entriesOrPage, entries: hydrated };
  if (isSingle) return hydrated[0] ?? null;
  return hydrated;
}

export const JSONScalar = {
  __serialize(value)  { return value; },
  __parseValue(value) { return value; },
  __parseLiteral()    { return null; },
};
