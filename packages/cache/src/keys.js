/**
 * Centralised Redis key builders.
 * All keys are namespaced to avoid collisions between services.
 */

// Auth / brute-force
export const keys = {
  loginBrute:   (email)  => `sbf:brute:login:${email}`,
  totpBrute:    (userId) => `sbf:brute:totp:${userId}`,
  resetBrute:   (email)  => `sbf:brute:reset:${email}`,

  // Session (if moving from DB-backed to Redis-backed sessions)
  session:      (token)  => `sbf:session:${token}`,
  userSessions: (userId) => `sbf:user:sessions:${userId}`,

  // Notifications
  pushToken:    (userId) => `sbf:push:token:${userId}`,

  // Rate limiting
  rateLimit:    (ip)     => `sbf:rate:${ip}`,
};
