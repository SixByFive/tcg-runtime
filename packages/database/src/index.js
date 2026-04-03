/**
 * Shared database config placeholder.
 * Later this is where Sequelize init will live.
 */
import { getSharedConfig } from '@sbf/config';

export function getDatabaseConfig() {
  const config = getSharedConfig();

  return {
    url: config.databaseUrl,
  };
}