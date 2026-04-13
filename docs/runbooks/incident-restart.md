# Incident & Restart Runbook

## Quick Reference — Service Health Checks

```bash
# Check all containers
docker compose -f infra/compose/docker-compose.yml ps

# Check a specific service's health
curl http://localhost:4010/health   # gateway
curl http://localhost:4011/health   # auth
curl http://localhost:4012/health   # catalog
curl http://localhost:4013/health   # collections
curl http://localhost:4014/health   # marketplace
curl http://localhost:4015/health   # trading
curl http://localhost:4016/health   # notifications
curl http://localhost:4017/health   # media
curl http://localhost:4018/health   # realtime
curl http://localhost:4019/health   # payments
curl http://localhost:4020/health   # worker
curl http://localhost:4021/health   # users
```

---

## Restarting a Single Service

```bash
# Restart without rebuilding (fastest — uses existing image)
docker compose -f infra/compose/docker-compose.yml restart marketplace-service

# Restart with rebuild (after code changes)
docker compose -f infra/compose/docker-compose.yml up --build -d marketplace-service
```

---

## Viewing Logs

```bash
# All services (last 100 lines + follow)
docker compose -f infra/compose/docker-compose.yml logs -f --tail=100

# Single service
docker compose -f infra/compose/docker-compose.yml logs -f marketplace-service

# Since a timestamp
docker compose -f infra/compose/docker-compose.yml logs --since 2025-01-15T12:00:00 marketplace-service
```

---

## Common Failures

### Service exits with code 1 on startup

**Symptom:** `exited with code 1 (restarting)` in `docker ps`.

**Steps:**
```bash
docker compose -f infra/compose/docker-compose.yml logs marketplace-service | tail -20
```

Common causes:
- **DB connection refused** — MySQL not running, or `host.docker.internal` not resolving. Check `extra_hosts` is in docker-compose.yml for that service.
- **Missing env variable** — Check `env/.env.<service-name>` has all required values.
- **Port conflict** — Another process using the same port. Check with `lsof -i :4014`.

---

### Redis connection errors (realtime-service)

**Symptom:** `[realtime-service:redis] Redis error: …` flooding logs.

**Check:**
```bash
# Is Redis healthy?
docker compose -f infra/compose/docker-compose.yml ps redis
docker exec -it Redis redis-cli ping  # should return PONG

# Check REDIS_URL is being loaded
docker exec -it Realtime printenv REDIS_URL
# Should be: redis://redis:6379
```

If `REDIS_URL` is missing, the `env/` directory was not copied into the image. Rebuild:
```bash
docker compose -f infra/compose/docker-compose.yml up --build -d realtime-service
```

---

### Marketplace exits — DB sync failure

**Symptom:** `Failed to start: <error about MySQL>`.

**Check MySQL is reachable from the container:**
```bash
docker exec -it Marketplace sh -c "nc -zv host.docker.internal 3306"
```

If it fails, `host.docker.internal` is not resolving. Verify the `extra_hosts` entry is in the compose file and recreate the container:
```bash
docker compose -f infra/compose/docker-compose.yml up -d --force-recreate marketplace-service
```

---

### Gateway 503 — upstream service unhealthy

**Symptom:** GraphQL requests return 503 or upstream errors.

**Steps:**
1. Check all upstream services are healthy: `docker compose … ps`
2. Check which service the gateway depends on is down
3. Restart the failing service, wait for it to become healthy, gateway will recover automatically

---

### Stripe webhook signature failures

**Symptom:** `Stripe webhook signature failure` in marketplace or payments logs.

**Cause:** `STRIPE_WEBHOOK_SECRET` doesn't match the endpoint registered in Stripe dashboard.

**Fix:**
1. Go to Stripe Dashboard → Webhooks → your endpoint → reveal signing secret
2. Update `env/.env.marketplace-service` or `env/.env.payments-service`
3. Restart the affected service

---

### Escrow stuck — manually trigger admin job

If the escrow-expiry cron job needs to run immediately:

```bash
curl -X POST http://localhost:4020/internal/run-job \
  -H "Content-Type: application/json" \
  -H "x-internal-key: <INTERNAL_API_KEY>" \
  -d '{"job": "escrow-expiry"}'
```

Available jobs: `escrow-expiry`, `offer-expiry`, `price-alerts`, `trade-topup-expiry`

---

### Clear Redis cache (sessions/brute-force counters)

```bash
docker exec -it Redis redis-cli FLUSHDB
```

> ⚠️ This logs out all users and resets all brute-force counters. Use only in an emergency.

---

## Full Restart (all services)

```bash
docker compose -f infra/compose/docker-compose.yml restart
```

Or for a clean restart:
```bash
docker compose -f infra/compose/docker-compose.yml down
docker compose -f infra/compose/docker-compose.yml up -d
```

---

## Checking Memory Usage

```bash
docker stats --no-stream
```

If a service is near its `mem_limit`, it may OOM-exit (code 137). Increase the limit in `docker-compose.yml` and update `NODE_OPTIONS: --max-old-space-size=<N>` proportionally (~80% of mem_limit in MB).

---

## Admin Operations

### Manually approve a marketplace proof

```bash
curl -X POST http://localhost:4014/marketplace/admin/listings/<listingId>/approve-proof \
  -H "x-internal-key: <INTERNAL_API_KEY>"
```

### Resolve a dispute

```bash
curl -X POST http://localhost:4014/marketplace/admin/disputes/<disputeId>/resolve \
  -H "Content-Type: application/json" \
  -H "x-internal-key: <INTERNAL_API_KEY>" \
  -d '{"resolution": "buyer", "note": "Seller did not ship"}'
```

### Create a subscription plan

```bash
curl -X POST http://localhost:4019/payments/admin/plans \
  -H "Content-Type: application/json" \
  -H "x-internal-key: <INTERNAL_API_KEY>" \
  -d '{
    "name": "Pro",
    "description": "For serious collectors",
    "price": 4.99,
    "interval": "month",
    "feeDiscount": 20,
    "featuresJson": ["Lower marketplace fees"],
    "sortOrder": 1
  }'
```

### Broadcast a system notification to all users

```bash
curl -X POST http://localhost:4016/internal/broadcast \
  -H "Content-Type: application/json" \
  -H "x-internal-key: <INTERNAL_API_KEY>" \
  -d '{
    "type": "SYSTEM",
    "title": "Scheduled maintenance",
    "body": "We will be down briefly at midnight UTC for maintenance."
  }'
```

### Broadcast a realtime message to all connected clients

```bash
curl -X POST http://localhost:4018/internal/broadcast \
  -H "Content-Type: application/json" \
  -H "x-internal-key: <INTERNAL_API_KEY>" \
  -d '{"event": "broadcast", "data": {"message": "Site maintenance in 10 minutes"}}'
```
