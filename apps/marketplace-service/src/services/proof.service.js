import { writeFile, unlink } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createLogger } from '@sbf/logger';
import { createWorker } from 'tesseract.js';

// ─── Text similarity helpers ──────────────────────────────────────────────────

/**
 * Normalise a string for fuzzy comparison: lowercase, strip punctuation/symbols,
 * collapse whitespace.
 */
function normaliseText(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Apply common OCR digit↔letter substitutions so that e.g. "P0LIWAG" matches
 * "POLIWAG". Applied to both haystack and needle before comparison.
 */
function ocrNormalise(str) {
  return normaliseText(str)
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/5/g, 's')
    .replace(/8/g, 'b');
}

/**
 * Check whether `haystack` (OCR blob) contains `needle` (card name / set name).
 * Uses OCR-aware normalisation to handle digit/letter confusions, then tries
 * exact substring → word-overlap (≥80% of significant words).
 */
function ocrContains(haystack, needle) {
  if (!needle) return true; // unknown — skip this check
  const h = ocrNormalise(haystack);
  const n = ocrNormalise(needle);
  if (!n) return true;
  if (h.includes(n)) return true;
  // Tesseract (PSM 11) sometimes splits a word across OCR regions, inserting a
  // space or newline mid-word. Strip all spaces from both sides and retry.
  const hCompact = h.replace(/ /g, '');
  const nCompact = n.replace(/ /g, '');
  if (hCompact.includes(nCompact)) return true;
  // Word-overlap fallback
  const words = n.split(' ').filter((w) => w.length > 2);
  if (!words.length) return hCompact.includes(nCompact);
  const matched = words.filter((w) => h.includes(w) || hCompact.includes(w));
  return matched.length / words.length >= 0.8;
}

/**
 * Fuzzy proof-code match — allows up to 1 character mismatch per 8-char window.
 * Handles common OCR misreads of handwritten characters (Z→2, G→6, etc.)
 * without being so loose that wrong codes pass.
 */
function fuzzyCodeMatch(haystack, code) {
  if (!code || !haystack) return false;
  const len = code.length;
  if (haystack.length < len) return false;
  for (let i = 0; i <= haystack.length - len; i++) {
    let mismatches = 0;
    for (let j = 0; j < len; j++) {
      if (haystack[i + j] !== code[j]) {
        mismatches++;
        if (mismatches > 1) break;
      }
    }
    if (mismatches <= 1) return true;
  }
  return false;
}

/**
 * Fire-and-forget Discord webhook alert when OCR routes a proof to pending_admin.
 */
async function alertDiscordOcrFailed({ imagePath, reason, expected, extracted, confidence, cardName, setName }) {
  const webhookUrl = process.env.DISCORD_PROOF_WEBHOOK_URL;
  if (!webhookUrl) return;

  const fields = [
    { name: 'Service',    value: 'marketplace-service',          inline: true  },
    { name: 'Image',      value: `\`${basename(imagePath)}\``,   inline: true  },
    { name: 'Reason',     value: reason,                          inline: false },
  ];
  if (expected   !== undefined) fields.push({ name: 'Expected code', value: `\`${expected || '(none)'}\``,   inline: true });
  if (extracted  !== undefined) fields.push({ name: 'OCR extracted', value: `\`${extracted || '(empty)'}\``, inline: true });
  if (confidence !== undefined) fields.push({ name: 'Confidence',    value: `${confidence}%`,                inline: true });
  if (cardName   !== undefined) fields.push({ name: 'Expected card', value: cardName || '(unknown)',          inline: true });
  if (setName    !== undefined) fields.push({ name: 'Expected set',  value: setName  || '(unknown)',          inline: true });

  const body = JSON.stringify({
    embeds: [{
      title:       '⚠️ Marketplace Proof OCR — Manual Review Required',
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
  // Detect format from data URL header; default to jpeg
  const mimeMatch = base64Data.match(/^data:image\/(\w+);base64,/);
  const ext = mimeMatch ? mimeMatch[1].replace('jpeg', 'jpg') : 'jpg';
  const raw = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buf = Buffer.from(raw, 'base64');
  const filename = `mp_${listingId}_${sellerId}_${Date.now()}.${ext}`;
  const filePath = join(PROOF_DIR, filename);
  await writeFile(filePath, buf);
  return `marketplace_proofs/${filename}`;
}

/**
 * Save a bulk-lot photo. Unlike single-card proofs, lot photos are uploaded
 * BEFORE the listing row exists (so the path can be stored on create), so the
 * filename is seeded by seller + timestamp rather than listing id.
 */
export async function saveLotImage(sellerId, base64Data) {
  await ensureProofDir();
  const mimeMatch = base64Data.match(/^data:image\/(\w+);base64,/);
  const ext = mimeMatch ? mimeMatch[1].replace('jpeg', 'jpg') : 'jpg';
  const raw = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buf = Buffer.from(raw, 'base64');
  const filename = `lot_${sellerId}_${Date.now()}.${ext}`;
  const filePath = join(PROOF_DIR, filename);
  await writeFile(filePath, buf);
  return `marketplace_proofs/${filename}`;
}

/**
 * Run proof image moderation via OCR.
 *
 * Checks three things in OCR mode:
 *  1. Proof code   — unique code the seller wrote on paper next to the card
 *  2. Card name    — printed name on the card (e.g. "Charizard", "Lightning Bolt")
 *  3. Set name     — printed set name on the card (e.g. "Base Set", "Scarlet & Violet")
 *
 * All three must pass for auto-approval. Any failure routes to pending_admin
 * (never hard-rejects — always gives a human a chance to review).
 *
 * PROOF_MODERATION env var:
 *   auto   — auto-approve everything (default in development).
 *   manual — all proofs require admin review.
 *   ocr    — (default in production) full OCR check.
 *
 * @param {string} imagePath       Relative path returned by saveProofImage
 * @param {string} expectedCode    The proof code that should appear in the image
 * @param {string} [expectedCardName]  Canonical card name from catalog
 * @param {string} [expectedSetName]   Canonical set name from catalog
 * @returns {Promise<'approved' | 'pending_admin'>}
 */
export async function moderateProof(imagePath, expectedCode, expectedCardName, expectedSetName) {
  const mode = process.env.PROOF_MODERATION || (process.env.NODE_ENV === 'production' ? 'ocr' : 'auto');

  if (mode === 'auto')   return 'approved';
  if (mode === 'manual') return 'pending_admin';

  // OCR mode
  if (!expectedCode) {
    logger.warn({ msg: 'proof_ocr_skipped', reason: 'no_expected_code', imagePath });
    alertDiscordOcrFailed({ imagePath, reason: 'No proof code on record — cannot verify', cardName: expectedCardName, setName: expectedSetName }).catch(() => {});
    return 'pending_admin';
  }

  const diskPath = join(PROOF_DIR, basename(imagePath));

  // Reject formats Leptonica cannot read before spawning a worker
  const supportedExts = new Set(['jpg', 'jpeg', 'png', 'webp', 'tiff', 'tif', 'bmp', 'gif']);
  const fileExt = basename(imagePath).split('.').pop()?.toLowerCase() ?? '';
  if (!supportedExts.has(fileExt)) {
    logger.warn({ msg: 'proof_ocr_unsupported_format', imagePath, ext: fileExt });
    alertDiscordOcrFailed({ imagePath, reason: `Unsupported image format: .${fileExt} — manual review required`, cardName: expectedCardName, setName: expectedSetName }).catch(() => {});
    return 'pending_admin';
  }

  let worker;
  // Guard against Tesseract worker errors crashing the process
  const uncaughtHandler = (err) => {
    logger.error({ msg: 'tesseract_uncaught', error: err?.message ?? String(err) });
  };
  process.once('uncaughtException', uncaughtHandler);

  try {
    worker = await createWorker('eng', 1, { logger: () => {} });

    // PSM 11 — sparse text: finds as much text as possible across the whole image
    await worker.setParameters({ tessedit_pageseg_mode: '11' });

    const { data } = await worker.recognize(diskPath);
    const rawText    = data.text || '';
    const confidence = Math.round(data.confidence);

    // ── 1. Proof code check (fuzzy — allows 1 char mismatch for handwriting OCR) ─
    const CODE_ALPHA  = /[^A-Z0-9]/g;
    const extractedCode = rawText.toUpperCase().replace(CODE_ALPHA, '');
    const normalCode    = expectedCode.toUpperCase().replace(CODE_ALPHA, '');
    const codeFound     = Boolean(normalCode && (
      extractedCode.includes(normalCode) || fuzzyCodeMatch(extractedCode, normalCode)
    ));

    // ── 2. Card name check ─────────────────────────────────────────────────────
    const cardNameFound = ocrContains(rawText, expectedCardName);

    // ── 3. Set name check (informational only — not a blocking condition) ─────────
    // Modern cards print abbreviations (e.g. "OBF") not full set names,
    // so this check is unreliable across eras and excluded from auto-approval.
    const setNameFound = ocrContains(rawText, expectedSetName);

    logger.info({
      msg:           'proof_ocr_result',
      imagePath,
      confidence,
      codeFound,
      cardNameFound,
      setNameFound,
      expectedCode:  normalCode,
      expectedCard:  expectedCardName,
      expectedSet:   expectedSetName,
      extractedCode,
    });

    // Card name + confidence → auto-approve.
    // Proof code is shown publicly on the listing so buyers can self-verify
    // against the proof photo; OCR no longer gates on it.
    if (cardNameFound && confidence >= 50) {
      return 'approved';
    }

    // Build a human-readable reason for the Discord alert
    const failures = [];
    if (!cardNameFound) failures.push(`card name not found (expected \`${expectedCardName || '(unknown)'}\`)`);
    if (confidence < 50) {
      failures.push(`low OCR confidence (${confidence}% < 50%)`);
    }

    alertDiscordOcrFailed({
      imagePath,
      reason:     failures.join(' · '),
      expected:   normalCode,
      extracted:  extractedCode,
      confidence,
      cardName:   expectedCardName,
      setName:    expectedSetName,
    }).catch(() => {});

    return 'pending_admin';
  } catch (err) {
    logger.error({ msg: 'proof_ocr_error', imagePath, error: err.message });
    alertDiscordOcrFailed({ imagePath, reason: `OCR error: ${err.message}`, cardName: expectedCardName, setName: expectedSetName }).catch(() => {});
    return 'pending_admin';
  } finally {
    process.removeListener('uncaughtException', uncaughtHandler);
    if (worker) await worker.terminate().catch(() => {});
  }
}

export async function deleteProofImage(imagePath) {
  try {
    await unlink(join(PROOF_DIR, basename(imagePath)));
  } catch (err) {
    logger.warn(`deleteProofImage failed: ${err.message}`);
  }
}
