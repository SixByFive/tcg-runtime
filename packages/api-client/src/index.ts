/**
 * @sixbyfive/api-client
 *
 * Typed GraphQL client for the SBF TCG platform.
 * Works in browser, Node.js (≥18), and React Native — no framework lock-in.
 *
 * ## Quick start (fetch client)
 *
 * ```ts
 * import { SbfApiClient, MyCollectionDocument } from '@sixbyfive/api-client';
 *
 * const client = new SbfApiClient({
 *   url: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4010/graphql',
 *   getToken: () => sessionStorage.getItem('token'),
 * });
 *
 * const { myCollection } = await client.execute(MyCollectionDocument, {});
 * ```
 *
 * ## With Apollo Client (web)
 *
 * ```tsx
 * import { useQuery } from '@apollo/client';
 * import { MyCollectionDocument } from '@sixbyfive/api-client';
 *
 * function Component() {
 *   const { data } = useQuery(MyCollectionDocument);
 *   return <div>{data?.myCollection.length} cards</div>;
 * }
 * ```
 *
 * ## With React Query / TanStack Query (web or React Native)
 *
 * ```ts
 * import { useQuery } from '@tanstack/react-query';
 * import { SbfApiClient, SearchCardsDocument } from '@sixbyfive/api-client';
 *
 * const client = new SbfApiClient({ getToken: () => getAuthToken() });
 *
 * function useCardSearch(query: string) {
 *   return useQuery({
 *     queryKey: ['cards', query],
 *     queryFn: () =>
 *       client.execute(SearchCardsDocument, { input: { query } })
 *             .then(d => d.searchCards),
 *   });
 * }
 * ```
 *
 * ## Regenerating after schema changes
 *
 * ```bash
 * pnpm --filter @sbf/gateway schema:export           # update schema.graphql in api-types
 * pnpm --filter @sixbyfive/api-types codegen         # regenerate TypeScript types
 * pnpm --filter @sixbyfive/api-client codegen        # regenerate typed documents
 * ```
 */

// ── Core client ───────────────────────────────────────────────────────────────
export {
  SbfApiClient,
  GqlError,
  executeOperation,
  DEFAULT_GRAPHQL_URL,
} from './client.js';
export type { SbfClientConfig, GqlErrorDetail } from './client.js';

// ── Schema types (re-exported for convenience) ────────────────────────────────
export type * from '@sixbyfive/api-types';

// ── Typed operation documents — by domain ─────────────────────────────────────
export * from './documents/auth.js';
export * from './documents/users.js';
export * from './documents/collection.js';
export * from './documents/wishlist.js';
export * from './documents/binders.js';
export * from './documents/catalog.js';
export * from './documents/notifications.js';
export * from './documents/messaging.js';
export * from './documents/marketplace.js';
export * from './documents/trading.js';
export * from './documents/achievements.js';
export * from './documents/price-alerts.js';
export * from './documents/safety.js';
export * from './documents/subscriptions.js';
export * from './documents/discord.js';
export * from './documents/admin.js';
