// ECB FX service with file-based cache.
// Cache dir is configurable via FX_CACHE_DIR env var (defaults to /tmp/sbf-fx-cache).

import fs from 'node:fs/promises';
import path from 'node:path';
import { backoffDelay } from '@sbf/utils';

const ECB_90D_XML = process.env.ECB_90D_XML || 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml';
const CACHE_DIR = process.env.FX_CACHE_DIR || '/tmp/sbf-fx-cache';
const MAX_LOOKBACK_DAYS = 10;
const DEFAULT_ROUND_DP = 4;

export async function getFx(opts = {}) {
  const target = normalizeDateStr(opts.date) || todayISO();
  await fs.mkdir(CACHE_DIR, { recursive: true });

  const datesToTry = backfillDates(target, MAX_LOOKBACK_DAYS);

  for (const d of datesToTry) {
    const cached = await readCache(d);
    if (cached) return cached;
  }

  const byDate = await fetchEcb90dIndexed();
  for (const d of datesToTry) {
    const entry = byDate.get(d);
    if (entry) {
      await writeCache(d, entry);
      return entry;
    }
  }

  if (byDate.size > 0) {
    const newest = Array.from(byDate.keys()).sort().pop();
    const entry = byDate.get(newest);
    await writeCache(newest, entry);
    return entry;
  }

  throw new Error('FX: Unable to obtain ECB rates (no cache and network unavailable).');
}

export async function convert(amount, fromCcy, toCcy = 'GBP', opts = {}) {
  const amt = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(amt)) return null;

  const from = normCcy(fromCcy);
  const to = normCcy(toCcy);
  if (!from || !to) return null;
  if (from === to) return round(amt, opts.round ?? DEFAULT_ROUND_DP);

  const fx = await getFx({ date: opts.date });
  const fromPerEUR = from === 'EUR' ? 1 : fx.rates[from];
  const toPerEUR = to === 'EUR' ? 1 : fx.rates[to];

  if (!Number.isFinite(fromPerEUR) || !Number.isFinite(toPerEUR) || fromPerEUR === 0) return null;

  return round(amt * (toPerEUR / fromPerEUR), opts.round ?? DEFAULT_ROUND_DP);
}

export async function toGBP(amount, fromCcy, opts = {}) {
  return convert(amount, fromCcy, 'GBP', opts);
}

// ---- ECB fetch ----

async function fetchEcb90dIndexed() {
  const res = await fetchWithRetry(ECB_90D_XML);
  const byDate = new Map();
  const compact = res.replace(/\s+/g, ' ');
  const dateRe = /<Cube\s+time="([\d-]+)"\s*>((?:(?!<\/Cube>).)*?)<\/Cube>/g;
  let m;
  while ((m = dateRe.exec(compact)) !== null) {
    const date = m[1];
    const inner = m[2];
    const rates = Object.create(null);
    const rowRe = /<Cube\s+currency="([A-Z]{3})"\s+rate="([\d.]+)"/g;
    let r;
    while ((r = rowRe.exec(inner)) !== null) {
      const n = Number(r[2]);
      if (Number.isFinite(n)) rates[r[1]] = n;
    }
    if (Object.keys(rates).length > 0) byDate.set(date, { base: 'EUR', date, rates });
  }
  if (byDate.size === 0) throw new Error('FX: ECB parse produced no rates.');
  return byDate;
}

// ---- Cache helpers ----

async function readCache(date) {
  try {
    const buf = await fs.readFile(cachePath(date), 'utf8');
    const json = JSON.parse(buf);
    if (json?.base === 'EUR' && typeof json.date === 'string' && json.rates) return json;
  } catch { /* ignore */ }
  return null;
}

async function writeCache(date, payload) {
  const file = cachePath(date);
  const tmp = `${file}.tmp-${Date.now()}`;
  await fs.writeFile(tmp, JSON.stringify(payload, null, 2), 'utf8');
  await fs.rename(tmp, file);
}

function cachePath(date) {
  return path.join(CACHE_DIR, `ecb-${date}.json`);
}

// ---- Net ----

async function fetchWithRetry(url, { retries = 3 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (i < retries) await backoffDelay(i);
    }
  }
  throw lastErr;
}

// ---- Utils ----

function normCcy(x) {
  if (!x) return null;
  return String(x).trim().toUpperCase();
}

function round(n, dp) {
  const f = Math.pow(10, dp | 0);
  return Math.round(n * f) / f;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDateStr(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function backfillDates(dateStr, maxBack = 10) {
  const out = [];
  const d0 = new Date(`${dateStr}T00:00:00Z`);
  for (let i = 0; i <= maxBack; i++) {
    const di = new Date(d0);
    di.setUTCDate(di.getUTCDate() - i);
    out.push(di.toISOString().slice(0, 10));
  }
  return out;
}
