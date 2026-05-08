---
id: sys-catalog
title: Catalog Service
type: system
created: "2026-05-08T00:00:00.000Z"
updated: "2026-05-08T00:00:00.000Z"
plans: []
decisions: [DEC-0001]
tags: [catalog, cards, sets, pricing]
---

## Overview

Catalog-service (port `4012`) is the authoritative source for all card, set, and pricing data. It is a read-heavy service — no user writes.

## Key responsibilities

- Card search with filters (name, set, type, rarity, etc.)
- Single card lookup by ID with variant detail
- Set / expansion listing
- Price history (`m_prices` table) and latest price rollups
- Batch card fetch (`getCardsBatch`) for gateway hydration

## Key files

| File | Purpose |
|------|---------|
| `apps/catalog-service/src/routes/` | Search, card detail, sets, pricing routes |
| `apps/catalog-service/src/models/` | `Card`, `CardSet`, `Price` Sequelize models |
| `apps/catalog-service/src/services/` | Search logic, price rollup calculations |
| `apps/catalog-service/scripts/` | Import/seed scripts for card data |

## Database ownership

Owns: `cards`, `card_sets`, `m_prices`

## Card type shape (as seen by gateway/mobile)

```
CatalogCard / CardsearchDetail {
  id, name, setCode, rarity, type
  images { small, large }
  latestPrices
  variants { key, label, default }
}
```

## API endpoints consumed by gateway

- `GET /internal/cards/:id` — single card
- `POST /internal/cards/batch` — batch by IDs (used by hydrateCards)
- `GET /internal/search` — card search
- `GET /internal/sets` — set list
