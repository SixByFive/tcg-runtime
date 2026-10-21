import { normalizeCatalogId } from './resolvers/utils.js';

/**
 * Per-request batching loaders.
 *
 * A listings query returns up to a few dozen rows and every row asks for its
 * `seller` and `cardInfo`. Without batching that is one internal HTTP call per
 * row per field (and the same seller repeated for every row). A loader collects
 * every key requested in the same tick, de-duplicates them, and makes one call.
 * Results are memoised for the lifetime of the request, so a loader must be
 * created per request (see buildContext).
 */

/**
 * @param {(keys: string[]) => Promise<Array<any|Error>>} batchFn
 *   Must resolve to an array aligned with `keys`; an Error entry rejects only that key.
 */
export function createLoader(batchFn) {
  const cache = new Map(); // key -> Promise
  let queue = null; // { keys: string[], resolvers: Array<{resolve, reject}> }

  function dispatch(batch) {
    queue = null;
    Promise.resolve()
      .then(() => batchFn(batch.keys))
      .then((values) => {
        if (!Array.isArray(values) || values.length !== batch.keys.length) {
          throw new Error('Loader batch function must return an array the same length as its keys');
        }
        values.forEach((value, i) => {
          if (value instanceof Error) batch.resolvers[i].reject(value);
          else batch.resolvers[i].resolve(value);
        });
      })
      .catch((err) => {
        batch.resolvers.forEach(({ reject }) => reject(err));
      });
  }

  return {
    load(key) {
      const k = String(key);
      if (cache.has(k)) return cache.get(k);

      const promise = new Promise((resolve, reject) => {
        if (!queue) {
          queue = { keys: [], resolvers: [] };
          const batch = queue;
          // setImmediate: lets every sibling field resolver of the current list run first.
          setImmediate(() => dispatch(batch));
        }
        queue.keys.push(k);
        queue.resolvers.push({ resolve, reject });
      });
      cache.set(k, promise);
      return promise;
    },
  };
}

/** Loaders available to resolvers as `context.loaders`. Create one set per request. */
export function createLoaders(clients, logger) {
  return {
    /** userId -> profile as returned by usersClient.getProfileById (or null) */
    userProfile: createLoader((ids) =>
      Promise.all(
        ids.map((id) =>
          clients.users.getProfileById(id).catch((err) => (err instanceof Error ? err : new Error(String(err)))),
        ),
      ),
    ),

    /** cardId -> catalog card (normalised shape from catalogClient) or null */
    card: createLoader(async (ids) => {
      const normalized = ids.map(normalizeCatalogId);
      let found = [];
      try {
        found = await clients.catalog.getCardsBatch([...new Set(normalized)]);
      } catch (err) {
        logger?.warn?.(`card loader: batch fetch failed — ${err.message}`);
      }
      const byId = new Map(found.map((c) => [normalizeCatalogId(c.id || c.cardId), c]));

      // Anything the batch endpoint didn't return falls back to the single-card
      // lookup, which is what these resolvers used before batching.
      return Promise.all(
        ids.map(async (id, i) => {
          const hit = byId.get(normalized[i]);
          if (hit) return hit;
          try {
            return (await clients.catalog.getCard(id)) ?? null;
          } catch (err) {
            return err instanceof Error ? err : new Error(String(err));
          }
        }),
      );
    }),
  };
}
