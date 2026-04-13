# Service Architecture

## Service Map

```
                        ┌─────────────┐
                        │   Gateway   │  :4010  (public)
                        │  (GraphQL)  │
                        └──────┬──────┘
                               │ routes to
        ┌──────────────────────┼────────────────────────────┐
        │                      │                            │
   ┌────▼────┐          ┌──────▼──────┐           ┌────────▼───────┐
   │  Auth   │          │   Catalog   │           │  Collections   │
   │  :4011  │          │   :4012     │           │    :4013       │
   └────┬────┘          └─────────────┘           └────────────────┘
        │ Redis sessions
        │
        ▼
     ┌──────┐     ┌─────────────┐     ┌──────────────┐
     │Redis │     │  Marketplace│     │   Trading    │
     │:6379 │     │   :4014     │     │   :4015      │
     └──┬───┘     └──────┬──────┘     └──────┬───────┘
        │                │                   │
        │          ┌─────▼─────┐             │
        │          │  Worker   │             │
        │          │  :4020    │             │
        │          └─────┬─────┘             │
        │                │ notifies          │
        │         ┌──────▼──────┐            │
        └────────►│Notifications│◄───────────┘
                  │   :4016     │
                  └──────┬──────┘
                         │ pushes
                  ┌──────▼──────┐
                  │  Realtime   │  WebSocket / SSE
                  │   :4018     │
                  └─────────────┘

Payments :4019   (subscriptions — called by gateway/clients)
Media    :4017   (file uploads — called by any service or client)
Users    :4021   (profiles — called by gateway)
```

---

## Ports Reference

| Container name | Internal port | Host binding | Notes |
|---|---|---|---|
| Gateway | 4010 | `0.0.0.0:4010` | Public-facing |
| Auth | 4011 | internal only | |
| Catalog | 4012 | internal only | |
| Collections | 4013 | internal only | |
| Marketplace | 4014 | internal only | |
| Trading | 4015 | internal only | |
| Notifications | 4016 | internal only | |
| Media | 4017 | internal only | |
| Realtime | 4018 | internal only | Clients connect via Gateway proxy |
| Payments | 4019 | internal only | |
| Worker | 4020 | internal only | |
| Users | 4021 | internal only | |
| Redis | 6379 | `0.0.0.0:6379` | Host binding useful for local dev; remove in production |

---

## Startup Dependencies

Docker Compose `depends_on` ensures the following order:

```
Redis ──► Auth ──────────────────────────┐
     ──► Notifications ──► Trading        ├──► Gateway
                       ──► Marketplace    │
                       ──► Worker         │
     ──► Realtime                         │
Catalog ────────────────────────────────-┘
Users ───────────────────────────────────┘
```

Services that have no `depends_on` (Catalog, Collections, Media, Users) start immediately after Redis is healthy.

---

## Inter-Service Calls

All service-to-service HTTP calls use the internal Docker network hostname (container name) and require the `x-internal-key` header.

| Caller | Callee | Endpoint | Purpose |
|---|---|---|---|
| marketplace-service | notifications-service | `POST /internal/notify` | Notify buyer/seller of order events |
| marketplace-service | worker-service | `POST /internal/wishlist-match` | Fan-out wishlist alerts on listing activation |
| trading-service | notifications-service | `POST /internal/notify` | Notify parties of trade events |
| worker-service | notifications-service | `POST /internal/notify` | Deliver cron-triggered alerts |
| notifications-service | realtime-service | `POST /internal/push` | Deliver in-app push over WebSocket/SSE |
| payments-service | notifications-service | `POST /internal/notify` | Billing events (payment failure, renewal) |

---

## Authentication Flow

```
Client ──POST /auth/login──► Auth Service
                              └── validates credentials
                              └── sets HttpOnly cookies:
                                    sbf_access  (JWT, short-lived)
                                    sbf_refresh (opaque token, Redis-backed)

Client ──POST /auth/refresh──► Auth Service
                                └── validates sbf_refresh in Redis
                                └── rotates refresh token
                                └── issues new sbf_access

Client ──any authenticated request──► Gateway
                                       └── verifies sbf_access JWT
                                       └── injects user into request context
```

Mobile clients send `X-Client-Type: mobile` and receive tokens in the JSON response body instead of cookies.

---

## Technology Stack

| Concern | Technology |
|---|---|
| Runtime | Node.js 22 |
| Framework | Express 4 |
| ORM | Sequelize 6 (MySQL) |
| Cache / Pub-Sub | Redis 7 + ioredis |
| Real-time | ws (WebSocket) + SSE |
| Payments | Stripe (Billing + Connect) |
| Shipping | EasyPost |
| Image processing | Sharp |
| Scheduling | node-cron |
| Package manager | pnpm workspaces |
| Containers | Docker Compose |
