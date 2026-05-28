/**
 * Shared inter-service contracts.
 *
 * Services import helpers from here rather than hand-rolling HTTP calls.
 * All helpers silently no-op if the required env vars are absent (safe in dev).
 */

// ─── Notifications ────────────────────────────────────────────────────────────

const NOTIFICATIONS_URL =
  process.env.NOTIFICATIONS_SERVICE_URL || 'http://localhost:4016';

/**
 * Send a notification to a single user via the notifications-service.
 *
 * @param {object}  opts
 * @param {string}  opts.userId
 * @param {string}  opts.type        e.g. NotificationType.TRADE_OFFER
 * @param {string}  opts.title
 * @param {string}  opts.body
 * @param {string=} opts.iconUrl
 * @param {string=} opts.linkUrl     relative path e.g. '/trades/123'
 * @param {object=} opts.meta        arbitrary JSON stored with the notification
 * @param {string=} opts.userEmail   if provided, email is sent immediately
 * @param {boolean=} opts.isSilent   store in DB but do not deliver in-app
 * @param {string=} opts.expiresAt   ISO date string
 */
export async function notifyUser(opts) {
  const key = process.env.INTERNAL_API_KEY;
  if (!key) return;

  try {
    const res = await fetch(`${NOTIFICATIONS_URL}/internal/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-key': key },
      body: JSON.stringify(opts),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[contracts] notifyUser failed (${res.status}): ${text}`);
    }
  } catch (err) {
    console.error(`[contracts] notifyUser error: ${err.message}`);
  }
}

/**
 * Send a broadcast notification (no userId — visible to all users).
 */
export async function notifyBroadcast(opts) {
  const key = process.env.INTERNAL_API_KEY;
  if (!key) return;

  try {
    await fetch(`${NOTIFICATIONS_URL}/internal/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-key': key },
      body: JSON.stringify(opts),
    });
  } catch (err) {
    console.error(`[contracts] notifyBroadcast error: ${err.message}`);
  }
}

// ─── Realtime ─────────────────────────────────────────────────────────────────

const REALTIME_URL =
  process.env.REALTIME_SERVICE_URL || 'http://localhost:4018';

/**
 * Push a live event to one or more connected users via the realtime-service.
 *
 * Only reaches clients that are currently connected (WebSocket or SSE).
 * For persistent delivery use notifyUser() instead.
 *
 * @param {object}           opts
 * @param {string=}          opts.userId    single target user
 * @param {string[]=}        opts.userIds   multiple target users
 * @param {string}           opts.event     event name e.g. 'trade_update'
 * @param {any=}             opts.data      payload sent to the client
 */
export async function pushRealtime(opts) {
  const key = process.env.INTERNAL_API_KEY;
  if (!key) return;

  try {
    const res = await fetch(`${REALTIME_URL}/internal/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-key': key },
      body: JSON.stringify(opts),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[contracts] pushRealtime failed (${res.status}): ${text}`);
    }
  } catch (err) {
    console.error(`[contracts] pushRealtime error: ${err.message}`);
  }
}

/**
 * Broadcast a live event to every connected user.
 *
 * @param {object} opts
 * @param {string} opts.event
 * @param {any=}   opts.data
 */
export async function pushRealtimeBroadcast(opts) {
  const key = process.env.INTERNAL_API_KEY;
  if (!key) return;

  try {
    await fetch(`${REALTIME_URL}/internal/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-key': key },
      body: JSON.stringify(opts),
    });
  } catch (err) {
    console.error(`[contracts] pushRealtimeBroadcast error: ${err.message}`);
  }
}

// ─── Subscription capabilities ────────────────────────────────────────────────

const PAYMENTS_URL_CONTRACTS =
  process.env.PAYMENTS_SERVICE_URL || 'http://localhost:4019';

/**
 * Fetch the subscription capability limits for a user.
 * Returns free-tier defaults if no active subscription or the call fails.
 *
 * @param {string} userId
 * @returns {Promise<{
 *   planName: string,
 *   platformFeePercent: number,
 *   maxBinders: number|null,
 *   maxCollectionCards: number|null,
 *   maxActiveListings: number|null,
 *   maxActiveTrades: number|null,
 *   features: any[],
 * }>}
 */
export async function checkCapabilities(userId) {
  const key = process.env.INTERNAL_API_KEY;
  const FREE_DEFAULTS = {
    planName: 'Free',
    platformFeePercent: 7,
    maxBinders: 3,
    maxCollectionCards: 500,
    maxActiveListings: 5,
    maxActiveTrades: 3,
    features: [],
  };

  if (!key || !userId) return FREE_DEFAULTS;

  try {
    const res = await fetch(`${PAYMENTS_URL_CONTRACTS}/internal/capabilities/${encodeURIComponent(userId)}`, {
      headers: { 'x-internal-key': key },
    });
    if (!res.ok) return FREE_DEFAULTS;
    return await res.json();
  } catch {
    return FREE_DEFAULTS;
  }
}

// ─── Notification type constants ──────────────────────────────────────────────

export const NotificationType = {
  SYSTEM:                     'system',
  TRADE_OFFER:                'trade_offer',
  TRADE_COMPLETE:             'trade_complete',
  TRADE_DECLINED:             'trade_declined',
  MESSAGE:                    'message',
  CHAT_MENTION:               'chat_mention',
  PRICE_ALERT:                'price_alert',
  ACHIEVEMENT_UNLOCKED:       'achievement_unlocked',
  LISTING_SOLD:               'listing_sold',
  ORDER_PLACED_BUYER:         'order_placed_buyer',
  ORDER_PLACED_SELLER:        'order_placed_seller',
  ORDER_FULFILMENT_PRINTING:  'order_fulfilment_in_printing',
  ORDER_FULFILMENT_SHIPPED:   'order_fulfilment_shipped',
  SUBSCRIPTION:               'subscription',
  PAYMENT_FAILURE:            'payment_failure',
  INFO:                       'info',
  WARNING:                    'warning',
  ERROR:                      'error',
  REMINDER:                   'reminder',
};

// ─── Realtime event name constants ────────────────────────────────────────────

export const RealtimeEvent = {
  NOTIFICATION:        'notification',
  TRADE_UPDATE:        'trade_update',
  TRADE_CANCELLED:     'trade_cancelled',
  TRADE_OFFER:         'trade_offer',
  PRICE_ALERT:         'price_alert',
  BROADCAST:           'broadcast',
  SYSTEM:              'system',
};
