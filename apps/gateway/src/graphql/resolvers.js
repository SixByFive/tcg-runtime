// Resolver implementation has been split into per-domain modules under ./resolvers/.
// This file is kept as a stable re-export so app.js import paths remain unchanged.
//
// Domain breakdown:
//   infrastructure  health / serviceHealth
//   auth            me, login, password flows, 2FA
//   users           profiles, achievements, rewards, safety
//   catalog         card search, price alerts
//   collections     collection, wishlist, binders
//   notifications   notifications, push tokens
//   messaging       chat, reports, blocks
//   marketplace     listings, orders, offers
//   payments        subscriptions, wallet, withdrawals
//   trading         trades, disputes
//   shipping        labels, tracking
//   admin           user management, bans, broadcasts

export { resolvers } from './resolvers/index.js';
