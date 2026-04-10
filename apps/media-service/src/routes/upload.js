import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { requireAuth } from '@sbf/auth';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
const AVATAR_DIR = path.join(UPLOAD_DIR, 'avatars');

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Multer uses memory storage so we can pipe through sharp before saving
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only jpeg, png or webp allowed'));
  },
});

function sanitizeUsername(name) {
  return String(name || 'user').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
}

function avatarFilename(username) {
  const safe = sanitizeUsername(username);
  return `${safe}_${Date.now()}.webp`;
}

function deleteOldAvatar(filename) {
  if (!filename) return;
  // filename may be a full path like /uploads/avatars/foo.webp — extract basename
  const base = path.basename(filename);
  const full = path.join(AVATAR_DIR, base);
  fs.unlink(full, () => {});
}

// POST /upload/avatar
router.post('/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const filename = avatarFilename(req.user.username);
  const outPath = path.join(AVATAR_DIR, filename);

  try {
    // Resize + convert to webp (256×256, cover crop)
    await sharp(req.file.buffer)
      .resize(256, 256, { fit: 'cover', position: 'attention' })
      .webp({ quality: 85 })
      .toFile(outPath);

    // Delete old avatar if header provided (sent by user-service or client)
    const oldAvatar = req.headers['x-current-avatar'] || req.body?.currentAvatar;
    deleteOldAvatar(oldAvatar);

    const url = `/uploads/avatars/${filename}`;
    res.json({ ok: true, url });
  } catch (err) {
    // Clean up partial file
    fs.unlink(outPath, () => {});
    res.status(500).json({ error: 'Image processing failed' });
  }
});

// DELETE /upload/avatar — remove avatar file
router.delete('/avatar', requireAuth, (req, res) => {
  const { filename } = req.body ?? {};
  if (!filename) return res.status(400).json({ error: 'filename required' });

  // Only allow deleting files in the avatars directory
  const base = path.basename(filename);
  const full = path.join(AVATAR_DIR, base);

  fs.unlink(full, (err) => {
    if (err?.code === 'ENOENT') return res.status(404).json({ error: 'File not found' });
    if (err) return res.status(500).json({ error: 'Could not delete file' });
    res.json({ ok: true });
  });
});

export default router;
