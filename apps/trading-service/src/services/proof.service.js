import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from '@sbf/logger';

const logger = createLogger('trading-service:proof');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROOF_DIR = process.env.PROOF_DIR
  || path.join(__dirname, '..', '..', 'uploads', 'trade_proofs');

fs.mkdirSync(PROOF_DIR, { recursive: true });

/**
 * Save a base64-encoded proof image to disk.
 * Returns the stored file path (relative URL).
 */
export async function saveProofImage(tradeId, userId, base64Image) {
  // Strip data URI prefix if present
  const data = base64Image.replace(/^data:image\/\w+;base64,/, '');
  const buf  = Buffer.from(data, 'base64');
  const filename = `${tradeId}_${userId}_${Date.now()}.jpg`;
  const fullPath = path.join(PROOF_DIR, filename);
  await fs.promises.writeFile(fullPath, buf);
  return `/uploads/trade_proofs/${filename}`;
}

/**
 * Auto-approve proof moderation (MVP).
 * In production this would call an OCR/AI service to verify the proofCode.
 * Returns 'approved' | 'pending_admin'.
 */
export function moderateProof(_imagePath, _proofCode) {
  // If PROOF_MODERATION=manual in env, require admin review
  if (process.env.PROOF_MODERATION === 'manual') {
    return 'pending_admin';
  }
  return 'approved';
}

export function deleteProofImage(imagePath) {
  if (!imagePath) return;
  const base = path.basename(imagePath);
  fs.unlink(path.join(PROOF_DIR, base), (err) => {
    if (err && err.code !== 'ENOENT') {
      logger.error({ msg: 'proof_delete_failed', imagePath, error: err.message });
    }
  });
}
