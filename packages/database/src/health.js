import { getSequelize } from './sequelize.js';

/**
 * Simple DB health probe used by service health endpoints.
 * Returns structured error details so connectivity issues are easier to debug.
 */
export async function checkDatabaseHealth() {
  try {
    const sequelize = getSequelize();
    await sequelize.authenticate();

    return {
      ok: true,
      status: 'up'
    };
  } catch (error) {
    return {
      ok: false,
      status: 'down',
      error: error?.message || 'Unknown database error',
      name: error?.name || null,
      code: error?.original?.code || error?.code || null,
      errno: error?.original?.errno || null,
      sqlState: error?.original?.sqlState || null,
      sqlMessage: error?.original?.sqlMessage || null
    };
  }
}