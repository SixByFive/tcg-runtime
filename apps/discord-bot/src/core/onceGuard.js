// src/core/onceGuard.js
// Prevent double-handling of the same Interaction ID (e.g., multiple listeners)
const seen = new Set();

/**
 * Returns true the first time an interactionId is seen, false thereafter.
 * Auto-expires entry after 60s.
 */
export function guardOnce(interactionId) {
  if (!interactionId) return true;
  if (seen.has(interactionId)) return false;
  seen.add(interactionId);
  setTimeout(() => seen.delete(interactionId), 60_000);
  return true;
}
