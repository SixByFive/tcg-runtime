export function noop() {}

// Returns a promise that resolves after an exponential-backoff delay.
// Default: 400 ms × 1.6^attempt — matches the empirically tuned values used
// across catalog-service adapters and jobs.
export function backoffDelay(attempt, { base = 400, factor = 1.6 } = {}) {
  return new Promise(r => setTimeout(r, base * Math.pow(factor, attempt)));
}