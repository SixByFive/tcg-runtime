# tcg-runtime — quick reference (for future me)

Personal cheat sheet, not the polished onboarding doc — see [README.md](../README.md) for that. This is the stuff I don't want to have to rediscover.

## Get running fast

```bash
cp env/.env.shared env/.env.shared.local   # fill in real secrets
docker compose -f infra/compose/docker-compose.yml up --build -d
docker compose -f infra/compose/docker-compose.yml logs -f
```

Gateway is the only public entry point: `http://localhost:4010`. Everything else is internal-only, reached via `http://<container-name>:<port>` on the Docker network. MySQL runs on the host, not in a container — services reach it via `host.docker.internal:3306`.

Health check everything at once: `pnpm health` (or `pnpm health:core` / `pnpm health:strict`).

## Where things live

- Services: `apps/*-service/` and `apps/gateway`. Shared code: `packages/@sbf/*` — import from there, don't copy-paste (see gotchas below).
- Card hydration (turning a bare `cardId` into full card data) happens in **gateway resolvers**, not in collections-service — that's an intentional decision (DEC-0005), not an oversight.
- Cron/background jobs all live in `worker-service`, not scattered across domain services (DEC-0008).
- `.intent/` holds the actual reasoning — plans, decisions, systems. Run `intent status` or the `intent_status` MCP tool for a health check before assuming I remember why something is the way it is.

## Known landmines (from the 2026-07-10 code debt audit — see `docs/tech-debt-audit-2026-07-10.md`)

- **Service URLs are hardcoded in ~30 places** instead of using `packages/config`'s `getServicePort()`. This has already caused live bugs: shipping-service defaults to the wrong ports for marketplace/trading, trading-service defaults to the wrong port for payments, if the env vars are ever unset. Check this first if a service call silently 404s or hits the wrong backend.
- **payments-service's `requireAdmin` is broken** — it checks `req.user?.role`, but the JWT only ever sets `isAdmin`. Admin routes there quietly work around it by checking `isAdmin` directly instead of using the shared middleware. Fix by consolidating onto `@sbf/auth` rather than patching in place.
- **Marketplace `/buy` handler** (`listings.js:576-765`) is a 190-line function mixing pricing, two outbound service calls, Stripe escrow, and manual compensating-transaction rollback. Be careful editing this without re-reading the whole thing first — the rollback paths are easy to break silently.
- Status strings aren't real enums (`CardListing.status` is uppercase, `Offer.status`/`Order.fulfilmentStatus` is lowercase) — no compiler will catch a typo'd status value.

## Before touching anything

1. `intent agent prepare "<task>"` (or the MCP tool) to load relevant plans/decisions first.
2. After changes: `intent agent review` to check alignment and catch broken references, then commit `.intent/` alongside the code.
3. Two production-relevant plans are open: `plan-mobile-api` (active, gateway schema for the mobile app) and `plan-production-readiness` (still draft — worth pushing to active or archived once real).

## Stripe / payments status

Per DEC-0009: Stripe payments and EasyPost shipping are **deferred**, not implemented. Don't assume `payments-service` or shipping flows are production-ready just because the code exists.
