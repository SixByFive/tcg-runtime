# Realtime Service API

**Direct (internal/dev):** `http://localhost:4018`

The realtime service delivers live push events to connected clients over WebSocket or Server-Sent Events (SSE). Clients choose whichever protocol their environment supports best.

---

## Authentication

All client connections must present a valid JWT access token. It is read from (in priority order):

1. Query parameter: `?token=<access-token>`
2. Cookie: `sbf_access`
3. HTTP header: `Authorization: Bearer <access-token>`

---

## Server-Sent Events (SSE)

Best for browser clients that don't need bidirectional communication.

### `GET /realtime/events`

Open an SSE stream.

**Example (browser):**
```js
const es = new EventSource('http://localhost:4018/realtime/events', {
  withCredentials: true  // sends sbf_access cookie
});

// Or with explicit token (e.g. mobile webview)
const es = new EventSource(
  `http://localhost:4018/realtime/events?token=${accessToken}`
);

es.addEventListener('message', (e) => {
  const { event, data, ts } = JSON.parse(e.data);
  console.log(event, data);
});
```

The server sends a keepalive comment (`: ping`) every 30 seconds to keep the connection alive through proxies.

---

## WebSocket

Best for native mobile clients or when bidirectional messages are needed.

### `GET /realtime/ws`

WebSocket upgrade endpoint.

**Example (browser):**
```js
const ws = new WebSocket(
  `ws://localhost:4018/realtime/ws?token=${accessToken}`
);

ws.onopen = () => {
  // Server immediately sends: { event: 'connected', data: { userId }, ts }
};

ws.onmessage = (e) => {
  const { event, data, ts } = JSON.parse(e.data);
  console.log(event, data);
};
```

The server pings every 30 seconds. Clients should handle `pong` automatically (most WS libraries do).

---

## Event Envelope

All events share the same shape:

```json
{
  "event": "notification",
  "data": { … },
  "ts": 1700000000000
}
```

---

## Event Types

Defined in `packages/contracts/src/index.js`.

| `event` value | Trigger | `data` shape |
|---|---|---|
| `connected` | On initial WS connection | `{ userId }` |
| `notification` | Any `notifyUser()` call from any service | `{ id, type, title, body, linkUrl, meta }` |
| `trade_update` | Trade status change | `{ tradeId, status }` |
| `trade_offer` | New trade offer received | `{ tradeId, from }` |
| `trade_cancelled` | Trade cancelled | `{ tradeId }` |
| `price_alert` | Card price crossed target | `{ cardId, cardName, currentPrice, targetPrice }` |
| `broadcast` | System-wide announcement | `{ message }` |
| `system` | Platform status message | `{ message }` |

---

## Internal API

Used by other services to push events. Requires `x-internal-key` header.

### `POST /internal/push`
Push an event to one or more specific users.

**Body:**
```json
{
  "userId": "user123",
  "event": "notification",
  "data": { "title": "You have a new offer" }
}
```

Or push to multiple users at once:
```json
{
  "userIds": ["user1", "user2"],
  "event": "price_alert",
  "data": { "cardId": "…", "currentPrice": 4.99 }
}
```

**Response `200`:** `{ "ok": true }`

### `POST /internal/broadcast`
Push an event to **all** currently connected clients.

**Body:**
```json
{
  "event": "broadcast",
  "data": { "message": "Scheduled maintenance in 10 minutes" }
}
```

**Response `200`:** `{ "ok": true }`

---

## Redis Pub/Sub

For horizontal scaling (multiple realtime-service instances), events can be published to Redis instead of calling the HTTP internal API directly.

| Channel | Behaviour |
|---|---|
| `realtime:user:{userId}` | Push to that user's connections |
| `realtime:broadcast` | Push to all connections |

Message format (JSON string):
```json
{ "event": "notification", "data": { … } }
```

---

## Health

### `GET /health`
**Response `200`:** `{ "status": "ok", "service": "realtime-service", "connections": 42 }`

`connections` is the count of currently connected unique users.
