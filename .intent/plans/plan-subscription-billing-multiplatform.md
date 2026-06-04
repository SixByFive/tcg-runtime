---
id: plan-subscription-billing-multiplatform
title: Multi-platform subscription billing (Web, Android, iOS)
type: plan
status: draft
created: 2026-06-04T00:00:00.000Z
updated: 2026-06-04T00:00:00.000Z
system: sys-marketplace
decisions: []
constraints: []
tags:
  - subscriptions
  - stripe
  - google-play
  - app-store
  - revenuecat
  - mobile
  - payments
---

## Goal

Support subscription purchases across all three surfaces — website (Stripe), Android app (Google Play Billing), and iOS app (App Store) — without sending the user outside the app or platform.

## Reason

The current implementation calls `createSubscription` and redirects via `Linking.openURL` to a Stripe Checkout URL. This breaks App Store and Google Play guidelines (digital subscriptions must use native IAP on each platform) and gives a poor UX (browser tab outside the app). The website redirect is acceptable but could be improved with embedded Stripe Elements.

## Architecture

### Web — Stripe Checkout (unchanged for now)
- Current redirect to Stripe Checkout is acceptable for web.
- Optional future improvement: embed Stripe Elements for a stay-on-page checkout.
- No change required to go live.

### Mobile — Card (Stripe React Native SDK)
- Install `@stripe/stripe-react-native` in the Expo app (requires custom dev build, not Expo Go).
- Backend adds a new endpoint: `POST /payments/subscriptions/intent` — creates a Stripe `SetupIntent` (or `PaymentIntent` for immediate charge) and returns a `clientSecret`.
- App uses `initPaymentSheet` + `presentPaymentSheet` to collect card details natively — no browser redirect.
- On success, app calls `POST /payments/subscriptions/confirm` with the intent ID to activate the subscription server-side.

### Mobile — Google Play Billing (RevenueCat)
- Install `react-native-purchases` (RevenueCat SDK) in the Expo app.
- Set up RevenueCat project, connect Google Play app.
- Create matching subscription products in Google Play Console (Collector, Trader, Vendor — monthly + yearly SKUs).
- RevenueCat sends webhooks to a new backend endpoint: `POST /webhooks/revenuecat` — grants/revokes plan entitlements in `subscription_plans` the same way Stripe webhooks do.
- Platform detection at checkout: Android → RevenueCat/Play Billing; iOS → RevenueCat/App Store (when ready); Web → Stripe.

### Mobile — App Store (iOS) — future
- Same RevenueCat SDK handles App Store once products are created in App Store Connect.
- No additional code changes needed beyond adding App Store products to RevenueCat.

## Backend changes required

### payments-service
- [ ] `POST /payments/subscriptions/intent` — create Stripe SetupIntent for mobile card flow, return `clientSecret`
- [ ] `POST /payments/subscriptions/confirm` — confirm subscription activation after Stripe card collect
- [ ] `POST /webhooks/revenuecat` — handle RevenueCat webhook events:
  - `INITIAL_PURCHASE` → activate plan in DB
  - `RENEWAL` → extend/confirm active plan
  - `CANCELLATION` / `EXPIRATION` → downgrade to Free
  - `PRODUCT_CHANGE` → update plan tier
- [ ] Entitlement check (`/internal/capabilities/:userId`) must resolve plan from either Stripe subscription OR active RevenueCat entitlement (whichever is active)

### gateway
- [ ] New mutation: `createSubscriptionIntent: SubscriptionIntent!` — returns `{ clientSecret }` for mobile Stripe card flow
- [ ] Existing `createSubscription` mutation (returns Checkout URL) stays for web

## Mobile app changes required

- [ ] Install `@stripe/stripe-react-native` and `react-native-purchases` (requires EAS/custom dev build)
- [ ] `StripeProvider` wrapper in `_layout.js` with publishable key from env
- [ ] Platform detection helper: `getPaymentProvider()` → `'stripe-native' | 'play' | 'appstore'`
- [ ] Subscriptions screen: replace `Linking.openURL` with:
  - Android: `Purchases.purchasePackage(pkg)` via RevenueCat
  - iOS: `Purchases.purchasePackage(pkg)` via RevenueCat  
  - Web (if ever in-app browser): `presentPaymentSheet` via Stripe
- [ ] RevenueCat `Purchases.configure({ apiKey, appUserID: userId })` on auth

## Play Console / RevenueCat setup (manual, not code)

- [ ] Create Google Play subscription products (6 SKUs: collector/trader/vendor × month/year)
- [ ] Create RevenueCat project, connect Play app, map entitlements to plan names
- [ ] Add RevenueCat webhook URL to RevenueCat dashboard → points to `POST /webhooks/revenuecat`
- [ ] Add `REVENUECAT_WEBHOOK_SECRET` env var to payments-service

## Environment variables needed

```
# payments-service
REVENUECAT_WEBHOOK_SECRET=...

# mobile app (app.json / eas.json)
EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY=...
EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY=...   # for future iOS
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
```

## Sequencing

1. Backend: `POST /payments/subscriptions/intent` + `POST /webhooks/revenuecat` endpoints
2. Play Console: create products + RevenueCat project setup
3. Mobile: install SDKs, add `StripeProvider`, wire up RevenueCat
4. Mobile: platform-detect checkout path in subscriptions screen
5. Test on real Android device (Play Billing sandbox)
6. iOS App Store products + test on real iOS device (future)
