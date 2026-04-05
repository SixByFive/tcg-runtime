import { getSharedConfig } from '@sbf/config';
import { getSequelize } from './sequelize.js';
import { checkDatabaseHealth } from './health.js';

export function getDatabaseConfig() {
  const config = getSharedConfig();

  return {
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    pass: config.db.pass,
    name: config.db.name
  };
}

export {
  getSequelize,
  checkDatabaseHealth
};