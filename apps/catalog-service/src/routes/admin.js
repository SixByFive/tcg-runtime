import { Router } from 'express';
import { Op, Sequelize } from 'sequelize';
import { requireAdminKey } from '../middleware/requireAdminKey.js';
import { Scheduler } from '../scheduler/index.js';
import { seedStandardTasks, STANDARD_TASKS } from '../scheduler/seedTasks.js';
import { ingestSet } from '../jobs/ingestSet.job.js';
import { collectPrices } from '../jobs/collectPrices.job.js';
import { fxDaily } from '../jobs/fxDaily.job.js';
import { rebuildPriceRollups } from '../jobs/rollup.job.js';
import { getFx } from '../services/fx.service.js';
import { Set, Card } from '../models/index.js';
import { ALIASES } from '../seed/setAliases.js';

const router = Router();

// All admin routes require admin key
router.use(requireAdminKey);

// ---- Scheduler ----

// GET /admin/scheduler — list all tasks
router.get('/scheduler', async (req, res) => {
  try {
    const tasks = await Scheduler.list();
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/scheduler — add a cron task
// body: { cronExp, name, payload, timezone, description, enabled }
router.post('/scheduler', async (req, res) => {
  try {
    const { cronExp, name, payload, timezone, description, enabled } = req.body;
    if (!cronExp || !name) return res.status(400).json({ error: 'cronExp and name are required' });
    const id = await Scheduler.addCron(cronExp, name, payload || {}, { timezone, description, enabled });
    res.status(201).json({ id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /admin/scheduler/:id — update a cron task
router.patch('/scheduler/:id', async (req, res) => {
  try {
    const task = await Scheduler.updateCron(req.params.id, req.body);
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /admin/scheduler/:id/run — run a task immediately
router.post('/scheduler/:id/run', async (req, res) => {
  try {
    const result = await Scheduler.runNow(req.params.id);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/scheduler/:id/pause
router.post('/scheduler/:id/pause', async (req, res) => {
  try {
    await Scheduler.pause(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /admin/scheduler/:id/resume
router.post('/scheduler/:id/resume', async (req, res) => {
  try {
    await Scheduler.resume(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /admin/scheduler/:id
router.delete('/scheduler/:id', async (req, res) => {
  try {
    await Scheduler.cancel(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /admin/scheduler/seed — seeds the standard ingest schedule (idempotent)
router.post('/scheduler/seed', async (req, res) => {
  try {
    const result = await seedStandardTasks(Scheduler);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/scheduler/seed — preview what would be seeded
router.get('/scheduler/seed', async (req, res) => {
  res.json({ total: STANDARD_TASKS.length, tasks: STANDARD_TASKS });
});

// ---- Ad-hoc jobs ----

// POST /admin/jobs/ingest — { input, refresh, dryRun }
router.post('/jobs/ingest', async (req, res) => {
  try {
    const { input, refresh, dryRun } = req.body;
    if (!input) return res.status(400).json({ error: 'input is required' });
    const result = await ingestSet({ input, refresh: !!refresh, dryRun: !!dryRun });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/jobs/ingest-all — ingest every known set, sequentially
// Optional body: { refresh: bool, dryRun: bool, only: ["sv01","sv02",...] }
router.post('/jobs/ingest-all', async (req, res) => {
  const { refresh = false, dryRun = false, only } = req.body || {};
  const codes = only?.length ? only : Object.keys(ALIASES);

  // Stream progress as newline-delimited JSON so callers can watch live.
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.flushHeaders();

  let succeeded = 0;
  let failed = 0;

  for (const code of codes) {
    try {
      const result = await ingestSet({ input: code, refresh: !!refresh, dryRun: !!dryRun });
      succeeded++;
      res.write(JSON.stringify({ code, ok: true, cards: result?.cards ?? null }) + '\n');
    } catch (err) {
      failed++;
      res.write(JSON.stringify({ code, ok: false, error: err.message }) + '\n');
    }
  }

  res.write(JSON.stringify({ done: true, succeeded, failed, total: codes.length }) + '\n');
  res.end();
});

// POST /admin/jobs/collect — { set, since, dryRun, providers }
router.post('/jobs/collect', async (req, res) => {
  try {
    const { set, since, dryRun, providers } = req.body;
    if (!set) return res.status(400).json({ error: 'set is required' });
    const result = await collectPrices({ set, since, dryRun: !!dryRun, providers });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/jobs/fx-daily — { backfillDays }
router.post('/jobs/fx-daily', async (req, res) => {
  try {
    const { backfillDays } = req.body;
    const result = await fxDaily({ backfillDays: backfillDays ? Number(backfillDays) : undefined });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/jobs/rollups — { scope, set, cardId, asOf }
router.post('/jobs/rollups', async (req, res) => {
  try {
    const { scope, set, cardId, asOf, batchSize } = req.body;
    const result = await rebuildPriceRollups({ scope: scope || 'all', set, cardId, asOf, batchSize });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/sets — search sets for admin UI
router.get('/sets', async (req, res) => {
  try {
    const { q, page = 1, pageSize = 100 } = req.query;
    const limit = Math.min(500, Math.max(1, Number(pageSize)));
    const offset = (Math.max(1, Number(page)) - 1) * limit;
    const where = q ? { [Op.or]: [
      { code: { [Op.like]: `%${q}%` } },
      { name: { [Op.like]: `%${q}%` } },
      { abbreviation: { [Op.like]: `%${q}%` } },
    ] } : {};
    const { count, rows } = await Set.findAndCountAll({
      where, limit, offset, order: [['release_date', 'DESC']],
      attributes: ['code', 'name', 'era', 'release_date', 'abbreviation', 'official_count', 'total_cards'],
    });

    // total_cards/official_count come from upstream set metadata and can
    // stay null for a while after a set releases — they don't reflect what
    // we've actually ingested. Count real m_cards rows too so this page
    // (whose whole purpose is ingestion status) doesn't show "—" for sets
    // that already have cards.
    const codes = rows.map(r => r.code);
    let ingestedByCode = {};
    if (codes.length) {
      const counts = await Card.findAll({
        where: { set_code: { [Op.in]: codes } },
        attributes: ['set_code', [Sequelize.fn('COUNT', Sequelize.col('id')), 'cnt']],
        group: ['set_code'],
        raw: true,
      });
      ingestedByCode = Object.fromEntries(counts.map(c => [c.set_code, Number(c.cnt)]));
    }

    const sets = rows.map(r => ({ ...r.toJSON(), ingested_cards: ingestedByCode[r.code] ?? 0 }));
    res.json({ total: count, page: Number(page), pageSize: limit, sets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/fx/rates — current FX rates from cache
router.get('/fx/rates', async (req, res) => {
  try {
    const { date } = req.query;
    const fx = await getFx({ date: date || undefined });
    res.json(fx);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/sets/:code/toggle — enable or disable a set
router.post('/sets/:code/toggle', async (req, res) => {
  try {
    const set = await Set.findByPk(req.params.code);
    if (!set) return res.status(404).json({ error: 'Set not found' });
    await set.update({ enabled: !set.enabled });
    res.json({ code: set.code, enabled: set.enabled });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/sets/:code/ensure-tasks — ensure scheduled tasks exist for a set
router.post('/sets/:code/ensure-tasks', async (req, res) => {
  try {
    await Scheduler.ensureSetTasks(req.params.code);
    res.json({ ok: true, setCode: req.params.code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
