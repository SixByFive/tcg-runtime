import { writeFile, unlink } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createLogger } from '@sbf/logger';

const logger = createLogger('marketplace-service:proof');

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0 or I/1 confusion
const CODE_LENGTH = 8;
const PROOF_CODE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const PROOF_DIR = process.env.PROOF_DIR || '/var/uploads/marketplace_proofs';

export function generateProofCode() {
  const bytes = randomBytes(CODE_LENGTH);
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

export function proofCodeExpiry() {
  return new Date(Date.now() + PROOF_CODE_TTL_MS);
}

export async function ensureProofDir() {
  await mkdir(PROOF_DIR, { recursive: true });
}

export async function saveProofImage(listingId, sellerId, base64Data) {
  await ensureProofDir();
  const raw = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buf = Buffer.from(raw, 'base64');
  const filename = `mp_${listingId}_${sellerId}_${Date.now()}.jpg`;
  const filePath = join(PROOF_DIR, filename);
  await writeFile(filePath, buf);
  return filePath;
}

/**
 * Run proof image moderation.
 *
 * PROOF_MODERATION env var:
 *   auto   (default) — auto-approve everything. Use in development.
 *   manual           — all proofs require admin review.
 *
 * In production you would plug in Tesseract OCR to extract the code from the image
 * and compare it to expectedCode, falling back to 'pending_admin' on low confidence.
 *
 * @returns {'approved' | 'pending_admin'}
 */
export async function moderateProof(_imagePath, _expectedCode) {
  if ((process.env.PROOF_MODERATION || 'auto') === 'auto') return 'approved';
  return 'pending_admin';
}

export async function deleteProofImage(imagePath) {
  try {
    await unlink(join(PROOF_DIR, basename(imagePath)));
  } catch (err) {
    logger.warn(`deleteProofImage failed: ${err.message}`);
  }
}
