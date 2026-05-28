import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from '@sbf/logger';
import { createWorker } from 'tesseract.js';

const logger = createLogger('trading-service:proof');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROOF_DIR = process.env.PROOF_DIR
  || path.join(__dirname, '..', '..', 'uploads', 'trade_proofs');

fs.mkdirSync(PROOF_DIR, { recursive: true });

/**
 * Fire-and-forget Discord webhook alert when OCR routes a proof to pending_admin.
 */
async function alertDiscordOcrFailed({ imagePath, reason, expected, extracted, confidence }) {
  const webhookUrl = process.env.DISCORD_PROOF_WEBHOOK_URL;
  if (!webhookUrl) return;

  const fields = [
    { name: 'Service',    value: 'trading-service',             inline: true  },
    { name: 'Image',      value: `\`${path.basename(imagePath)}\``, inline: true  },
    { name: 'Reason',     value: reason,                         inline: false },
  ];
  if (expected  !== undefined) fields.push({ name: 'Expected code',  value: `\`${expected || '(none)'}\``,  inline: true });
  if (extracted !== undefined) fields.push({ name: 'OCR extracted',  value: `\`${extracted || '(empty)'}\``, inline: true });
  if (confidence !== undefined) fields.push({ name: 'Confidence',    value: `${confidence}%`,                inline: true });

  const body = JSON.stringify({
    embeds: [{
      title:       '⚠️ Trade Proof OCR — Manual Review Required',
      description: 'A proof image could not be auto-approved and has been queued for admin review.',
      color:       0xF97316, // orange-500
      fields,
      timestamp:   new Date().toISOString(),
    }],
  });

  try {
    await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch (err) {
    logger.warn({ msg: 'discord_webhook_failed', error: err.message });
  }
}

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
 * Run proof image moderation via OCR.
 *
 * PROOF_MODERATION env var:
 *   auto   — auto-approve everything (default in development).
 *   manual — all proofs require admin review.
 *   ocr    — (default in production) extract code from the image via Tesseract;
 *             approve if it matches, otherwise route to admin queue.
 *
 * @param {string} imagePath  Path as returned by saveProofImage (e.g. "/uploads/trade_proofs/xxx.jpg")
 * @param {string} proofCode  The proof code that should appear in the image
 * @returns {Promise<'approved' | 'pending_admin'>}
 */
export async function moderateProof(imagePath, proofCode) {
  const mode = process.env.PROOF_MODERATION || (process.env.NODE_ENV === 'production' ? 'ocr' : 'auto');

  if (mode === 'auto')   return 'approved';
  if (mode === 'manual') return 'pending_admin';

  // OCR mode
  if (!proofCode) {
    logger.warn({ msg: 'proof_ocr_skipped', reason: 'no_expected_code', imagePath });
    alertDiscordOcrFailed({ imagePath, reason: 'No proof code on record — cannot verify' }).catch(() => {});
    return 'pending_admin';
  }

  // Build absolute disk path from stored path (strip leading slash, join with PROOF_DIR parent)
  const diskPath = path.join(PROOF_DIR, path.basename(imagePath));

  let worker;
  try {
    worker = await createWorker('eng', 1, { logger: () => {} });

    // PSM 11 — sparse text: best for codes written on paper among other content
    await worker.setParameters({ tessedit_pageseg_mode: '11' });

    const { data } = await worker.recognize(diskPath);

    const CODE_ALPHA = /[^A-Z0-9]/g;
    const extracted  = (data.text || '').toUpperCase().replace(CODE_ALPHA, '');
    const expected   = proofCode.toUpperCase().replace(CODE_ALPHA, '');

    logger.info({
      msg:        'proof_ocr_result',
      imagePath,
      expected,
      extracted,
      confidence: Math.round(data.confidence),
    });

    if (expected && extracted.includes(expected) && data.confidence >= 50) {
      return 'approved';
    }

    // OCR ran but code didn't match or confidence was too low
    const confidence = Math.round(data.confidence);
    const reason = extracted.includes(expected)
      ? `Low confidence (${confidence}% < 50%)`
      : `Code mismatch — expected \`${expected}\`, OCR read \`${extracted || '(nothing)'}\` (confidence ${confidence}%)`;
    alertDiscordOcrFailed({ imagePath, reason, expected, extracted, confidence }).catch(() => {});

    return 'pending_admin';
  } catch (err) {
    logger.error({ msg: 'proof_ocr_error', imagePath, error: err.message });
    alertDiscordOcrFailed({ imagePath, reason: `OCR error: ${err.message}` }).catch(() => {});
    return 'pending_admin';
  } finally {
    if (worker) await worker.terminate().catch(() => {});
  }
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
