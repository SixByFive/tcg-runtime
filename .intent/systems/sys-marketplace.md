---
id: sys-marketplace
title: Marketplace Service
type: system
created: "2026-05-08T00:00:00.000Z"
updated: "2026-05-08T00:00:00.000Z"
plans: [plan-production-readiness]
decisions: [DEC-0001, DEC-0004]
tags: [marketplace, stripe, listings, orders, trading]
---

## Overview

Marketplace-service (port `4014`) handles peer-to-peer card sales: listings, offers, orders, Stripe Connect payments, EasyPost shipping labels, and provenance tracking.

## Key responsibilities

- Card listings (fixed price, auction, bundle)
- Buyer offers and negotiation
- Order lifecycle: pending → paid → shipped → delivered → completed
- Stripe Connect Express for seller onboarding and payouts
- Platform fee (configurable `PLATFORM_FEE_PCT`, default 5%)
- Shipping labels via EasyPost
- Dispute resolution
- Seller reputation scores

## Key files

| File | Purpose |
|------|---------|
| `apps/marketplace-service/src/routes/` | Listings, offers, orders, Stripe webhook, seller routes |
| `apps/marketplace-service/src/models/` | CardListing, Offer, Order, SellerProfile, OwnershipRecord, etc. |
| `apps/marketplace-service/src/services/` | Order processing, Stripe payment intent creation |
| `apps/marketplace-service/src/middleware/` | Auth guard, internal key guard |

## Database ownership

Owns: `card_listings`, `offers`, `marketplace_orders`, `order_disputes`, `seller_profiles`, `ownership_records`, `user_reputations`

## Inter-service calls (outbound)

- → `notifications-service` `/internal/notify` on order events
- → `worker-service` `/internal/wishlist-match` when listing activates
- → `realtime-service` via notifications for live push

## Stripe integration

Requires `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. Sellers onboard via Stripe Connect Express. Payments flow through platform escrow; payout after delivery confirmation. Webhook endpoint handles `payment_intent.succeeded`, `account.updated`, etc.
