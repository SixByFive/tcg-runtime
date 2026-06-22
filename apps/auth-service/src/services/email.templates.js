const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.BACKEND_URL || 'https://backendtcg.sixbyfive.com';
const LOGO_URL = `${BACKEND_URL}/static/email-logo.png`;

function base({ preheader, title, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;</span>

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
              SixByFive TCG &bull; <a href="${APP_URL}" style="color:#3399ff;text-decoration:none;">${APP_URL.replace(/^https?:\/\//, '')}</a>
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
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td style="background:#3399ff;border-radius:6px;">
        <a href="${url}" style="display:inline-block;padding:13px 30px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:6px;letter-spacing:0.2px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

function fallbackLink(url) {
  return `<p style="font-size:13px;color:#6b7280;margin-top:4px;word-break:break-all;">
    Or copy this link: <a href="${url}" style="color:#3399ff;">${url}</a>
  </p>`;
}

export function verificationEmail(user, token) {
  const url = `${APP_URL}/verify-email?token=${token}`;
  return {
    subject: 'Verify your SixByFive email',
    html: base({
      preheader: 'Confirm your email address to get started.',
      title: 'Verify your email',
      body: `
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0d1117;">Verify your email address</h1>
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px;">Hi <strong>${user.username}</strong>, thanks for signing up. Click below to verify your email address. This link expires in <strong>24 hours</strong>.</p>
        ${btn('Verify email', url)}
        ${fallbackLink(url)}
        <p style="font-size:13px;color:#9ca3af;margin-top:24px;">If you didn't create a SixByFive account, you can safely ignore this email.</p>
      `,
    }),
  };
}

export function welcomeEmail(user) {
  return {
    subject: 'Welcome to SixByFive TCG!',
    html: base({
      preheader: 'Your account is ready — start exploring the marketplace.',
      title: 'Welcome to SixByFive',
      body: `
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0d1117;">Welcome, ${user.username}!</h1>
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">Your account is all set. Here's what you can do on SixByFive TCG:</p>
        <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;width:100%;border:1px solid #f3f4f6;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="padding:14px 16px;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151;">
              <span style="font-size:20px;vertical-align:middle;">🃏</span>&nbsp;&nbsp;<strong>Browse the marketplace</strong> — buy and sell trading cards
            </td>
          </tr>
          <tr>
            <td style="padding:14px 16px;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151;">
              <span style="font-size:20px;vertical-align:middle;">🔄</span>&nbsp;&nbsp;<strong>Trade cards</strong> — swap with other collectors
            </td>
          </tr>
          <tr>
            <td style="padding:14px 16px;font-size:14px;color:#374151;">
              <span style="font-size:20px;vertical-align:middle;">📈</span>&nbsp;&nbsp;<strong>Track prices</strong> — set alerts and follow the market
            </td>
          </tr>
        </table>
        ${btn('Go to marketplace', `${APP_URL}/marketplace`)}
      `,
    }),
  };
}

export function passwordResetEmail(user, token) {
  const url = `${APP_URL}/reset-password?token=${token}`;
  return {
    subject: 'Reset your SixByFive password',
    html: base({
      preheader: 'You requested a password reset.',
      title: 'Reset your password',
      body: `
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0d1117;">Reset your password</h1>
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px;">Hi <strong>${user.username}</strong>, we received a request to reset your password. Click below to choose a new one. This link expires in <strong>1 hour</strong>.</p>
        ${btn('Reset password', url)}
        ${fallbackLink(url)}
        <p style="font-size:13px;color:#9ca3af;margin-top:24px;">If you didn't request a password reset, you can safely ignore this email. Your password won't change.</p>
      `,
    }),
  };
}

export function emailChangeEmail(user, token, newEmail) {
  const url = `${APP_URL}/verify-email?token=${token}`;
  return {
    subject: 'Verify your new SixByFive email',
    html: base({
      preheader: `Confirm ${newEmail} as your new email address.`,
      title: 'Verify your new email',
      body: `
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0d1117;">Verify your new email</h1>
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 8px;">Hi <strong>${user.username}</strong>, click below to confirm <strong>${newEmail}</strong> as your new email address. This link expires in <strong>24 hours</strong>.</p>
        ${btn('Verify new email', url)}
        ${fallbackLink(url)}
        <p style="font-size:13px;color:#9ca3af;margin-top:24px;">If you didn't request this change, please secure your account immediately.</p>
      `,
    }),
  };
}
