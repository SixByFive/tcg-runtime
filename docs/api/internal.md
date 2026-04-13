# Internal Service API

These endpoints are **not exposed publicly** through the Gateway. They are called only by other services over the internal Docker network using the shared `INTERNAL_API_KEY`.

All internal requests must include:
```
x-internal-key: <INTERNAL_API_KEY>
```

Requests without a valid key receive `401 Unauthorized`.

---

## Notifications Service — `http://notifications-service:4016`

### `POST /internal/notify`
Send an in-app notification to a user (and optionally an email).

**Body:**
```json
{
  "userId": "string (required)",
  "type": "notification_type_constant",
  "title": "string (required)",
  "body": "string (required)",
  "iconUrl": "string (optional)",
  "linkUrl": "string (optional)",
  "meta": { },
  "userEmail": "string (optional — send email too)",
  "isSilent": false,
  "expiresAt": "ISO date (optional)"
}
```

**Notification types:**
| Constant | Description |
|---|---|
| `SYSTEM` | Platform announcements |
| `TRADE_OFFER` | Incoming trade offer |
| `TRADE_COMPLETE` | Trade completed |
| `TRADE_DECLINED` | Trade declined |
| `MESSAGE` | Direct message |
| `CHAT_MENTION` | Mentioned in chat |
| `PRICE_ALERT` | Card price hit target |
| `ACHIEVEMENT_UNLOCKED` | Badge / achievement |
| `LISTING_SOLD` | Seller's listing sold |
| `ORDER_PLACED_BUYER` | Order confirmed (buyer) |
| `ORDER_PLACED_SELLER` | New sale (seller) |
| `ORDER_FULFILMENT_UPDATE` | Shipping update |
| `SUBSCRIPTION` | Subscription event |
| `PAYMENT_FAILURE` | Billing payment failed |
| `INFO` | General information |
| `WARNING` | Warning message |
| `ERROR` | Error notification |
| `REMINDER` | Reminder |

**Response `200`:** `{ "ok": true }`

---

### `POST /internal/broadcast`
Send a notification to all users.

**Body:** Same as `/internal/notify` minus `userId`.

---

## Realtime Service — `http://realtime-service:4018`

### `POST /internal/push`
Deliver a realtime event to one or more connected users.

**Body (single user):**
```json
{ "userId": "string", "event": "notification", "data": { … } }
```

**Body (multiple users):**
```json
{ "userIds": ["u1", "u2"], "event": "price_alert", "data": { … } }
```

**Response `200`:** `{ "ok": true }`

### `POST /internal/broadcast`
Deliver an event to **all** connected clients.

**Body:** `{ "event": "broadcast", "data": { "message": "…" } }`

**Response `200`:** `{ "ok": true }`

---

## Worker Service — `http://worker-service:4020`

### `POST /internal/wishlist-match`
Trigger wishlist fan-out for a newly activated listing. Called by marketplace-service when a listing goes ACTIVE. Returns immediately; fan-out runs asynchronously.

**Body:**
```json
{
  "cardId": "string",
  "listingId": "string",
  "title": "string",
  "price": 12.50,
  "condition": "NM"
}
```

**Response `200`:** `{ "ok": true }`

The worker queries users who have this `cardId` in a wishlist (up to 200) and fires a `PRICE_ALERT` notification for each.

### `POST /internal/run-job`
Manually trigger a background cron job (useful for admin/debug).

**Body:**
```json
{ "job": "escrow-expiry | offer-expiry | price-alerts | trade-topup-expiry" }
```

**Response `200`:** `{ "ok": true, "job": "escrow-expiry" }`

---

## Payments Service — `http://payments-service:4019`

### `GET /internal/subscription/:userId`
Check a user's active subscription tier. Used by marketplace-service to apply fee discounts.

**Response `200`:**
```json
{
  "planName": "Pro",
  "feeDiscount": 20,
  "currentPeriodEnd": "2025-02-01T00:00:00Z"
}
```

Returns `{ "planName": "Free", "feeDiscount": 0 }` when no active subscription exists.

---

## Using `notifyUser` from `@sbf/contracts`

Services should use the contract helper rather than calling the HTTP endpoint directly:

```js
import { notifyUser, NotificationType } from '@sbf/contracts';

await notifyUser({
  userId: 'abc123',
  type: NotificationType.LISTING_SOLD,
  title: 'Your listing sold!',
  body: 'Get it shipped.',
  linkUrl: '/orders/xyz',
}).catch(() => {}); // swallow — non-fatal
```

The helper reads `NOTIFICATIONS_SERVICE_URL` and `INTERNAL_API_KEY` from environment variables.

Similarly, `pushRealtime` and `pushRealtimeBroadcast` are available for realtime events.
