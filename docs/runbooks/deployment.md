# Deployment Runbook

## Prerequisites

- Linux VPS with Docker ≥ 24 and Docker Compose v2 (`docker compose` not `docker-compose`)
- MySQL running on the host (not in a container)
- Git access to the repo
- Environment files filled in (see [Environment Variables](../architecture/environment.md))

---

## First-Time Setup

### 1. Install Docker
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# log out and back in
```

### 2. Clone the repo
```bash
git clone <repo-url> /opt/tcg-runtime
cd /opt/tcg-runtime
```

### 3. Create the database
```bash
mysql -u root -p -e "CREATE DATABASE sixbyfive_tcg CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 4. Set up environment files
```bash
# Shared
cp env/.env.shared.example env/.env.shared
nano env/.env.shared   # set DB_USER, DB_PASS, FRONTEND_URL, etc.

# Service-specific
cp env/.env.auth-service.example env/.env.auth-service
# fill in GOOGLE_CLIENT_ID, Discord credentials, SMTP details, ACCESS_TOKEN_SECRET

cp env/.env.marketplace-service.example env/.env.marketplace-service
# fill in STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, EASYPOST_API_KEY, INTERNAL_API_KEY

cp env/.env.payments-service.example env/.env.payments-service
# fill in STRIPE keys, INTERNAL_API_KEY

cp env/.env.realtime-service.example env/.env.realtime-service
# fill in ACCESS_TOKEN_SECRET, INTERNAL_API_KEY

cp env/.env.worker-service.example env/.env.worker-service
# fill in INTERNAL_API_KEY
```

Key values to generate:
```bash
openssl rand -hex 64   # for ACCESS_TOKEN_SECRET
openssl rand -hex 32   # for INTERNAL_API_KEY
```

### 5. Build and start
```bash
docker compose -f infra/compose/docker-compose.yml up --build -d
```

### 6. Verify all services are healthy
```bash
docker compose -f infra/compose/docker-compose.yml ps
# All services should show "healthy" after ~60 seconds
```

### 7. Register Stripe webhooks
In the Stripe dashboard, create webhook endpoints pointing to:
```
https://your-domain.com/webhooks/stripe     → marketplace-service (events: payment_intent.*, account.updated)
https://your-domain.com/webhooks/stripe     → payments-service (events: checkout.session.completed, invoice.*, customer.subscription.*)
```

> You'll need a reverse proxy (nginx, Caddy) to route these to the correct internal ports — see the nginx section below.

---

## Reverse Proxy (nginx)

Example nginx config to route the public domain to the gateway and expose webhook endpoints:

```nginx
server {
    listen 80;
    server_name tcg.sixbyfive.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name tcg.sixbyfive.com;

    ssl_certificate     /etc/letsencrypt/live/tcg.sixbyfive.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tcg.sixbyfive.com/privkey.pem;

    # Gateway (GraphQL API + all client-facing routes)
    location / {
        proxy_pass http://127.0.0.1:4010;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # SSE — disable buffering
    location /realtime/events {
        proxy_pass http://127.0.0.1:4018;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;
    }

    # WebSocket
    location /realtime/ws {
        proxy_pass http://127.0.0.1:4018;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Stripe webhooks for marketplace
    location /webhooks/stripe {
        # Route to marketplace-service or payments-service based on your setup
        proxy_pass http://127.0.0.1:4014;
    }
}
```

---

## Deploying Updates

```bash
cd /opt/tcg-runtime
git pull

# Rebuild only changed services (Docker layer cache handles unchanged ones)
docker compose -f infra/compose/docker-compose.yml up --build -d

# Watch for startup errors
docker compose -f infra/compose/docker-compose.yml logs -f --tail=100
```

---

## Memory Budget (4 GB VPS)

| Service | Limit |
|---|---|
| Redis | 192 MB |
| Gateway | 256 MB |
| Auth | 256 MB |
| Users | 256 MB |
| Catalog | 320 MB |
| Collections | 256 MB |
| Media | 320 MB |
| Notifications | 256 MB |
| Trading | 256 MB |
| Marketplace | 256 MB |
| Realtime | 192 MB |
| Worker | 192 MB |
| Payments | 256 MB |
| **Total containers** | **~3,264 MB** |
| OS + MySQL | ~600 MB |
| **Headroom** | ~130 MB |

---

## Updating the lockfile (after adding dependencies)

Because Dockerfiles use `--no-frozen-lockfile`, new deps install fine during build. However, once stable, regenerate the lockfile locally and commit it:

```bash
pnpm install
git add pnpm-lock.yaml
git commit -m "chore: regenerate lockfile"
```

Then you can switch Dockerfiles back to `--frozen-lockfile` for deterministic builds.
