# Local Development Runbook

## Option A — Run everything in Docker (recommended)

The simplest way to run the full stack locally. Requires Docker Desktop.

```bash
# Build and start all services
docker compose -f infra/compose/docker-compose.yml up --build

# Or start only specific services (e.g. just auth + redis)
docker compose -f infra/compose/docker-compose.yml up --build redis auth-service

# Tail logs for one service
docker compose -f infra/compose/docker-compose.yml logs -f marketplace-service

# Rebuild a single service after code changes
docker compose -f infra/compose/docker-compose.yml up --build marketplace-service -d
```

---

## Option B — Run services natively (faster iteration)

Requires Node.js 22, pnpm, MySQL, and Redis installed locally.

### Initial setup
```bash
# Install dependencies
pnpm install

# Start MySQL and Redis (e.g. via Homebrew on Mac)
brew services start mysql
brew services start redis

# Create the database
mysql -u root -e "CREATE DATABASE sixbyfive_tcg CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Copy and fill env files (leave ENV_PROFILE empty to use localhost defaults)
cp env/.env.shared.example env/.env.shared
# edit env/.env.shared — set DB_USER, DB_PASS, etc.
```

### Run a single service
```bash
# From repo root
SERVICE_NAME=auth-service node apps/auth-service/src/index.js

# Or with pnpm filter
pnpm --filter @sbf/auth-service start
```

### Run all services (requires a process manager like `pm2` or just multiple terminals)
```bash
# With pm2
pnpm add -g pm2
pm2 start ecosystem.config.js  # (create this file if needed)
```

---

## Service URLs (local, no Docker)

| Service | URL |
|---|---|
| Gateway | http://localhost:4010 |
| Auth | http://localhost:4011 |
| Catalog | http://localhost:4012 |
| Collections | http://localhost:4013 |
| Marketplace | http://localhost:4014 |
| Trading | http://localhost:4015 |
| Notifications | http://localhost:4016 |
| Media | http://localhost:4017 |
| Realtime | http://localhost:4018 |
| Payments | http://localhost:4019 |
| Worker | http://localhost:4020 |
| Users | http://localhost:4021 |

---

## Testing Stripe webhooks locally

Use the [Stripe CLI](https://stripe.com/docs/stripe-cli) to forward Stripe events to your local services.

```bash
# Forward marketplace-service events
stripe listen --forward-to localhost:4014/webhooks/stripe

# Forward payments-service events
stripe listen --forward-to localhost:4019/webhooks/stripe
```

The CLI prints a webhook signing secret to paste into your `.env` files as `STRIPE_WEBHOOK_SECRET`.

---

## Testing EasyPost locally

Set `EASYPOST_API_KEY` to a test API key from the [EasyPost dashboard](https://www.easypost.com/account/api-keys). Test keys begin with `EZTKTEST…`. Test shipments are free and do not create real labels.

---

## Useful Docker commands

```bash
# Stop all services (keep volumes)
docker compose -f infra/compose/docker-compose.yml stop

# Stop and remove containers + networks (keep volumes)
docker compose -f infra/compose/docker-compose.yml down

# Full reset including volumes (DELETES all Redis data and uploaded files)
docker compose -f infra/compose/docker-compose.yml down -v

# Shell into a running container
docker exec -it Marketplace sh

# View resource usage
docker stats

# Check health of all services
docker compose -f infra/compose/docker-compose.yml ps
```

---

## Database access from host

Because `DB_HOST=host.docker.internal` in Docker, MySQL must be accessible from the host on port 3306. Make sure the MySQL user grants access from `%` (any host), not just `localhost`:

```sql
CREATE USER 'tcg'@'%' IDENTIFIED BY 'yourpassword';
GRANT ALL PRIVILEGES ON sixbyfive_tcg.* TO 'tcg'@'%';
FLUSH PRIVILEGES;
```
