---
id: sys-shared-packages
title: Shared Packages
type: system
created: "2026-05-08T00:00:00.000Z"
updated: "2026-05-08T00:00:00.000Z"
plans: []
decisions: []
tags: [packages, shared, library]
---

## Overview

Shared code lives in `packages/` as pnpm workspace packages under the `@sbf/` scope. Services import from these rather than duplicating logic.

## Packages

| Package | Import | Purpose |
|---------|--------|---------|
| `@sbf/auth` | `packages/auth` | JWT sign/verify, auth middleware factory |
| `@sbf/cache` | `packages/cache` | Redis client wrapper (ioredis) |
| `@sbf/config` | `packages/config` | Env var loading helpers |
| `@sbf/contracts` | `packages/contracts` | Internal API contracts (request/response types) |
| `@sbf/database` | `packages/database` | Sequelize instance factory, `checkDatabaseHealth()` |
| `@sbf/logger` | `packages/logger` | Structured logger (wraps pino or similar) |
| `@sbf/utils` | `packages/utils` | General utilities |

## Key notes

- `@sbf/database` — each service creates its own Sequelize instance. All instances connect to the same MySQL DB. Each service passes only its own models to `sync()`.
- `@sbf/auth` — `packages/auth/src/middleware.js` is the standard Express auth guard. Services import it to protect routes.
- `@sbf/contracts` — internal service endpoint contracts; keep in sync when internal routes change.
- `@sixbyfive/api-types` and `@sixbyfive/api-client` — generated TypeScript types and a typed API client from the gateway schema, used by the web frontend. Built by `pnpm codegen` / `pnpm build:packages`.
