import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

function loadEnvFile(filePath) {
  if (fs.existsSync(filePath)) {
    dotenv.config({ path: filePath, override: false });
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * packages/config/src/index.js
 * -> packages/config/src
 * -> packages/config
 * -> packages
 * -> repo root
 */
const repoRoot = path.resolve(__dirname, '../../..');
const envDir = path.join(repoRoot, 'env');

const serviceName =
  process.env.SERVICE_NAME ||
  process.env.npm_package_name?.replace('@sbf/', '') ||
  '';

loadEnvFile(path.join(envDir, '.env.shared'));

if (serviceName) {
  loadEnvFile(path.join(envDir, `.env.${serviceName}`));
}

export function getServicePort(envKey, fallbackPort) {
  return Number(process.env[envKey] || fallbackPort);
}

export function getSharedConfig() {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    db: {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      pass: process.env.DB_PASS || '',
      name: process.env.DB_NAME || '',
    },
  };
}