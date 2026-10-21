import sharp from 'sharp';
import { createLogger } from '@sbf/logger';

const logger = createLogger('media-service:share-images');

const FETCH_TIMEOUT_MS = 6000;
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Fetch a remote image and return it as a PNG data URI sized for the template.
 * Satori cannot decode WebP (which the card catalog serves), so everything goes
 * through sharp. Returns null on any failure — templates fall back to a
 * placeholder rather than failing the whole render.
 */
export async function loadImage(url, { width, height, fit = 'contain' } = {}) {
  if (!url || typeof url !== 'string') return null;
  if (!/^https?:\/\//i.test(url)) return null;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;

    const declared = Number(res.headers.get('content-length') || 0);
    if (declared > MAX_BYTES) return null;

    const input = Buffer.from(await res.arrayBuffer());
    if (input.length > MAX_BYTES) return null;

    let pipeline = sharp(input);
    if (width || height) {
      pipeline = pipeline.resize({
        width,
        height,
        fit,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        withoutEnlargement: true,
      });
    }
    const out = await pipeline.png({ compressionLevel: 8 }).toBuffer();
    return `data:image/png;base64,${out.toString('base64')}`;
  } catch (err) {
    logger.warn(`image load failed (${url}): ${err.message}`);
    return null;
  }
}

/** Load many images in parallel, preserving order (nulls for failures). */
export function loadImages(urls, opts) {
  return Promise.all(urls.map((u) => loadImage(u, opts)));
}
