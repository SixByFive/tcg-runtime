/**
 * @sixbyfive/api-client — lightweight fetch-based GraphQL client.
 *
 * Works in browser, Node.js (≥18), and React Native.
 * No runtime dependencies beyond `graphql` (for `print`) and
 * `@graphql-typed-document-node/core` (for type inference).
 *
 * @example Basic usage
 * ```ts
 * import { SbfApiClient, MyCollectionDocument } from '@sixbyfive/api-client';
 *
 * const client = new SbfApiClient({
 *   url: process.env.NEXT_PUBLIC_API_URL,
 *   getToken: () => localStorage.getItem('token'),
 * });
 *
 * const { myCollection } = await client.execute(MyCollectionDocument, {});
 * ```
 *
 * @example With Apollo Client (no client instance needed)
 * ```tsx
 * import { useQuery } from '@apollo/client';
 * import { MyCollectionDocument } from '@sixbyfive/api-client';
 *
 * const { data } = useQuery(MyCollectionDocument);
 * ```
 *
 * @example With React Query / TanStack Query
 * ```ts
 * import { useQuery } from '@tanstack/react-query';
 * import { SbfApiClient, MyCollectionDocument } from '@sixbyfive/api-client';
 *
 * const client = new SbfApiClient({ getToken: () => getAuthToken() });
 *
 * function useMyCollection() {
 *   return useQuery({
 *     queryKey: ['myCollection'],
 *     queryFn: () => client.execute(MyCollectionDocument, {}).then(d => d.myCollection),
 *   });
 * }
 * ```
 */

import { print } from 'graphql';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';

export const DEFAULT_GRAPHQL_URL = 'http://localhost:4010/graphql';

/** Options for constructing a client instance. */
export interface SbfClientConfig {
  /**
   * Full URL to the GraphQL endpoint.
   * @default 'http://localhost:4010/graphql'
   */
  url?: string;
  /**
   * Called before each request to retrieve the current auth token.
   * Return `null` or `undefined` to make an unauthenticated request.
   */
  getToken?: () => string | null | undefined;
  /**
   * Static bearer token. Prefer `getToken` when the token can change
   * (e.g. after a refresh).
   */
  token?: string;
  /** Extra headers merged into every request. */
  headers?: Record<string, string>;
}

/** A single GraphQL error detail as returned by the server. */
export interface GqlErrorDetail {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
}

/**
 * Thrown when the GraphQL server responds with one or more `errors`.
 * The `errors` property contains the full array for inspection.
 */
export class GqlError extends Error {
  readonly errors: GqlErrorDetail[];

  constructor(errors: GqlErrorDetail[]) {
    super(errors.map((e) => e.message).join('; '));
    this.name = 'GqlError';
    this.errors = errors;
  }
}

/** Internal response envelope. */
interface GqlEnvelope<T> {
  data?: T;
  errors?: GqlErrorDetail[];
}

/**
 * Execute a single GraphQL operation using plain `fetch`.
 *
 * Use this for one-off calls when you do not need a persistent client
 * instance. For repeated use, prefer {@link SbfApiClient}.
 */
export async function executeOperation<TData, TVariables>(
  document: TypedDocumentNode<TData, TVariables>,
  variables: TVariables,
  config: SbfClientConfig = {},
): Promise<TData> {
  const url = config.url ?? DEFAULT_GRAPHQL_URL;
  const token = config.getToken?.() ?? config.token;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...config.headers,
    },
    body: JSON.stringify({
      query: print(document),
      variables,
    }),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const json: GqlEnvelope<TData> = await res.json() as GqlEnvelope<TData>;

  if (json.errors && json.errors.length > 0) {
    throw new GqlError(json.errors);
  }

  if (json.data === undefined || json.data === null) {
    throw new Error('GraphQL response contained no data');
  }

  return json.data;
}

/**
 * Stateful GraphQL client.
 *
 * Construct once (e.g. at app startup), then call `.execute()` for
 * each operation. The config — including the `getToken` callback — is
 * evaluated fresh on every request so token refreshes are transparent.
 */
export class SbfApiClient {
  private config: SbfClientConfig;

  constructor(config: SbfClientConfig = {}) {
    this.config = config;
  }

  /** Execute any typed GraphQL document and return the strongly-typed result. */
  execute<TData, TVariables>(
    document: TypedDocumentNode<TData, TVariables>,
    variables: TVariables,
    overrides?: Partial<SbfClientConfig>,
  ): Promise<TData> {
    return executeOperation(document, variables, { ...this.config, ...overrides });
  }

  /** Return a new client with merged config. The original is unchanged. */
  withConfig(overrides: Partial<SbfClientConfig>): SbfApiClient {
    return new SbfApiClient({ ...this.config, ...overrides });
  }

  /** Return a new client authenticated with the given static token. */
  withToken(token: string): SbfApiClient {
    return new SbfApiClient({ ...this.config, token, getToken: undefined });
  }
}
