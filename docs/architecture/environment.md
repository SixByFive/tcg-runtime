# Environment Variables

Environment files live in `env/` and are loaded in this order (later files override earlier):

1. `env/.env.shared` — defaults for all services
2. `env/.env.<service-name>` — service-specific values
3. `env/.env.shared.docker` — Docker overrides (applied when `ENV_PROFILE=docker`)
4. `env/.env.<service-name>.docker` — service + Docker overrides (if file exists)

> The `env/` directory is **not** committed to git. Copy from the examples below and fill in real values.

---

## Shared Variables (`env/.env.shared`)

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Node environment |
| `LOG_LEVEL` | `info` | Logger verbosity |
| `CRON_TZ` | `Europe/London` | Timezone for cron schedules |
| `DB_HOST` | `localhost` | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USER` | *(set this)* | MySQL username |
| `DB_PASS` | *(set this)* | MySQL password |
| `DB_NAME` | `sixbyfive_tcg` | MySQL database name |
| `FRONTEND_URL` | `https://tcg.sixbyfive.com` | Canonical frontend URL |
| `FRONTEND_BASE_URL` | `http://localhost:3000` | Local dev frontend base |
| `FRONTEND_PROFILE_PATH` | `/profile/:username` | Frontend profile URL template |

## Docker Overrides (`env/.env.shared.docker`)

| Variable | Value | Description |
|---|---|---|
| `NODE_ENV` | `production` | Forces production mode in containers |
| `DB_HOST` | `host.docker.internal` | Routes DB connections to host machine |
| `REDIS_URL` | `redis://redis:6379` | Redis container on Docker network |

---

## Auth Service (`env/.env.auth-service`)

| Variable | Description |
|---|---|
| `ACCESS_TOKEN_SECRET` | Secret for signing JWT access tokens |
| `REFRESH_TOKEN_SECRET` | Secret for signing refresh token payloads (if used) |
| `GOOGLE_CLIENT_ID` | Google OAuth app client ID |
| `DISCORD_CLIENT_ID` | Discord OAuth app client ID |
| `DISCORD_CLIENT_SECRET` | Discord OAuth app secret |
| `DISCORD_BOT_TOKEN` | Discord bot token (for guild membership checks) |
| `EMAIL_HOST` | SMTP host |
| `EMAIL_PORT` | SMTP port |
| `EMAIL_USER` | SMTP username |
| `EMAIL_PASS` | SMTP password |
| `EMAIL_FROM` | Sender address (`"SixByFive TCG" <noreply@…>`) |

---

## Marketplace Service (`env/.env.marketplace-service`)

| Variable | Default | Description |
|---|---|---|
| `ACCESS_TOKEN_SECRET` | *(required)* | Must match auth-service |
| `INTERNAL_API_KEY` | *(required)* | Shared internal service key |
| `NOTIFICATIONS_SERVICE_URL` | `http://localhost:4016` | Local dev; Docker uses container name |
| `REALTIME_SERVICE_URL` | `http://localhost:4018` | Local dev |
| `WORKER_SERVICE_URL` | `http://localhost:4020` | Local dev |
| `STRIPE_SECRET_KEY` | `sk_test_…` | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | Stripe webhook signing secret |
| `PLATFORM_FEE_PCT` | `5` | Platform fee percentage (e.g. `5` = 5%) |
| `EASYPOST_API_KEY` | `EZTKchange_me` | EasyPost API key |
| `PROOF_DIR` | `/var/uploads/marketplace_proofs` | Directory for proof images |
| `PROOF_MODERATION` | `auto` | `auto` or `manual` |
| `APP_URL` | `http://localhost:3000` | Used for Stripe Connect redirect URLs |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |

For Docker, add a `env/.env.marketplace-service.docker` file:
```
NOTIFICATIONS_SERVICE_URL=http://notifications-service:4016
REALTIME_SERVICE_URL=http://realtime-service:4018
WORKER_SERVICE_URL=http://worker-service:4020
APP_URL=https://tcg.sixbyfive.com
CORS_ORIGINS=https://tcg.sixbyfive.com
```

---

## Payments Service (`env/.env.payments-service`)

| Variable | Default | Description |
|---|---|---|
| `ACCESS_TOKEN_SECRET` | *(required)* | Must match auth-service |
| `INTERNAL_API_KEY` | *(required)* | Shared internal service key |
| `STRIPE_SECRET_KEY` | `sk_test_…` | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | Stripe webhook signing secret |
| `NOTIFICATIONS_SERVICE_URL` | `http://localhost:4016` | Notifications service |
| `APP_URL` | `http://localhost:3000` | Stripe redirect URLs |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed origins |

---

## Realtime Service (`env/.env.realtime-service`)

| Variable | Description |
|---|---|
| `ACCESS_TOKEN_SECRET` | Must match auth-service (used to verify JWT on WS/SSE connect) |
| `INTERNAL_API_KEY` | Shared internal service key |
| `CORS_ORIGINS` | Allowed origins for SSE connections |
| `REDIS_URL` | Redis connection string (set by `.env.shared.docker` in Docker) |

---

## Worker Service (`env/.env.worker-service`)

| Variable | Default | Description |
|---|---|---|
| `INTERNAL_API_KEY` | *(required)* | Shared internal service key |
| `NOTIFICATIONS_SERVICE_URL` | `http://localhost:4016` | Notifications service |
| `PRICE_TABLE` | `m_prices` | Catalog price table name |

---

## Secrets Checklist

Before going live, replace every placeholder with a real value:

- [ ] `ACCESS_TOKEN_SECRET` — generate with `openssl rand -hex 64`
- [ ] `INTERNAL_API_KEY` — generate with `openssl rand -hex 32`
- [ ] `DB_PASS` — strong MySQL password
- [ ] `STRIPE_SECRET_KEY` — from Stripe dashboard (use live key in production)
- [ ] `STRIPE_WEBHOOK_SECRET` — from Stripe webhook endpoint settings
- [ ] `EASYPOST_API_KEY` — from EasyPost dashboard
- [ ] `GOOGLE_CLIENT_ID` — from Google Cloud Console
- [ ] `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` — from Discord developer portal
- [ ] `EMAIL_*` — SMTP credentials
- [ ] `ADMIN_API_KEY` — catalog-service admin key (set in docker-compose env)
