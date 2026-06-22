const APP_URL = process.env.APP_URL || 'https://tcg.sixbyfive.com';
const BACKEND_URL = process.env.BACKEND_URL || 'https://backendtcg.sixbyfive.com';
const LOGO_URL = `${BACKEND_URL}/static/email-logo.png`;

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function base({ preheader, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(preheader)}&nbsp;</span>

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#070d1f;border-radius:10px 10px 0 0;padding:28px 40px;text-align:center;">
            <a href="${APP_URL}" style="text-decoration:none;display:inline-block;">
              <img src="${LOGO_URL}" alt="SixByFive TCG" width="220" height="auto" style="display:block;border:0;max-width:220px;" />
            </a>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:40px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;border-top:none;">
            ${body}
            <p style="margin:32px 0 0;font-size:13px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:20px;">
              <a href="${APP_URL}/notifications/preferences" style="color:#3399ff;text-decoration:none;">Manage notification preferences</a>
              &nbsp;&bull;&nbsp;
              <a href="${APP_URL}" style="color:#9ca3af;text-decoration:none;">SixByFive TCG</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(label, url) {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
    <tr>
      <td style="background:#3399ff;border-radius:6px;">
        <a href="${url}" style="display:inline-block;padding:13px 30px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:6px;letter-spacing:0.2px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

function badge(text, color = '#3399ff') {
  return `<span style="display:inline-block;padding:3px 10px;background:${color}1a;color:${color};font-size:12px;font-weight:600;border-radius:20px;letter-spacing:0.5px;text-transform:uppercase;">${esc(text)}</span>`;
}

const TYPE_META = {
  trade_offer:          { icon: '🔄', label: 'Trade',         color: '#3399ff' },
  trade_complete:       { icon: '✅', label: 'Trade',         color: '#1a7a6e' },
  trade_declined:       { icon: '❌', label: 'Trade',         color: '#dc2626' },
  message:              { icon: '💬', label: 'Message',       color: '#3399ff' },
  chat_mention:         { icon: '💬', label: 'Mention',       color: '#3399ff' },
  price_alert:          { icon: '📈', label: 'Price Alert',   color: '#d97706' },
  achievement_unlocked: { icon: '🏆', label: 'Achievement',   color: '#1a7a6e' },
  listing_sold:         { icon: '🎉', label: 'Sale',          color: '#1a7a6e' },
  subscription:         { icon: '⭐', label: 'Subscription',  color: '#3399ff' },
  payment_success:      { icon: '💰', label: 'Payment',       color: '#1a7a6e' },
  payment_failure:      { icon: '⚠️', label: 'Payment',      color: '#dc2626' },
  info:                 { icon: 'ℹ️', label: 'Info',          color: '#3399ff' },
  warning:              { icon: '⚠️', label: 'Action needed', color: '#d97706' },
  error:                { icon: '🚨', label: 'Error',         color: '#dc2626' },
};

export function subscriptionActivatedEmail({ planName, linkUrl }) {
  const ctaUrl = `${APP_URL}${linkUrl || '/account?tab=subscriptions'}`;
  return base({
    preheader: `Your ${planName} subscription is now active.`,
    body: `
      <p style="margin:0 0 16px;">${badge('Subscription', '#3399ff')}</p>
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0d1117;line-height:1.3;">⭐&nbsp; You're subscribed to ${esc(planName)}!</h1>
      <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">Your subscription is now active. Here's what you get:</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;margin:0 0 24px;">
        <tr><td style="padding:20px 24px;">
          <p style="margin:0;font-size:14px;color:#0369a1;line-height:1.7;">
            ✓&nbsp; All ${esc(planName)} benefits are unlocked<br/>
            ✓&nbsp; Your plan renews automatically each month<br/>
            ✓&nbsp; Manage or cancel anytime from your account
          </p>
        </td></tr>
      </table>
      ${btn('View subscription', ctaUrl)}
    `,
  });
}

export function subscriptionPaymentFailedEmail({ linkUrl }) {
  const ctaUrl = `${APP_URL}${linkUrl || '/account/subscription'}`;
  return base({
    preheader: 'Action required — update your payment method to keep your subscription.',
    body: `
      <p style="margin:0 0 16px;">${badge('Action needed', '#dc2626')}</p>
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0d1117;line-height:1.3;">⚠️&nbsp; Subscription payment failed</h1>
      <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">We couldn't charge your card for your subscription renewal. To avoid losing access to your plan, please update your payment method.</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;margin:0 0 24px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0;font-size:14px;color:#c2410c;line-height:1.7;">
            We'll retry the payment automatically. If it fails again your subscription will be cancelled.
          </p>
        </td></tr>
      </table>
      ${btn('Update payment method', ctaUrl)}
    `,
  });
}

export function subscriptionEndedEmail({ planName, linkUrl }) {
  const ctaUrl = `${APP_URL}${linkUrl || '/account/subscription'}`;
  return base({
    preheader: `Your ${planName} subscription has ended.`,
    body: `
      <p style="margin:0 0 16px;">${badge('Subscription', '#6b7280')}</p>
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0d1117;line-height:1.3;">Subscription ended</h1>
      <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">Your <strong>${esc(planName)}</strong> subscription has ended and you've been moved to the free tier. You can resubscribe at any time to regain access to your plan's benefits.</p>
      ${btn('View plans', ctaUrl)}
    `,
  });
}

export function walletToppedUpEmail({ amount, linkUrl }) {
  const ctaUrl = `${APP_URL}${linkUrl || '/account?tab=wallet'}`;
  return base({
    preheader: `£${amount} has been added to your wallet.`,
    body: `
      <p style="margin:0 0 16px;">${badge('Payment', '#1a7a6e')}</p>
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0d1117;line-height:1.3;">💰&nbsp; Wallet topped up</h1>
      <table cellpadding="0" cellspacing="0" style="width:100%;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin:0 0 24px;">
        <tr><td style="padding:24px;text-align:center;">
          <p style="margin:0 0 4px;font-size:36px;font-weight:700;color:#15803d;">£${esc(String(amount))}</p>
          <p style="margin:0;font-size:14px;color:#166534;">added to your wallet</p>
        </td></tr>
      </table>
      <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">Your wallet balance has been updated. You can use it to pay for marketplace purchases and trades.</p>
      ${btn('View wallet', ctaUrl)}
    `,
  });
}

export function notificationEmail(notification) {
  const { type, title, body, linkUrl } = notification;
  const meta = TYPE_META[type?.toLowerCase()] ?? { icon: '🔔', label: 'Notification', color: '#3399ff' };
  const ctaUrl = linkUrl ? `${APP_URL}${linkUrl}` : null;

  return base({
    preheader: body ?? title,
    body: `
      <p style="margin:0 0 16px;">${badge(meta.label, meta.color)}</p>
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0d1117;line-height:1.3;">${meta.icon}&nbsp; ${esc(title)}</h1>
      <p style="color:#374151;font-size:15px;line-height:1.7;margin:0;">${esc(body)}</p>
      ${ctaUrl ? btn('View', ctaUrl) : ''}
    `,
  });
}

export function digestEmail(notifications) {
  const rows = notifications.map(n => {
    const meta = TYPE_META[n.type?.toLowerCase()] ?? { icon: '🔔', label: 'Notification', color: '#3399ff' };
    const link = n.linkUrl
      ? `<a href="${APP_URL}${esc(n.linkUrl)}" style="color:#3399ff;text-decoration:none;font-size:13px;font-weight:500;white-space:nowrap;">View →</a>`
      : '';
    return `<tr>
      <td style="padding:14px 0;border-bottom:1px solid #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:28px;font-size:18px;vertical-align:top;padding-top:2px;">${meta.icon}</td>
            <td style="padding-left:12px;vertical-align:top;">
              <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#0d1117;">${esc(n.title)}</p>
              <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">${esc(n.body)}</p>
            </td>
            <td style="width:64px;text-align:right;vertical-align:top;padding-left:12px;">${link}</td>
          </tr>
        </table>
      </td>
    </tr>`;
  }).join('');

  return base({
    preheader: `You have ${notifications.length} unread notification${notifications.length !== 1 ? 's' : ''}.`,
    body: `
      <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#0d1117;">Your notifications</h1>
      <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">Here's what you missed on SixByFive TCG.</p>
      <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
      ${btn('View all notifications', `${APP_URL}/notifications`)}
    `,
  });
}
