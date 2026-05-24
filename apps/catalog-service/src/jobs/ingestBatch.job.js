/**
 * ingestBatch — runs ingestSet for an array of set codes sequentially.
 *
 * Payload:
 *   sets     {string[]}  — array of set codes to ingest in order
 *   refresh  {boolean}   — passed through to ingestSet (default false)
 *   pauseMs  {number}    — pause between each set in ms (default 500)
 *   dryRun   {boolean}   — passed through to ingestSet (default false)
 */
import { ingestSet } from './ingestSet.job.js';
import { createLogger } from '@sbf/logger';

const logger = createLogger('catalog:ingest-batch');

export async function ingestBatch({ sets = [], refresh = false, pauseMs = 500, dryRun = false, logger: log = logger } = {}) {
  if (!sets.length) {
    log.warn('ingestBatch: no sets provided');
    return { results: [] };
  }

  const results = [];

  for (let i = 0; i < sets.length; i++) {
    const setCode = sets[i];
    log.info(`ingestBatch: [${i + 1}/${sets.length}] ingesting ${setCode}`);
    try {
      const result = await ingestSet({ input: setCode, refresh, dryRun });
      results.push({ code: setCode, ok: true, ...result });
      log.info(`ingestBatch: [${i + 1}/${sets.length}] ${setCode} done`);
    } catch (err) {
      log.error(`ingestBatch: [${i + 1}/${sets.length}] ${setCode} failed — ${err.message}`);
      results.push({ code: setCode, ok: false, error: err.message });
    }

    if (pauseMs > 0 && i < sets.length - 1) {
      await new Promise((r) => setTimeout(r, pauseMs));
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed    = results.filter((r) => !r.ok).length;
  log.info(`ingestBatch: complete — ${succeeded} ok, ${failed} failed`);

  return { results, succeeded, failed };
}
