/**
 * Shared config helpers for all services.
 */
export function getServicePort(envKey, fallbackPort) {
  return Number(process.env[envKey] || fallbackPort);
}

export function getSharedConfig() {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    databaseUrl:
      process.env.DATABASE_URL ||
      'postgres://postgres:postgres@localhost:5432/sixbyfive_tcg',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  };
}