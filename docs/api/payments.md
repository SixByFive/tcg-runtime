# Payments Service API

**Base URL (via Gateway):** `http://localhost:4010`  
**Direct (internal/dev):** `http://localhost:4019`

---

## Overview

The payments service handles:
- **Subscription plans** — tiered access levels with Stripe Billing
- **One-off product checkout** — Stripe Checkout sessions for digital purchases
- **Transaction ledger** — record of all billing events
- **Customer Portal** — self-service subscription management

---

## Subscription Plans

### `GET /payments/plans`
Public. Returns all active plans ordered for display.

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "name": "Pro",
    "price": 4.99,
    "interval": "month",
    "feeDiscount": 20,
    "featuresJson": ["Lower marketplace fees", "Advanced analytics"],
    "sortOrder": 1
  }
]
```

`feeDiscount` is the percentage reduction applied to the marketplace platform fee (0–100).

---

### `GET /payments/admin/plans`
🔑 *Requires `x-internal-key`*

Returns all plans including inactive ones.

### `POST /payments/admin/plans`
🔑 *Requires `x-internal-key`*

Create a new subscription plan. Automatically creates the backing Stripe Product and Price.

**Body:**
```json
{
  "name": "Pro",
  "description": "For serious collectors",
  "price": 4.99,
  "interval": "month",
  "feeDiscount": 20,
  "featuresJson": ["Feature one", "Feature two"],
  "sortOrder": 1
}
```

`interval`: `month` | `year`

**Response `201`:** Created plan.

### `PATCH /payments/admin/plans/:id`
🔑 *Requires `x-internal-key`*

Update a plan. If `price` or `interval` changes, a new Stripe Price is created and the old one archived.

---

## Subscriptions

### `GET /payments/subscription`
🔒 *Requires auth*

Returns the user's current active subscription.

**Response `200`:**
```json
{
  "id": "uuid",
  "planId": "uuid",
  "status": "active",
  "currentPeriodStart": "2025-01-01T00:00:00Z",
  "currentPeriodEnd": "2025-02-01T00:00:00Z",
  "cancelAtPeriodEnd": false,
  "plan": { "name": "Pro", "price": 4.99 }
}
```

Status values: `active` | `past_due` | `trialing` | `cancelled` | `expired`

### `POST /payments/subscription`
🔒 *Requires auth*

Subscribe to a plan. Returns a Stripe Checkout URL.

**Body:** `{ "planId": "uuid" }`

**Response `200`:** `{ "checkoutUrl": "https://checkout.stripe.com/…" }`

Redirect the user to `checkoutUrl`. Stripe redirects back to `APP_URL/account/subscription` on completion.

### `POST /payments/subscription/cancel`
🔒 *Requires auth*

Schedule cancellation at the end of the current billing period (`cancel_at_period_end: true`).

**Response `200`:** `{ "cancelAtPeriodEnd": true, "currentPeriodEnd": "…" }`

### `POST /payments/subscription/resume`
🔒 *Requires auth*

Undo a scheduled cancellation (reactivates the subscription).

### `GET /payments/subscription/portal`
🔒 *Requires auth*

Returns a Stripe Customer Portal URL so the user can manage their billing details, change plan, or cancel.

**Response `200`:** `{ "url": "https://billing.stripe.com/…" }`

### `GET /payments/admin/subscriptions`
🔑 *Requires `x-internal-key`*

List all subscriptions with optional filters (`status`, `userId`, `planId`).

---

## Checkout (One-off purchases)

### `POST /payments/checkout`
🔒 *Requires auth*

Create a Stripe Checkout session for a one-off product purchase.

**Body:**
```json
{
  "productId": "string",
  "priceId": "string",
  "metadata": { "orderId": "…" }
}
```

**Response `200`:** `{ "checkoutUrl": "https://checkout.stripe.com/…" }`

A `Transaction` record in `pending` status is created immediately. It is marked `completed` when Stripe sends `checkout.session.completed`.

---

## Transactions

### `GET /payments/transactions`
🔒 *Requires auth*

Returns the authenticated user's transaction history.

**Query params:** `page`, `pageSize`, `type`

**Response `200`:**
```json
{
  "transactions": [
    {
      "id": "uuid",
      "type": "subscription_payment",
      "status": "completed",
      "amount": 4.99,
      "currency": "GBP",
      "description": "Pro renewal",
      "createdAt": "…"
    }
  ],
  "total": 1
}
```

Transaction types: `subscription_payment` | `subscription_refund` | `product_purchase` | `product_refund`

### `GET /payments/admin/transactions`
🔑 *Requires `x-internal-key`*

List all transactions with filters (`userId`, `type`, `status`).

---

## Internal

### `GET /internal/subscription/:userId`
🔑 *Requires `x-internal-key`*

Used by marketplace-service to calculate the user's platform fee discount.

**Response `200`:**
```json
{
  "planName": "Pro",
  "feeDiscount": 20,
  "currentPeriodEnd": "2025-02-01T00:00:00Z"
}
```

Returns `{ "planName": "Free", "feeDiscount": 0 }` if no active subscription.

---

## Webhooks

### `POST /webhooks/stripe`
Stripe sends billing events here. Verified with `Stripe-Signature` header.

Handled events:

| Event | Action |
|---|---|
| `checkout.session.completed` (subscription mode) | Activates `UserSubscription` record |
| `checkout.session.completed` (payment mode) | Marks `Transaction` as completed |
| `invoice.payment_succeeded` | Creates renewal `Transaction`, updates billing period |
| `invoice.payment_failed` | Sets subscription to `past_due`, notifies user |
| `customer.subscription.updated` | Syncs status, cancel flag, and billing period |
| `customer.subscription.deleted` | Sets subscription to `cancelled`, notifies user |

---

## Health

### `GET /health`
**Response `200`:** `{ "status": "ok", "service": "payments-service" }`
