---
id: sys-infra
title: Infrastructure & Configuration
type: system
created: "2026-05-08T00:00:00.000Z"
updated: "2026-05-08T00:00:00.000Z"
plans: [plan-production-readiness]
decisions: [DEC-0001, DEC-0008]
tags: [docker, mysql, redis, env, infra]
---

## Overview

All services run as Docker containers coordinated by a single `docker-compose.yml`. The database (MySQL) runs on the **host machine** and is reached by containers via `host.docker.internal:3306`.

## Key files

| File | Purpose |
|------|---------|
| `infra/compose/docker-compose.yml` | All service definitions, port bindings, dependencies |
| `env/.env.shared` | Shared defaults for all services (not committed) |
| `env/.env.<service>` | Per-service overrides (not committed) |
| `env/.env.shared.docker` | Docker-specific overrides (committed as template) |
| `infra/scripts/health-all.mjs` | Health check script (`pnpm health`) |

## Database

- Engine: MySQL on host (`host.docker.internal:3306` from containers, `localhost:3306` for local dev)
- Database: `sixbyfive_tcg`
- Single shared DB — each service owns specific tables (see sys-infra DB ownership)
- Schema management: `Model.sync({ alter: true })` in dev, `Model.sync({ force: false })` in prod
- Production schema changes require manual SQL migration before redeploy

## Cache / Pub-Sub

- Redis 7 container on port `6379`
- Used by: auth-service (session store), realtime-service (pub/sub fan-out)
- Local dev: Redis port is exposed on host for inspection
- Production: remove host binding, keep internal only

## Environment loading order

1. `env/.env.shared`
2. `env/.env.<service-name>`
3. `env/.env.shared.docker` (when `ENV_PROFILE=docker`)
4. `env/.env.<service-name>.docker` (if exists)

## Startup order

`Redis → Auth → Notifications → [Trading, Marketplace, Worker] → Gateway`
`Catalog`, `Collections`, `Media`, `Users` start immediately (no `depends_on` beyond Redis).

## Secrets required before production

- `ACCESS_TOKEN_SECRET` — shared across auth, gateway, marketplace, payments, realtime
- `INTERNAL_API_KEY` — shared across all service-to-service calls
- `DB_PASS`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `EASYPOST_API_KEY`, `GOOGLE_CLIENT_ID`, `DISCORD_CLIENT_ID/SECRET`
- `EMAIL_*` SMTP credentials
