// NEW: optional DB connector (safe no-op if you haven't created tables yet)
import { Sequelize } from "sequelize";
import { ENV } from "../config/env.js";

let sequelize;

export function getSequelize() {
  if (sequelize) return sequelize;
  if (!ENV.DB_HOST || !ENV.DB_NAME || !ENV.DB_USER) {
    console.warn("[DB] Skipping DB connect (no DB_* env set).");
    return undefined;
    // You can wire real models later.
  }
  sequelize = new Sequelize(ENV.DB_NAME, ENV.DB_USER, ENV.DB_PASS, {
    host: ENV.DB_HOST,
    port: ENV.DB_PORT,
    dialect: "mysql",
    logging: false
  });
  return sequelize;
}

export async function closeSequelize() {
  if (!sequelize) return;
  await sequelize.close();
  sequelize = undefined;
}
