---
id: sys-auth
title: Auth Service
type: system
created: "2026-05-08T00:00:00.000Z"
updated: "2026-05-08T00:00:00.000Z"
plans: [plan-production-readiness]
decisions: [DEC-0003, DEC-0004]
tags: [auth, jwt, oauth, 2fa]
---

## Overview

Auth-service (port `4011`) owns all authentication and session management. It is the only issuer of JWTs in the system. All other services that verify tokens must share `ACCESS_TOKEN_SECRET`.

## Key responsibilities

- Register / login with email+password
- Google OAuth and Discord OAuth flows
- TOTP-based two-factor authentication (enable, verify, disable)
- Password reset via email
- JWT access token issuance (short-lived)
- Redis-backed refresh token rotation (opaque token in `sbf_refresh` cookie)

## Token delivery

| Client type | Access token | Refresh token |
|-------------|-------------|---------------|
| Web | `sbf_access` HttpOnly cookie | `sbf_refresh` HttpOnly cookie |
| Mobile (`X-Client-Type: mobile`) | JSON body `{ token, user }` | JSON body |

The gateway middleware reads `sbf_access` cookie OR `Authorization: Bearer <token>` header.

## Key files

| File | Purpose |
|------|---------|
| `apps/auth-service/src/routes/` | Login, register, OAuth, 2FA, password reset routes |
| `apps/auth-service/src/services/` | Auth business logic |
| `apps/auth-service/src/models/` | User model (table owner: `users`) |
| `apps/auth-service/src/middleware/` | Auth guard middleware |
| `packages/auth/src/` | Shared JWT verify/sign helpers (`@sbf/auth`) |

## Database ownership

Owns: `users`
Sessions: Redis (not a DB table — `sbf_refresh` token keyed by UUID, expires with TTL)

## Environment

`ACCESS_TOKEN_SECRET` must match across auth-service, gateway, marketplace-service, payments-service, and realtime-service.
