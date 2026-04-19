/**
 * @sbf/api-types — TypeScript types for the SBF TCG GraphQL schema.
 *
 * Re-run codegen after gateway schema changes:
 *   pnpm --filter @sbf/gateway schema:export   # update schema.graphql
 *   pnpm --filter @sbf/api-types codegen        # regenerate this package
 */
export * from './generated.js';
