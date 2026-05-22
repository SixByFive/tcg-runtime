<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **tcg-runtime** (3612 symbols, 6281 relationships, 296 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/tcg-runtime/context` | Codebase overview, check index freshness |
| `gitnexus://repo/tcg-runtime/clusters` | All functional areas |
| `gitnexus://repo/tcg-runtime/processes` | All execution flows |
| `gitnexus://repo/tcg-runtime/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

<!-- intent-context:start -->

## Intent Context

### Agent Instructions

This project uses [Intent](https://github.com/SixByFive/intent) to track the *why* behind code.
When `.intent/` is present, follow these rules:

1. **Before starting a task** — call `intent agent prepare "<task>"` or the `intent_agent_prepare` MCP tool to load relevant plans and decisions.
2. **After making changes** — call `intent agent review` or `intent_agent_review` to verify alignment and catch broken references.
3. **If you made an architectural decision** not covered by an existing record, create one: `intent decision add` or let `intent agent review` scaffold it interactively.
4. **If a plan's work is complete**, update its `status` to `archived` in the frontmatter.
5. **Commit `.intent/` files** alongside the code changes they describe.

### Active Plans

**plan-mobile-api** — Gateway schema for mobile app (tcg-mob) compatibility `[active]`
System: sys-gateway

> ## Goal
> Ensure the gateway GraphQL schema fully supports the SixByFive TCG mobile app (`sixbyfive-tcg-mob`), which migrated from the old WordPress backend to tcg-runtime.
> ## Reason

**plan-production-readiness** — Production deployment readiness `[draft]`
System: sys-infra

> ## Goal
> Complete all outstanding work items required before the tcg-runtime backend can receive production traffic.
> ## Reason

### Architectural Decisions

**DEC-0001** — Single shared MySQL database with per-service table ownership `[active]`
System: sys-infra

> ## Context
> Microservice architectures typically use one database per service for true isolation. However, this has high operational overhead (many DB instances, complex cross-service joins, eventual consistency). For an early-stage platform, a single MySQL database with logical separation is a pragmatic trade-off.

**DEC-0002** — Gateway-first architecture — all external traffic through GraphQL gateway `[active]`
System: sys-gateway

> ## Context
> With 10+ microservices, clients (web, mobile) cannot talk to each service independently — the surface area is too large, versioning becomes a nightmare, and auth would need to be duplicated everywhere.

**DEC-0003** — Mobile clients receive JWT in response body, not cookies `[active]`
System: sys-auth

> ## Context
> Web clients use HttpOnly cookies (`sbf_access`, `sbf_refresh`) for token storage — this is the most secure option for browsers. Mobile apps cannot use HttpOnly cookies in the same way; they store tokens in secure storage (e.g. `expo-secure-store`) and attach them as `Authorization: Bearer` headers.

**DEC-0004** — Inter-service calls use x-internal-key header over Docker network `[active]`
System: sys-infra

> ## Context
> Services need to call each other (e.g. marketplace notifies notifications-service). These calls must be authenticated to prevent spoofing, but a full JWT flow would be circular and slow.

**DEC-0005** — Card hydration happens in gateway resolvers, not in collections-service `[active]`
System: sys-gateway

> ## Context
> Collection/wishlist/binder entries in collections-service store only `cardId` + user metadata (quantity, condition, etc.). Clients need full card data (name, images, prices, set). Two options:

**DEC-0006** — searchCards and cardsearchSearchCards are both valid aliases `[active]`
System: sys-gateway

> ## Context
> The gateway schema has two query fields that do the same thing:

**DEC-0007** — Realtime service accessed via gateway proxy, not directly by clients `[active]`
System: sys-messaging

> ## Context
> Clients (mobile, web) need real-time push events (chat messages, notification badges, trade updates). Options: expose realtime-service directly (another public port) or proxy through the gateway.

**DEC-0008** — Worker service owns all scheduled cron jobs `[active]`
System: sys-infra

> ## Context
> Background tasks (escrow expiry, offer expiry, price alert checks, wishlist fan-out) could live inside their respective domain services or be centralised in a dedicated worker.

**DEC-0009** — Stripe / payments deferred; EasyPost removed `[active]`
System: sys-marketplace

> ## Decision
> Stripe integration (payments-service, marketplace-service checkout, webhook handling) is **deferred from the initial production launch**.

### Systems

**sys-auth** — Auth Service

> ## Overview
> Auth-service (port `4011`) owns all authentication and session management. It is the only issuer of JWTs in the system. All other services that verify tokens must share `ACCESS_TOKEN_SECRET`.

**sys-catalog** — Catalog Service

> ## Overview
> Catalog-service (port `4012`) is the authoritative source for all card, set, and pricing data. It is a read-heavy service — no user writes.

**sys-collections** — Collections Service

> ## Overview
> Collections-service (port `4013`) manages all user-owned card data: their personal collection, wishlist, binders, and price alerts.

**sys-gateway** — GraphQL Gateway

> ## Overview
> The Gateway is the single public entry point for all clients (web, mobile). It runs on port `4010` and exposes a unified GraphQL API that fans out to downstream microservices.

**sys-infra** — Infrastructure & Configuration

> ## Overview
> All services run as Docker containers coordinated by a single `docker-compose.yml`. The database (MySQL) runs on the **host machine** and is reached by containers via `host.docker.internal:3306`.

**sys-marketplace** — Marketplace Service

> ## Overview
> Marketplace-service (port `4014`) handles peer-to-peer card sales: listings, offers, orders, Stripe Connect payments, EasyPost shipping labels, and provenance tracking.

**sys-messaging** — Realtime Service & Messaging

> ## Overview
> Realtime-service (port `4018`) delivers live events to connected clients via WebSocket and SSE. It is the final hop for all push notifications, chat messages, and live feed updates. Clients connect indirectly — the gateway proxies the connection.

**sys-shared-packages** — Shared Packages

> ## Overview
> Shared code lives in `packages/` as pnpm workspace packages under the `@sbf/` scope. Services import from these rather than duplicating logic.

<!-- intent-context:end -->
