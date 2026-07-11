// Pre-warm ECB FX cache so price collection can convert currencies without extra HTTP calls.

import fs from 'node:fs/promises';
import path from 'node:path';
import { backoffDelay } from '@sbf/utils';
import { getFx } from '../services/fx.service.js';

const ECB_90D_XML = process.env.ECB_90D_XML || 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml';
const CACHE_DIR = process.env.FX_CACHE_DIR || '/tmp/sbf-fx-cache';

function todayISO() { return new Date().toISOString().slice(0, 10); }

function normalizeDateStr(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function backfillDates(dateStr, days) {
  const out = [];
  const d0 = new Date(`${dateStr}T00:00:00Z`);
  for (let i = 0; i < days; i++) {
    const di = new Date(d0);
    di.setUTCDate(di.getUTCDate() - i);
    out.push(di.toISOString().slice(0, 10));
  }
  return out;
}

function cachePath(date) {
  return path.join(CACHE_DIR, `ecb-${date}.json`);
}

async function fetchWithRetry(url, { retries = 3 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
      if (i < retries) await backoffDelay(i);
    }
  }
  throw lastErr;
}

function parseEcb90d(xml) {
  const byDate = new Map();
  if (!xml) return byDate;
  const compact = xml.replace(/\s+/g, ' ');
  const dateRe = /<Cube\s+time="([\d-]+)"\s*>((?:(?!<\/Cube>).)*?)<\/Cube>/g;
  let m;
  while ((m = dateRe.exec(compact)) !== null) {
    const date = m[1];
    const rates = Object.create(null);
    const rowRe = /<Cube\s+currency="([A-Z]{3})"\s+rate="([\d.]+)"/g;
    let r;
    while ((r = rowRe.exec(m[2])) !== null) {
      const n = Number(r[2]);
      if (Number.isFinite(n)) rates[r[1]] = n;
    }
    if (Object.keys(rates).length > 0) byDate.set(date, { base: 'EUR', date, rates });
  }
  return byDate;
}

export async function fxDaily({ date, prewarm90d = true, backfillDays, logger = console } = {}) {
  const started = Date.now();
  const refDate = normalizeDateStr(date) || todayISO();
  await fs.mkdir(CACHE_DIR, { recursive: true });

  if (Number.isInteger(backfillDays) && backfillDays > 0) {
    const dates = backfillDates(refDate, backfillDays);
    let written = 0;
    for (const d of dates) {
      try {
        const fx = await getFx({ date: d });
        if (fx?.date) written++;
      } catch (e) {
        logger.warn?.(`fxDaily backfill failed for ${d}: ${e?.message}`);
      }
    }
    return { ok: true, mode: 'backfill', fxDate: refDate, counts: { attempted: dates.length, written }, ms: Date.now() - started };
  }

  // prewarm90d: single network call, write all days
  const xml = await fetchWithRetry(ECB_90D_XML);
  const byDate = parseEcb90d(xml);
  if (byDate.size === 0) throw new Error('fxDaily: ECB feed parsed with zero dates');

  let written = 0;
  for (const [d, payload] of byDate) {
    const file = cachePath(d);
    try {
      await fs.access(file);
      // already exists, skip
    } catch {
      const tmp = `${file}.tmp-${Date.now()}`;
      await fs.writeFile(tmp, JSON.stringify(payload, null, 2), 'utf8');
      await fs.rename(tmp, file);
      written++;
    }
  }

  return {
    ok: true,
    mode: 'prewarm90d',
    fxDate: refDate,
    counts: { attempted: byDate.size, written, fromNetwork: 1 },
    ms: Date.now() - started,
  };
}
