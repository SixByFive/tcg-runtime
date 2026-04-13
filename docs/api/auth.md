# Auth Service API

**Base URL (via Gateway):** `http://localhost:4010`  
**Direct (internal/dev):** `http://localhost:4011`

All auth routes are mounted at `/auth`.

---

## Authentication Mechanisms

### Web clients
Tokens are stored as HttpOnly cookies. The client does not touch them directly.

| Cookie | Purpose | TTL |
|---|---|---|
| `sbf_access` | JWT access token | Short-lived (minutes) |
| `sbf_refresh` | Opaque refresh token (Redis-backed) | Long-lived (days) |
| `sbf_pending` | Temporary 2FA challenge token | ~5 minutes |

### Mobile clients
Send `X-Client-Type: mobile`. Tokens are returned in the JSON response body and stored by the client.

---

## Endpoints

### `POST /auth/register`
Register a new account.

**Rate limit:** 10 requests per hour per IP.

**Body:**
```json
{
  "username": "string (3–30 chars, letters/numbers/underscore)",
  "email": "string",
  "password": "string (min 8 chars)",
  "referrerId": "string (optional)"
}
```

**Response `201`:**
```json
{
  "user": { "id": "…", "username": "…", "email": "…", "isAdmin": false, … },
  "accessToken": "…",   // mobile only
  "refreshToken": "…"   // mobile only
}
```

Sends a verification email and welcome email on success.

---

### `POST /auth/login`
Log in with email and password.

**Body:**
```json
{ "email": "string", "password": "string" }
```

**Response `200` (no 2FA):**
```json
{
  "user": { … },
  "accessToken": "…",   // mobile only
  "refreshToken": "…"   // mobile only
}
```

**Response `200` (2FA enabled):**
```json
{ "requiresTwoFactor": true, "pendingToken": "…" }
```
`pendingToken` is included only for mobile clients; web clients receive it as the `sbf_pending` cookie.

**Error responses:**
- `401` — invalid credentials
- `403` — account suspended
- `429` — too many failed attempts (brute-force lockout)

---

### `POST /auth/2fa/challenge`
Complete a login when 2FA is required.

**Body:**
```json
{
  "token": "123456",
  "pendingToken": "…"   // mobile only; web reads from sbf_pending cookie
}
```

**Response `200`:** Same shape as a successful login (user + tokens).

---

### `POST /auth/logout`
Revoke the current session.

**Body (mobile only):** `{ "refreshToken": "…" }`  
**Response `204`**

---

### `POST /auth/refresh`
Rotate the access + refresh token pair.

**Body (mobile only):** `{ "refreshToken": "…" }`

**Response `200`:**
```json
{
  "user": { … },
  "accessToken": "…",   // mobile only
  "refreshToken": "…"   // mobile only
}
```

---

### `GET /auth/me`
🔒 *Requires auth*

Return the currently authenticated user.

**Response `200`:** `{ "user": { … } }`

---

### `POST /auth/google`
Sign in or register with a Google ID token (from Google Sign-In button).

**Body:** `{ "idToken": "string" }`  
**Response `200`:** Same as login.

---

## Two-Factor Authentication

### `POST /auth/2fa/setup`
🔒 *Requires auth* — Begin 2FA setup. Returns a TOTP secret and QR code data URL.

**Response `200`:**
```json
{
  "otpauthUrl": "otpauth://totp/…",
  "qrCodeDataURL": "data:image/png;base64,…"
}
```

### `POST /auth/2fa/verify`
🔒 *Requires auth* — Confirm setup with a valid TOTP code. Activates 2FA.

**Body:** `{ "token": "123456" }`  
**Response `200`:** `{ "success": true }`

### `DELETE /auth/2fa`
🔒 *Requires auth* — Disable 2FA (requires a valid TOTP code as confirmation).

**Body:** `{ "token": "123456" }`  
**Response `200`:** `{ "success": true }`

---

## Password Management

### `POST /auth/password/forgot`
Request a password reset email.

**Rate limit:** 5 requests per hour per email.  
**Body:** `{ "email": "string" }`  
**Response `200`:** `{ "message": "If that email exists, a reset link has been sent" }`

### `POST /auth/password/reset`
Reset password using the emailed token.

**Body:** `{ "token": "string", "password": "string (min 8 chars)" }`  
**Response `200`:** `{ "success": true }`  
All existing sessions are revoked on success.

### `PUT /auth/password`
🔒 *Requires auth* — Change password (requires current password).

**Body:** `{ "currentPassword": "string", "newPassword": "string" }`  
**Response `200`:** `{ "success": true }` + re-issued tokens.

---

## Email Management

### `POST /auth/email/verify`
Verify email address using the token from the verification email.

**Body:** `{ "token": "string" }`  
**Response `200`:** `{ "success": true }`

### `POST /auth/email/resend`
🔒 *Requires auth* — Resend verification email.

**Response `200`:** `{ "message": "Verification email sent" }`

### `PUT /auth/email`
🔒 *Requires auth* — Change email address (requires password confirmation).

**Body:** `{ "email": "string", "password": "string" }`  
**Response `200`:** `{ "message": "Email updated — please verify your new address" }`

---

## Health

### `GET /health`
**Response `200`:** `{ "status": "ok", "service": "auth-service" }`

---

## JWT Payload

```json
{
  "sub": "userId",
  "username": "string",
  "email": "string",
  "isAdmin": false,
  "iat": 0,
  "exp": 0
}
```
