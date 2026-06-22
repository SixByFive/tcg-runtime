import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createLogger } from '@sbf/logger';
import { requireAuth } from '@sbf/auth';

const logger = createLogger('media-service:upload');
const router = Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (!file.mimetype.startsWith('image/')) {
      return cb(Object.assign(new Error('Only images are allowed'), { status: 400 }));
    }
    cb(null, true);
  },
});

// POST /upload/avatar
router.post('/avatar', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  const userId = req.user.sub;
  const filename = `${userId}-${Date.now()}.webp`;
  const destPath = path.join(UPLOAD_DIR, 'avatars', filename);

  try {
    await sharp(req.file.buffer)
      .resize(256, 256, { fit: 'cover', position: 'attention' })
      .webp({ quality: 85 })
      .toFile(destPath);

    // Delete the old avatar when a replacement is uploaded
    const oldAvatar = req.headers['x-current-avatar'];
    if (oldAvatar) {
      const oldPath = path.join(UPLOAD_DIR, 'avatars', path.basename(oldAvatar));
      fs.unlink(oldPath).catch(() => {});
    }

    return res.json({ url: `/uploads/avatars/${filename}` });
  } catch (err) {
    logger.error('Avatar processing failed', { error: err.message });
    return res.status(500).json({ error: 'Upload failed' });
  }
});

export default router;
