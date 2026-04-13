# Marketplace Service API

**Base URL (via Gateway):** `http://localhost:4010`  
**Direct (internal/dev):** `http://localhost:4014`

All routes are mounted at `/marketplace`.

---

## Overview

The marketplace enables sellers to list physical trading cards for sale with proof-of-possession verification, and buyers to purchase them via Stripe escrow. Payments are held until the buyer confirms receipt, at which point funds are released to the seller's Stripe Connect account.

**Listing lifecycle:**
```
DRAFT → PENDING_PROOF → ACTIVE → SOLD
                     ↘ CANCELLED / REMOVED
```

**Order lifecycle:**
```
pending → authorised → captured → (completed)
                    ↘ cancelled
                    ↘ refunded
```

---

## Seller Onboarding

Before creating a listing that can accept payments, sellers must connect a Stripe account.

### `GET /marketplace/seller/status`
🔒 *Requires auth*

Returns the seller's Stripe Connect onboarding state.

**Response `200`:**
```json
{
  "stripeAccountId": "acct_…",
  "onboardingComplete": true,
  "canReceivePayments": true
}
```

### `POST /marketplace/seller/connect`
🔒 *Requires auth*

Initiates Stripe Connect Express onboarding. Returns a URL to redirect the seller to.

**Response `200`:** `{ "url": "https://connect.stripe.com/…" }`

### `GET /marketplace/seller/connect/complete`
🔒 *Requires auth*

Stripe redirects here after onboarding. Verifies the account status and updates the seller profile.

---

## Listings

### `GET /marketplace/listings`
Public. Browse active listings.

**Query params:**

| Param | Type | Description |
|---|---|---|
| `cardId` | string | Filter by card ID |
| `condition` | string | `M` `NM` `LP` `MP` `HP` `DMG` |
| `sellerId` | string | Filter by seller |
| `minPrice` | number | Minimum price |
| `maxPrice` | number | Maximum price |
| `page` | number | Page number (default 1) |
| `pageSize` | number | Results per page (max 100, default 50) |

**Response `200`:**
```json
{ "listings": [ … ], "total": 0, "page": 1, "pageSize": 50 }
```

### `POST /marketplace/listings`
🔒 *Requires auth*

Create a new listing. Starts in `PENDING_PROOF` status with a unique proof code.

**Body:**
```json
{
  "cardId": "string (required)",
  "title": "string (required)",
  "description": "string",
  "condition": "NM",
  "variant": "Holo",
  "price": 12.50,
  "currency": "GBP",
  "quantity": 1,
  "shippingType": "FIXED",
  "shippingPrice": 2.50,
  "parcelSize": "LARGE_LETTER",
  "allowOffers": true,
  "offerMinPrice": 10.00
}
```

`shippingType` options: `FIXED` (flat fee in `shippingPrice`) | `DYNAMIC` (calculated via EasyPost at purchase).  
`parcelSize` options: `LARGE_LETTER` | `SMALL_PARCEL` | `MEDIUM_PARCEL`

**Response `201`:** Created listing including `proofCode` and `proofCodeExpiresAt`.

### `GET /marketplace/listings/:id`
Public for ACTIVE listings. Only the seller can view their own non-ACTIVE listings.

### `PATCH /marketplace/listings/:id`
🔒 *Requires auth* — Seller only. Update a listing that isn't SOLD/CANCELLED/REMOVED.

Editable fields: `title`, `description`, `price`, `quantity`, `shippingType`, `shippingPrice`, `parcelSize`, `allowOffers`, `offerMinPrice`, `condition`, `variant`.

### `DELETE /marketplace/listings/:id`
🔒 *Requires auth* — Seller only. Cancels the listing (sets status to `CANCELLED`).

### `POST /marketplace/listings/:id/proof`
🔒 *Requires auth* — Seller only.

Upload a proof-of-possession photo. The seller must physically write their unique `proofCode` on a piece of paper and hold it alongside the card in the photo.

**Body:**
```json
{ "image": "<base64-encoded image>" }
```

**Response `200`:**
```json
{ "ok": true, "result": "approved" }
```

`result` values:
- `approved` — Auto-moderated and listing is now `ACTIVE`
- `pending_admin` — Queued for manual admin review

If the proof code has expired, a new code is issued and `410` is returned:
```json
{ "error": "Proof code expired…", "newProofCode": "ABC12345" }
```

### `GET /marketplace/listings/:id/ownership`
Public. View the full provenance/ownership ledger for the card in this listing.

**Response `200`:** Array of ownership records showing the card's full chain of custody.

### `POST /marketplace/listings/:id/shipping-rates`
🔒 *Requires auth* — For `DYNAMIC` shipping listings only.

**Body:**
```json
{
  "sellerAddress": { "street1": "…", "city": "…", "zip": "…", "country": "GB" },
  "buyerAddress": { "street1": "…", "city": "…", "zip": "…", "country": "GB" }
}
```

**Response `200`:** Array of available shipping rates from EasyPost.

### `POST /marketplace/listings/:id/buy`
🔒 *Requires auth* — Purchase a listing (Buy It Now).

**Body:**
```json
{
  "buyerAddress": { … },
  "shippingRateId": "rate_…",  // required for DYNAMIC listings
  "shipmentId": "shp_…"        // required for DYNAMIC listings
}
```

**Response `201`:**
```json
{
  "orderId": "string",
  "clientSecret": "pi_…_secret_…",
  "totalAmount": 15.00
}
```

Use `clientSecret` with Stripe.js on the frontend to complete payment.

---

## Offers

### `POST /marketplace/offers/listings/:listingId/offers`
🔒 *Requires auth* — Buyer makes an offer.

**Body:** `{ "amount": 10.00, "message": "optional" }`

**Response `201`:** Created offer record.

### `GET /marketplace/offers/listings/:listingId/offers`
🔒 *Requires auth* — Seller views all offers on their listing.

### `GET /marketplace/offers`
🔒 *Requires auth* — Buyer views all their own offers.

### `POST /marketplace/offers/:id/respond`
🔒 *Requires auth* — Seller responds to an offer.

**Body:**
```json
{
  "action": "accept | decline | counter",
  "counterAmount": 11.00  // required for counter
}
```

Accepting creates an Order and Stripe PaymentIntent automatically.

### `DELETE /marketplace/offers/:id`
🔒 *Requires auth* — Buyer withdraws their offer.

---

## Orders

### `GET /marketplace/orders`
🔒 *Requires auth* — List the authenticated user's orders (as buyer or seller).

### `GET /marketplace/orders/:id`
🔒 *Requires auth* — Order detail.

### `POST /marketplace/orders/:id/shipping-rates`
🔒 *Requires auth* — Seller gets EasyPost shipping rates for this order.

### `POST /marketplace/orders/:id/ship`
🔒 *Requires auth* — Seller marks order as shipped.

**Body (EasyPost label):**
```json
{ "shippingRateId": "rate_…", "shipmentId": "shp_…" }
```

**Body (manual tracking):**
```json
{ "trackingNumber": "JD123456…", "carrier": "Royal Mail" }
```

### `POST /marketplace/orders/:id/received`
🔒 *Requires auth* — Buyer confirms they received the item.

Triggers Stripe capture (releases escrow funds to seller) and writes an ownership transfer record.

### `POST /marketplace/orders/:id/cancel`
🔒 *Requires auth* — Cancel an order (cancels the Stripe PaymentIntent if still authorised).

### `POST /marketplace/orders/:id/dispute`
🔒 *Requires auth* — Raise a dispute.

**Body:** `{ "reason": "string", "evidence": { … } }`

### `POST /marketplace/orders/:id/evidence`
🔒 *Requires auth* — Submit additional dispute evidence.

### `POST /marketplace/orders/:id/feedback`
🔒 *Requires auth* — Buyer leaves feedback (1–5 stars + optional text). Available within 30 days of order completion.

**Body:** `{ "rating": 5, "review": "Great seller!" }`

---

## Admin Routes

All admin routes require the `x-internal-key` header.

### `GET /marketplace/admin/listings`
List all listings with optional filters (`status`, `sellerId`, `cardId`).

### `GET /marketplace/admin/listings/proof-queue`
View listings awaiting manual proof moderation (`status=PENDING_PROOF` with `moderationResult=pending_admin`).

### `POST /marketplace/admin/listings/:id/approve-proof`
Approve a listing's proof image. Sets status to `ACTIVE` and triggers wishlist fan-out.

### `POST /marketplace/admin/listings/:id/reject-proof`
Reject proof. Generates a new proof code and notifies the seller.

**Body:** `{ "reason": "string" }`

### `GET /marketplace/admin/orders`
List all orders with optional filters.

### `GET /marketplace/admin/disputes`
List all open/in-review disputes.

### `POST /marketplace/admin/disputes/:id/resolve`
Resolve a dispute.

**Body:**
```json
{
  "resolution": "buyer | seller",
  "note": "optional admin note"
}
```

- `buyer` — refunds the payment, keeps card with seller
- `seller` — captures the escrow payment, transfers card ownership to buyer

---

## Webhooks

### `POST /webhooks/stripe`
Stripe sends events here. The endpoint verifies the `Stripe-Signature` header.

Handled events:
- `payment_intent.amount_capturable_updated` — marks order `authorised`, notifies seller to ship
- `payment_intent.canceled` — marks order `cancelled`
- `account.updated` — updates seller onboarding status

### `POST /webhooks/easypost`
EasyPost sends tracking updates here.

Handled events:
- `tracker.updated` (status `delivered`) — notifies buyer to confirm receipt

---

## Parcel Sizes

| Size | Weight | Use case |
|---|---|---|
| `LARGE_LETTER` | ≤ 500 g | Single sleeved card, PWE |
| `SMALL_PARCEL` | ≤ 1 kg | Few cards, tracked bubble |
| `MEDIUM_PARCEL` | ≤ 5 kg | Multiple cards or graded slabs |

---

## Health

### `GET /health`
**Response `200`:** `{ "status": "ok", "service": "marketplace-service" }`
