import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { getServicePort } from '@sbf/config';
import { createLogger } from '@sbf/logger';
import { initModels } from './models/index.js';
import authRouter from './routes/auth.js';

const serviceName = 'auth-service';
const logger = createLogger(serviceName);
const port = getServicePort('AUTH_SERVICE_PORT', 4011);

const app = express();

app.use(helmet());
app.use(cookieParser());
app.use(express.json());

// Global rate limit: 300 req/min per IP
app.use(rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));

// CORS — only allow explicitly configured origins with credentials
const allowedOrigins = [
  ...(process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean),
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:3000', 'http://localhost:4000'] : []),
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: serviceName }));

app.use('/auth', authRouter);

// Central error handler
app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { path: req.path, error: err.message });
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
});

async function start() {
  await initModels();
  app.listen(port, () => logger.info(`Listening on port ${port}`));
}

start().catch((err) => {
  logger.error('Failed to start', { error: err.message });
  process.exit(1);
});
