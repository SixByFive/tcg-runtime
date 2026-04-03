/**
 * Very small starter logger.
 */
export function createLogger(serviceName) {
  const prefix = `[${serviceName}]`;

  return {
    info(message, meta = {}) {
      console.log(prefix, message, meta);
    },
    warn(message, meta = {}) {
      console.warn(prefix, message, meta);
    },
    error(message, meta = {}) {
      console.error(prefix, message, meta);
    },
  };
}