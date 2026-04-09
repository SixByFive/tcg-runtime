import { Router } from 'express';
import { requireAdminKey } from '../middleware/requireAdminKey.js';
import { Scheduler } from '../scheduler/index.js';
import { ingestSet } from '../jobs/ingestSet.job.js';
import { collectPrices } from '../jobs/collectPrices.job.js';
import { fxDaily } from '../jobs/fxDaily.job.js';
import { rebuildPriceRollups } from '../jobs/rollup.job.js';
import { Set } from '../models/index.js';

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
