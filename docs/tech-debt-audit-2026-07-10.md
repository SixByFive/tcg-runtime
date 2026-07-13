# tcg-runtime — Code Debt Audit

**Date:** 2026-07-10
**Scope:** Whole codebase (all `apps/*` services + `packages/*`)
**Category:** Code debt only (duplication, poor abstractions, magic numbers) — architecture, test, dependency, docs, and infra debt were out of scope for this pass.

Note: GitNexus MCP tools referenced in this repo's CLAUDE.md were not connected in this session, and the CLI (`npx gitnexus`) would require downloading an unverified package — that step was skipped. This audit was done via direct code search and reading, which covers the same ground for code-level debt.

## Prioritization framework

Priority = (Impact + Risk) × (6 − Effort), each scored 1–5. Higher = fix sooner.

## Findings, ranked

| # | Finding | Impact | Risk | Effort | Priority |
|---|---------|--------|------|--------|----------|
| 1 | Hardcoded service URL/port fallbacks (~30 sites) — already causing wrong-service calls | 4 | 5 | 2 | **36** |
| 2 | Auth middleware duplicated/diverged; payments-service admin check silently broken | 4 | 4 | 2 | **32** |
| 3 | "Relist listing" logic duplicated 4x in marketplace-service | 3 | 3 | 2 | **24** |
| 4 | Catalog-service magic numbers (concurrency/delay/timeout), unexplained | 2 | 2 | 1 | **20** |
| 5 | Marketplace `/buy` handler: 190-line god-function, manual compensating transactions | 4 | 5 | 4 | **18** |
| 6 | Inconsistent status-string conventions, no shared enums | 3 | 3 | 3 | **18** |
| 7 | Retry-with-backoff logic triplicated in catalog-service | 2 | 2 | 2 | **16** |
| 8 | Gateway `resolvers.js` god-file (2340 lines, all queries+mutations) | 4 | 3 | 4 | **14** |

## Detail

### 1. Hardcoded service URLs/ports (Priority 36)
`packages/config/src/index.js` exports `getServicePort()` specifically to centralize this — it's never called. Instead ~30 call sites hardcode `process.env.X_SERVICE_URL || 'http://localhost:PORT'`, including all of `apps/gateway/src/clients/*.js`, `apps/gateway/src/app.js:142,221,290,309,392`, and multiple marketplace/trading/shipping routes.

This has already caused live drift bugs: `apps/shipping-service/src/routes/internal.js:85-86` falls back to port `4021`/`4022` for marketplace/trading (actual ports: `4014`/`4015` — `4021`/`4022` are user-service and messaging-service). `apps/trading-service/src/routes/trades.js:409` defaults `PAYMENTS_SERVICE_URL` to `4016` (actual: `4019` — `4016` is notifications-service). If the env vars are ever unset, these services silently call the wrong backend.

**Business justification:** this is a live correctness bug in inter-service calls, not just style. Low effort to fix (swap in the existing `getServicePort()` helper everywhere) makes it the top-priority item.

### 2. Auth middleware duplication + broken admin check (Priority 32)
`apps/marketplace-service/src/middleware/auth.js` and `apps/payments-service/src/middleware/auth.js` both reimplement the same 31-line JWT/Bearer parsing instead of importing `@sbf/auth` (which every other service correctly re-exports). They diverged: marketplace checks `req.user?.isAdmin`, payments checks `req.user?.role !== 'admin'`. Since the JWT payload (`apps/auth-service/src/routes/auth.js:66,79,219`) only ever sets `isAdmin`, payments-service's `requireAdmin` is always-403. `apps/payments-service/src/routes/adminWallet.js:14` works around this by checking `isAdmin` directly, confirming the bug. `apps/catalog-service` adds a third, slightly different re-implementation.

**Business justification:** authz logic living in three divergent copies is a security-adjacent maintenance risk even though this particular bug fails closed. Low effort — consolidate onto `@sbf/auth`.

### 3. Duplicated "relist listing" logic (Priority 24)
The same status-transition block (`SOLD` → `ACTIVE` or increment quantity) is repeated verbatim at `apps/marketplace-service/src/routes/internal.js:156-158`, `orders.js:494-496`, `webhooks.js:106-108`, and `webhooks.js:137-139`. Should be one `relistListing(listing)` helper.

**Business justification:** this touches money-adjacent state (listings, orders); a fix applied in one copy and missed in another is how inventory/listing bugs happen.

### 4. Catalog-service magic numbers (Priority 20)
`apps/catalog-service/src/adapters/tcgdex.adapter.js:8-10,17` — `DETAIL_CONCURRENCY = 8`, `DETAIL_DELAY_MS = 120`, and a bare `15000`ms timeout with no comment on why, and no config knob to tune them.

**Business justification:** cheap fix (name + comment + move to config), meaningful for future tuning under load.

### 5. Marketplace `/buy` handler god-function (Priority 18)
`apps/marketplace-service/src/routes/listings.js:576-765` — one ~190-line handler mixing pricing math, an inline shipping-service `fetch()`, order creation, an inline payments-service `fetch()`, Stripe escrow PaymentIntent creation, and manual rollback of wallet/listing/order state on each failure path.

**Business justification:** this is the checkout path — highest business risk in the codebase — but decomposing it into a proper service layer is real effort, hence lower priority than the cheaper wins above despite high impact/risk.

### 6. Inconsistent status-string conventions (Priority 18)
`CardListing.status` uses uppercase (`ACTIVE`, `SOLD`, `PENDING_PROOF`, `CANCELLED`); `Offer.status`/`Order.fulfilmentStatus` use lowercase (`pending`, `expired`, `accepted`, `completed`, `shipped`). None are defined as shared constants/enums in `packages/contracts` or `packages/api-types` — just string literals with no typo protection.

### 7. Retry-backoff triplicated (Priority 16)
Same `await new Promise(r => setTimeout(r, 400 * Math.pow(1.6, i)))` backoff logic copy-pasted in `apps/catalog-service/src/adapters/tcgdex.adapter.js:27`, `jobs/fxDaily.job.js:42`, and `services/fx.service.js:121`.

### 8. Gateway `resolvers.js` god-file (Priority 14)
`apps/gateway/src/graphql/resolvers.js:57-2340` — a single object holding every Query (~880 lines) and Mutation (~1400 lines) resolver. High impact on gateway dev velocity, but splitting it per-domain (mirroring `apps/gateway/src/clients/`) is a larger, riskier effort — best done incrementally alongside feature work rather than as a standalone push.

## Phased remediation plan

**Phase 1 — quick, high-priority fixes (can ship this sprint alongside feature work):**
Wire `getServicePort()` into all ~30 hardcoded URL sites (#1); consolidate marketplace/payments/catalog auth middleware onto `@sbf/auth` and fix the payments admin-check divergence (#2).

**Phase 2 — money-adjacent consolidation:**
Extract `relistListing()` helper (#3); name/document/config-ify the catalog magic numbers (#4).

**Phase 3 — structural cleanup:**
Introduce shared status enums in `packages/contracts` or `packages/api-types` (#6); consolidate the triplicated retry/backoff logic into one helper (#7).

**Phase 4 — larger refactors, do incrementally alongside feature work:**
Decompose the marketplace `/buy` handler into a proper service layer with a real compensating-transaction pattern (#5); split the gateway `resolvers.js` god-file into per-domain modules (#8).
