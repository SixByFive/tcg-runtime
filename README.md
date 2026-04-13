# SixByFive TCG Runtime

Containerised microservices backend for the SixByFive TCG platform. Each domain runs as an independently deployable Node.js/Express service coordinated by Docker Compose.

## Quick Start

```bash
# Clone and enter the repo
git clone <repo-url>
cd tcg-runtime

# Copy and fill in secrets
cp env/.env.shared env/.env.shared.local
# edit env/.env.* files with real values

# Build and start all services
docker compose -f infra/compose/docker-compose.yml up --build -d

# Tail logs
docker compose -f infra/compose/docker-compose.yml logs -f
```

The public entry point is the **Gateway** at `http://localhost:4010`.

---

## Services at a Glance

| Service | Port | Responsibility |
|---|---|---|
| [Gateway](docs/api/gateway.md) | **4010** | GraphQL API — single entry point for clients |
| [Auth](docs/api/auth.md) | 4011 | Registration, login, OAuth, 2FA, sessions |
| [Catalog](docs/api/catalog.md) | 4012 | Cards, sets, pricing data |
| [Collections](docs/api/collections.md) | 4013 | User collections, wishlists, binders |
| [Marketplace](docs/api/marketplace.md) | 4014 | Listings, offers, orders, escrow |
| [Trading](docs/api/trading.md) | 4015 | P2P card trades |
| [Notifications](docs/api/notifications.md) | 4016 | In-app notifications and email |
| [Media](docs/api/media.md) | 4017 | File uploads and image serving |
| [Realtime](docs/api/realtime.md) | 4018 | WebSocket & SSE push events |
| [Payments](docs/api/payments.md) | 4019 | Subscriptions and transaction ledger |
| [Worker](docs/api/worker.md) | 4020 | Background cron jobs |
| [Users](docs/api/users.md) | 4021 | User profiles and account management |

Services communicate over the internal Docker network using `http://<container-name>:<port>`. Only the Gateway is exposed publicly.

---

## Documentation

| Doc | Description |
|---|---|
| [Architecture — Services](docs/architecture/services.md) | Service map, port list, dependency graph |
| [Architecture — Database Ownership](docs/architecture/database-ownership.md) | Which service owns which DB tables |
| [Architecture — Environment Variables](docs/architecture/environment.md) | All env vars and their defaults |
| [API — Auth](docs/api/auth.md) | Auth service routes (register, login, 2FA…) |
| [API — Marketplace](docs/api/marketplace.md) | Listings, offers, orders, Stripe escrow |
| [API — Payments](docs/api/payments.md) | Subscription plans and billing |
| [API — Realtime](docs/api/realtime.md) | WebSocket / SSE connection guide |
| [API — Internal](docs/api/internal.md) | Service-to-service internal endpoints |
| [Runbook — Local Development](docs/runbooks/local-development.md) | Running services locally without Docker |
| [Runbook — Deployment](docs/runbooks/deployment.md) | Deploying to a Linux VPS |
| [Runbook — Incident & Restart](docs/runbooks/incident-restart.md) | Service recovery procedures |

---

## Infrastructure

- **Database**: MySQL running on the host (`host.docker.internal:3306`)
- **Cache / Pub-Sub**: Redis container on port 6379
- **Payments**: Stripe Billing + Connect Express
- **Shipping**: EasyPost API
- **Auth providers**: Google Sign-In, Discord OAuth
- **Image processing**: Sharp (in media-service)

---

## Repository Layout

```
tcg-runtime/
├── apps/           # Service source code (one directory per service)
├── packages/       # Shared libraries (config, logger, database, contracts…)
├── env/            # Environment variable files (gitignored secrets)
├── infra/
│   └── compose/    # docker-compose.yml
└── docs/           # This documentation
```
