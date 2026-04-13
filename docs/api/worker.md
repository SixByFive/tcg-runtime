# Worker Service

**Direct (internal/dev):** `http://localhost:4020`

The worker service runs scheduled background jobs. It has no public-facing routes — it exposes only internal endpoints and a health check.

---

## Cron Jobs

All jobs run on the `Europe/London` timezone (configured via `CRON_TZ`).

| Job | Schedule | Description |
|---|---|---|
| `price-alerts` | Every 15 minutes | Check enabled price alerts; notify users when card price ≤ target |
| `offer-expiry` | Hourly at :30 | Expire `pending`/`countered` offers past their `expiresAt` |
| `escrow-expiry` | Daily at 09:00 | Warn on orders stuck in `authorised` state for ≥5 days |
| `trade-topup-expiry` | Daily at 09:05 | Warn on trades stuck in `TOP_UP_PENDING` for ≥5 days |

### Price Alerts
Reads all enabled `price_alerts` records. For each unique `(cardId, variant, currency)` combination, queries the price table (`PRICE_TABLE` env var, default `m_prices`). If `currentPrice ≤ targetPrice`, sends a `PRICE_ALERT` notification and sets a 24-hour cooldown before re-arming.

### Offer Expiry
Bulk-updates `offers` with `status IN ('pending', 'countered')` and `expiresAt ≤ NOW()` to `expired`. Sends a notification to each buyer.

### Escrow Expiry
Finds `marketplace_orders` with `paymentStatus = 'authorised'` and `fulfilmentStatus = 'awaiting_shipment'` where `authorisedAt ≤ NOW() - 5 days`. Warns both parties. On day 6, escalates to admin. Deduplicates via `metadataJson.escrowWarnedAt` / `escrowEscalatedAt` flags.

### Trade Top-Up Expiry
Finds `trades` with `status = 'TOP_UP_PENDING'` and `topUpPaidAt ≤ NOW() - 5 days`. Warns both parties.

---

## Internal Endpoints

All require `x-internal-key` header.

### `POST /internal/wishlist-match`
See [Internal API docs](internal.md#worker-service----httpworker-service4020).

### `POST /internal/run-job`
Manually trigger a job by name. Useful for admin debugging.

**Body:** `{ "job": "price-alerts | offer-expiry | escrow-expiry | trade-topup-expiry" }`

---

## Health

### `GET /health`
**Response `200`:** `{ "status": "ok", "service": "worker-service" }`
