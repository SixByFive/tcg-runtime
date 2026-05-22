import { Op } from 'sequelize';
import { createLogger } from '@sbf/logger';
import { Notification, UserNotificationPref, PushToken } from '../models/index.js';
import { sendNotificationEmail } from './email.service.js';

const logger = createLogger('notifications-service:notify');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send Expo push notifications to all active tokens for a user.
 * Fire-and-forget — errors are logged but never thrown.
 */
async function sendExpoPush(userId, { title, body, linkUrl, type }) {
  try {
    const tokens = await PushToken.findAll({
      where: { userId, isActive: true },
      attributes: ['token'],
      limit: 25,
    });
    if (!tokens.length) return;

    const messages = tokens.map(({ token }) => ({
      to:    token,
      title,
      body,
      data:  { linkUrl: linkUrl ?? null, type: type ?? null },
      sound: 'default',
    }));

    const res = await fetch(EXPO_PUSH_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify(messages),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.warn({ msg: 'expo_push_http_error', userId, status: res.status, body: text });
      return;
    }

    // Handle Expo receipt errors (invalid/expired tokens)
    const { data: receipts = [] } = await res.json().catch(() => ({ data: [] }));
    const badTokens = [];
    receipts.forEach((r, i) => {
      if (r.status === 'error') {
        logger.warn({ msg: 'expo_push_receipt_error', userId, details: r.details });
        if (r.details?.error === 'DeviceNotRegistered') {
          badTokens.push(tokens[i].token);
        }
      }
    });

    if (badTokens.length) {
      await PushToken.update({ isActive: false }, { where: { token: badTokens } });
      logger.info({ msg: 'expo_push_tokens_deactivated', userId, count: badTokens.length });
    }
  } catch (err) {
    logger.error({ msg: 'expo_push_failed', userId, error: err.message });
  }
}

// ─── Quiet hours ─────────────────────────────────────────────────────────────

function parseHHMM(str) {
  if (!str) return null;
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

function isWithinQuietHours(prefs, now = new Date()) {
  const start = parseHHMM(prefs.quietStart);
  const end   = parseHHMM(prefs.quietEnd);
  if (start == null || end == null) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  return start < end
    ? cur >= start && cur < end          // e.g. 09:00–17:00
    : cur >= start || cur < end;         // overnight e.g. 22:00–07:00
}

// ─── Core notifyUser ─────────────────────────────────────────────────────────

/**
 * Create a notification and optionally send email immediately.
 *
 * @param {object} opts
 * @param {string}  opts.userId
 * @param {string}  opts.type
 * @param {string}  opts.title
 * @param {string}  opts.body
 * @param {string=} opts.iconUrl
 * @param {string=} opts.linkUrl
 * @param {object=} opts.meta
 * @param {boolean=} opts.isSilent     default false
 * @param {boolean=} opts.isBroadcast  default false
 * @param {Date=}   opts.expiresAt
 * @param {string=} opts.userEmail     if provided, email is sent immediately
 */
export async function notifyUser({
  userId,
  type,
  title,
  body,
  iconUrl,
  linkUrl,
  meta,
  isSilent = false,
  isBroadcast = false,
  expiresAt,
  userEmail,
}) {
  try {
    // Load prefs (optional — missing prefs = all defaults)
    const prefs = userId
      ? await UserNotificationPref.findOne({ where: { userId } })
      : null;

    const inappOk = !prefs || prefs.inappEnabled !== false;
    const emailOk = userEmail && (!prefs || prefs.emailEnabled !== false);
    const quiet   = prefs ? isWithinQuietHours(prefs) : false;
    const instant = !prefs || prefs.digest === 'instant';

    if (!inappOk && !emailOk) return null;

    const notification = await Notification.create({
      userId,
      type,
      title,
      body,
      iconUrl,
      linkUrl,
      meta,
      isSilent,
      isBroadcast,
      expiresAt,
    });

    // Immediate email delivery (instant digest, not quiet hours, not silent)
    if (emailOk && !quiet && instant && !isSilent) {
      try {
        await sendNotificationEmail(notification, userEmail);
        await notification.update({ emailSentAt: new Date() });
      } catch (err) {
        logger.error({ msg: 'notify_email_failed', userId, type, error: err.message });
      }
    }

    // Expo push (fire-and-forget, respects pushEnabled pref + quiet hours + silent flag)
    const pushOk = userId && !isSilent && !quiet && (!prefs || prefs.pushEnabled !== false);
    if (pushOk) {
      sendExpoPush(userId, { title, body, linkUrl, type });
    }

    return notification;
  } catch (err) {
    logger.error({ msg: 'notify_failed', userId, type, error: err.message });
    return null;
  }
}

// ─── Read helpers ─────────────────────────────────────────────────────────────

export async function getUnreadCount(userId) {
  return Notification.count({
    where: {
      [Op.or]: [{ userId }, { isBroadcast: true, userId: null }],
      isRead: false, isDismissed: false, isSilent: false,
    },
  });
}

export async function markAsRead(id, userId) {
  const n = await Notification.findOne({
    where: { id, [Op.or]: [{ userId }, { isBroadcast: true, userId: null }] },
  });
  if (!n) return false;
  await n.update({ isRead: true });
  return true;
}

export async function markAllAsRead(userId) {
  await Notification.update(
    { isRead: true },
    {
      where: {
        [Op.or]: [{ userId }, { isBroadcast: true, userId: null }],
        isRead: false, isSilent: false,
      },
    },
  );
}

export async function dismissNotification(id, userId) {
  const n = await Notification.findOne({ where: { id, userId } });
  if (!n) return false;
  await n.update({ isDismissed: true });
  return true;
}
