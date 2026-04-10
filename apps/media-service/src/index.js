import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { getServicePort } from '@sbf/config';
import { createLogger } from '@sbf/logger';
import uploadRouter from './routes/upload.js';

const serviceName = 'media-service';
const logger = createLogger(serviceName);
const port = getServicePort('MEDIA_SERVICE_PORT', 4017);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

// Ensure upload directories exist
fs.mkdirSync(path.join(UPLOAD_DIR, 'avatars'), { recursive: true });

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json());
app.use(cookieParser());

// Serve uploads as static assets
app.use('/uploads', express.static(UPLOAD_DIR));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: serviceName });
});

app.use('/upload', uploadRouter);

app.use((err, _req, res, _next) => {
  logger.error(err.message);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large (max 5 MB)' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  logger.info(`Listening on port ${port} — uploads at ${UPLOAD_DIR}`);
});
