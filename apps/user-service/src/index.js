import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { getServicePort } from '@sbf/config';
import { createLogger } from '@sbf/logger';
import { initModels } from './models/index.js';
import usersRouter from './routes/users.js';
import adminRouter from './routes/admin.js';
import rewardsRouter from './routes/rewards.js';
import auditRouter from './routes/audit.js';
import safetyRouter from './routes/safety.js';

const serviceName = 'user-service';
const logger = createLogger(serviceName);
const port = getServicePort('USER_SERVICE_PORT', 4021);

const app = express();

app.use(helmet());
app.use(cookieParser());
app.use(express.json());
app.use(rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));

const allowedOrigins = (process.env.CORS_ORIGINS ?? '').split(',').map(o => o.trim()).filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: serviceName }));

app.use('/users', usersRouter);
app.use('/admin', adminRouter);
app.use('/rewards', rewardsRouter);
app.use('/audit', auditRouter);
app.use('/safety', safetyRouter);

app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { path: req.path, error: err.message });
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
});

async function start() {
  await initModels();
  app.listen(port, () => logger.info(`Listening on port ${port}`));
}

start().catch(err => {
  logger.error('Failed to start', { error: err.message });
  process.exit(1);
});
