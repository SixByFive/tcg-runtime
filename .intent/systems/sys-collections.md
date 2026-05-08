---
id: sys-collections
title: Collections Service
type: system
created: "2026-05-08T00:00:00.000Z"
updated: "2026-05-08T00:00:00.000Z"
plans: []
decisions: [DEC-0001, DEC-0005]
tags: [collections, wishlist, binders]
---

## Overview

Collections-service (port `4013`) manages all user-owned card data: their personal collection, wishlist, binders, and price alerts.

## Key responsibilities

- User collection: add, remove, update quantity/condition of owned cards
- Wishlist: track desired cards with target price alerts
- Binders: create/manage card albums (`binders` + `binder_cards`)
- Price alerts: trigger notifications when a card's price crosses a threshold

## Key files

| File | Purpose |
|------|---------|
| `apps/collections-service/src/routes/` | Collection, wishlist, binder, price-alert routes |
| `apps/collections-service/src/models/` | `CollectionEntry`, `Wishlist`, `WishlistItem`, `Binder`, `BinderCard`, `PriceAlert` |
| `apps/collections-service/src/services/` | Collection, wishlist, binder business logic |
| `apps/collections-service/src/middleware/` | Auth guard |

## Database ownership

Owns: `user_collections`, `wishlists`, `wishlist_items`, `binders`, `binder_cards`, `price_alerts`

## Important: entries store cardId only

Collection/wishlist/binder entries contain only `cardId` (and metadata like quantity/condition). Full card data (name, images, prices) is fetched from catalog-service by the gateway's `hydrateCards()` helper before returning to clients. Do not add card-detail columns to these tables.

## Binder mutations (gateway schema)

- `createBinder`, `updateBinder`, `deleteBinder`
- `saveBinderPagesAndSlots(binderId, pages)` — bulk-save full binder page/slot state
- No per-slot move/remove mutations — use `saveBinderPagesAndSlots` for all slot changes
