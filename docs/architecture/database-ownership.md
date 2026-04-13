# Database Ownership

All services share a single MySQL database (`sixbyfive_tcg`). Each service is solely responsible for the tables it owns — it is the only service that runs `Model.sync()` on them. Other services may read cross-service tables using read-only Sequelize models with `sync: false`.

## Table Ownership

| Table | Owner service | Description |
|---|---|---|
| `users` | auth-service | User accounts, credentials, OAuth links, 2FA |
| `sessions` | auth-service | Redis-backed refresh token store (not a DB table) |
| `cards` | catalog-service | Card definitions |
| `card_sets` | catalog-service | Set/expansion definitions |
| `m_prices` | catalog-service | Price history per card/variant |
| `user_collections` | collections-service | Cards in a user's collection |
| `wishlists` | collections-service | User wishlist headers |
| `wishlist_items` | collections-service | Individual cards in a wishlist |
| `binders` | collections-service | Binder/album metadata |
| `binder_cards` | collections-service | Cards in a binder |
| `card_listings` | marketplace-service | Marketplace listings |
| `offers` | marketplace-service | Buyer offers on listings |
| `marketplace_orders` | marketplace-service | Purchase orders |
| `order_disputes` | marketplace-service | Dispute records |
| `seller_profiles` | marketplace-service | Stripe Connect onboarding state per seller |
| `ownership_records` | marketplace-service | Card provenance ledger |
| `user_reputations` | marketplace-service | Seller/buyer reputation scores |
| `trades` | trading-service | P2P trade offers |
| `notifications` | notifications-service | In-app notification records |
| `subscription_plans` | payments-service | Available subscription tiers |
| `user_subscriptions` | payments-service | Active user subscriptions |
| `transactions` | payments-service | Payment transaction ledger |
| `price_alerts` | collections-service | User price alert targets |

## Cross-Service Reads

The following services read tables they do not own. These models are defined with `sync: false` and no foreign key constraints.

| Reader service | Table read | Reason |
|---|---|---|
| worker-service | `marketplace_orders` | Escrow expiry job |
| worker-service | `offers` | Offer expiry job |
| worker-service | `trades` | Trade top-up expiry job |
| worker-service | `price_alerts` | Price alert job |
| worker-service | `wishlist_items` / `wishlists` | Wishlist fan-out (raw SQL) |
| marketplace-service | `ownership_records` | Provenance display |
| marketplace-service | `user_reputations` | Seller rating display |

## Schema Migrations

Each service syncs its own tables on startup:

- **Development** (`NODE_ENV=development`): `Model.sync({ alter: true })` — adds missing columns
- **Production** (`NODE_ENV=production`): `Model.sync({ force: false })` — creates table only if it does not exist; never modifies existing columns

For production schema changes, run SQL migrations manually before redeploying the owning service.
