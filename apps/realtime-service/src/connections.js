/**
 * In-memory connection registry.
 *
 * Stores a Set of connection objects per userId.
 * Each connection object exposes { send(payload), close() }.
 * Works for both WebSocket and SSE connections.
 */

// Map<userId, Set<connection>>
const store = new Map();

export function register(userId, conn) {
  if (!store.has(userId)) store.set(userId, new Set());
  store.get(userId).add(conn);
}

export function unregister(userId, conn) {
  const set = store.get(userId);
  if (!set) return;
  set.delete(conn);
  if (set.size === 0) store.delete(userId);
}

/**
 * Push a structured event to all connections for a single user.
 * Returns the number of connections successfully written to.
 */
export function push(userId, event, data) {
  const set = store.get(userId);
  if (!set || set.size === 0) return 0;
  const payload = JSON.stringify({ event, data, ts: Date.now() });
  let sent = 0;
  for (const conn of set) {
    try {
      conn.send(payload);
      sent++;
    } catch {
      set.delete(conn);
    }
  }
  return sent;
}

/**
 * Broadcast a structured event to every connected user.
 * Returns the total number of connections written to.
 */
export function broadcast(event, data) {
  const payload = JSON.stringify({ event, data, ts: Date.now() });
  let sent = 0;
  for (const [, set] of store) {
    for (const conn of set) {
      try {
        conn.send(payload);
        sent++;
      } catch {
        set.delete(conn);
      }
    }
  }
  return sent;
}

/** Number of distinct users with at least one live connection. */
export function connectedUserCount() {
  return store.size;
}
