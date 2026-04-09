// Re-export shared JWT helpers from @sbf/auth.
// Auth-service is the only service that signs tokens, but other services
// verify them — all JWT logic lives in the shared package.
export {
  REFRESH_EXPIRY_DAYS,
  REFRESH_EXPIRY_SECONDS,
  signAccessToken,
  verifyAccessToken,
  signPendingToken,
  verifyPendingToken,
  generateRefreshToken,
  setAuthCookies,
  setPendingCookie,
  clearAuthCookies,
} from '@sbf/auth';
