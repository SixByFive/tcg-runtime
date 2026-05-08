---
id: plan-mobile-api
title: Gateway schema for mobile app (tcg-mob) compatibility
type: plan
status: active
created: "2026-05-08T00:00:00.000Z"
updated: "2026-05-08T00:00:00.000Z"
system: sys-gateway
decisions: [DEC-0002, DEC-0005, DEC-0006]
constraints: []
tags: [mobile, graphql, schema, api]
---

## Goal

Ensure the gateway GraphQL schema fully supports the SixByFive TCG mobile app (`sixbyfive-tcg-mob`), which migrated from the old WordPress backend to tcg-runtime.

## Reason

The mobile app previously used `@sixbyfive/tcg-binder` (generated client for a WordPress backend). That backend is being retired. The mobile app now points at this gateway for all operations.

## Completed (as of 2026-05-08)

- [x] `searchCards(input: CardSearchInput!): CardSearchResult!` — flat `{ total, items }` response
- [x] `cardsearchCard(id: ID!, variant: String): CardsearchDetail` — single card detail
- [x] `cardsearchSets` — set list
- [x] `searchUsers(q: String!, limit: Int)` — `q` variable (not `query`)
- [x] `unreadMessageCount` — messaging badge (not `unreadCount`)
- [x] `registerExpoPushToken(token: String!): Boolean!` — bare Boolean return
- [x] `unregisterExpoPushToken(token: String!): Boolean!` — bare Boolean return
- [x] `chatWithUser` — removed deprecated fields (`sender`, `receiver`, `isFlagged`, `expiresAt`, `updatedAt`)
- [x] `saveBinderPagesAndSlots` — replaces per-slot move/remove mutations
- [x] `CatalogCard` shape: `images { small large }`, `setCode`, `latestPrices`, `variants { key label default }`
- [x] Mobile auth: `X-Client-Type: mobile` returns token in JSON body

## Known gaps (mobile side, not gateway)

These are gaps in the mobile app, not the gateway schema:
- `MoveBinderSlot` / `RemoveBinderSlot` — mobile stubs to `saveBinderPagesAndSlots` (migration needed)
- `cardSetCompletion` — mobile app uses this; not in gateway schema yet
