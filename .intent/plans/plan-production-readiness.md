---
id: plan-production-readiness
title: Production deployment readiness
type: plan
status: draft
created: "2026-05-08T00:00:00.000Z"
updated: "2026-05-14T00:00:00.000Z"
system: sys-infra
decisions: [DEC-0001, DEC-0004, DEC-0009]
constraints: [CON-0001, CON-0002]
tags: [production, deployment, security]
---

## Goal

Complete all outstanding work items required before the tcg-runtime backend can receive production traffic.

## Reason

The backend is functionally complete for local development. Several secrets, config values, and operational gaps must be resolved before going live.

## Checklist

### Secrets (all must be replaced before deploy)

- [ ] `ACCESS_TOKEN_SECRET` — `openssl rand -hex 64` — must match across auth, gateway, marketplace, payments, realtime
- [ ] `INTERNAL_API_KEY` — `openssl rand -hex 32` — shared across all services
- [ ] `DB_PASS` — strong MySQL root/user password
- [ ] `STRIPE_SECRET_KEY` — use live key (not `sk_test_`) *(deferred — not required for initial launch)*
- [ ] `STRIPE_WEBHOOK_SECRET` — from Stripe webhook endpoint settings *(deferred)*
- [ ] `GOOGLE_CLIENT_ID` — from Google Cloud Console
- [ ] `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` / `DISCORD_BOT_TOKEN`
- [ ] `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`
- [ ] `ADMIN_API_KEY` — catalog-service admin operations

### Infrastructure

- [ ] Remove Redis host port binding (`6379:6379`) from docker-compose — internal only in prod
- [ ] Set `NODE_ENV=production` in docker env (already handled by `.env.shared.docker`)
- [ ] Configure MySQL prod credentials and ensure `sixbyfive_tcg` database exists
- [ ] Set `CORS_ORIGINS` to `https://tcg.sixbyfive.com` in marketplace/payments docker env files
- [ ] Set `APP_URL` to `https://tcg.sixbyfive.com` in marketplace docker env

### Domain & TLS

- [ ] Assign production domain for the gateway (e.g. `api.sixbyfive.com` or subdomain)
- [ ] Configure reverse proxy (nginx/Caddy) with TLS in front of gateway port 4010
- [ ] Update mobile app `app.json` `EXPO_PUBLIC_GRAPHQL_ENDPOINT` to production gateway URL
- [ ] Update mobile app `EXPO_PUBLIC_SOCKET_URL` to production realtime URL
- [ ] Set `EXPO_PUBLIC_DEV_MODE: false` in mobile app before production build

### Pre-launch verification

- [ ] Run `pnpm health:strict` — all services healthy
- [ ] Test login/register flow (web + mobile)
- [ ] Test Stripe webhook delivery from Stripe dashboard *(deferred)*
- [ ] Test card search, collection, binder CRUD
- [ ] Test messaging (send/receive, unread badge)
- [ ] Test push notification delivery on real device
- [ ] Verify worker cron jobs fire at expected times
