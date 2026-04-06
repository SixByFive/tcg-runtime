// DB-backed scheduler using node-cron.
// Cron tasks are persisted in the scheduler_tasks table.
// On startup, tasks are loaded from DB and scheduled.

import cron from 'node-cron';
import { v4 as uuid } from 'uuid';
import { SchedulerTask } from '../models/index.js';
import { ingestSet } from '../jobs/ingestSet.job.js';
import { collectPrices } from '../jobs/collectPrices.job.js';
import { fxDaily } from '../jobs/fxDaily.job.js';
import { rebuildPriceRollups } from '../jobs/rollup.job.js';
import { createLogger } from '@sbf/logger';

const logger = createLogger('scheduler');

const JOBS = {
  ingestSet: (payload) => ingestSet(payload),
  collectPrices: (payload) => collectPrices(payload),
  fxDaily: (payload) => fxDaily(payload),
  priceRollups: (payload) => rebuildPriceRollups(payload),
};

// In-memory registry of running cron handles: id -> cron.ScheduledTask
const handles = new Map();

function serializeError(err) {
  if (!err) return null;
  return err instanceof Error ? err.message : String(err);
}

function createRunner(id, name, payload) {
  return async () => {
    const fn = JOBS[name];
    if (!fn) return;
    try {
      await SchedulerTask.update({ status: 'running', last_run_at: new Date() }, { where: { id } });
      await fn(payload || {});
      await SchedulerTask.update({ status: 'idle', last_error: null, tries: cron.getTasks ? undefined : undefined }, { where: { id } });
      // Increment tries
      await SchedulerTask.increment('tries', { where: { id } });
    } catch (err) {
      logger.error({ msg: 'scheduler.job_failed', jobId: id, name, error: serializeError(err) });
      await SchedulerTask.update({ status: 'error', last_error: serializeError(err) }, { where: { id } }).catch(() => {});
    }
  };
}

export const Scheduler = {
  async init() {
    const tasks = await SchedulerTask.findAll({ where: { enabled: true } });
    for (const task of tasks) {
      const { id, name, cron_exp, payload, timezone } = task;
      if (!cron.validate(cron_exp)) {
        logger.warn({ msg: 'scheduler.invalid_cron', id, name, cron_exp });
        continue;
      }
      const fn = JOBS[name];
      if (!fn) {
        logger.warn({ msg: 'scheduler.unknown_job', id, name });
        continue;
      }
      const handle = cron.schedule(cron_exp, createRunner(id, name, payload), {
        scheduled: true,
        timezone: timezone || undefined,
      });
      handles.set(id, handle);
    }
    logger.info({ msg: 'scheduler.init', loaded: tasks.length });
  },

  async addCron(cronExp, name, payload = {}, { id, timezone, description, enabled = true } = {}) {
    if (!JOBS[name]) throw new Error(`Unknown job: ${name}`);
    if (!cron.validate(cronExp)) throw new Error(`Invalid cron expression: ${cronExp}`);

    const taskId = id || uuid();
    await SchedulerTask.upsert({
      id: taskId,
      name,
      cron_exp: cronExp,
      payload,
      timezone: timezone || null,
      description: description || null,
      enabled,
      status: enabled ? 'idle' : 'paused',
      tries: 0,
    });

    if (enabled) {
      const existing = handles.get(taskId);
      if (existing) existing.stop();

      const handle = cron.schedule(cronExp, createRunner(taskId, name, payload), {
        scheduled: true,
        timezone: timezone || undefined,
      });
      handles.set(taskId, handle);
    }

    return taskId;
  },

  async updateCron(id, options = {}) {
    const task = await SchedulerTask.findByPk(id);
    if (!task) throw new Error('Task not found');

    const cronExp = options.cronExp || task.cron_exp;
    if (!cron.validate(cronExp)) throw new Error(`Invalid cron expression: ${cronExp}`);

    const updates = {};
    if (options.cronExp) updates.cron_exp = options.cronExp;
    if (options.payload !== undefined) updates.payload = options.payload;
    if (options.timezone !== undefined) updates.timezone = options.timezone;
    if (options.description !== undefined) updates.description = options.description;
    if (options.enabled !== undefined) updates.enabled = options.enabled;

    await task.update(updates);

    const existing = handles.get(id);
    if (existing) existing.stop();

    const enabled = options.enabled ?? task.enabled;
    if (enabled) {
      const name = task.name;
      const payload = options.payload ?? task.payload;
      const timezone = options.timezone ?? task.timezone;
      const handle = cron.schedule(cronExp, createRunner(id, name, payload), {
        scheduled: true,
        timezone: timezone || undefined,
      });
      handles.set(id, handle);
    } else {
      handles.delete(id);
    }

    return task.reload();
  },

  async runNow(id) {
    const task = await SchedulerTask.findByPk(id);
    if (!task) throw new Error('Task not found');
    const fn = JOBS[task.name];
    if (!fn) throw new Error(`Unknown job: ${task.name}`);

    await SchedulerTask.update({ status: 'running', last_run_at: new Date() }, { where: { id } });
    let result;
    try {
      result = await fn(task.payload || {});
      await SchedulerTask.update({ status: 'idle', last_error: null }, { where: { id } });
      await SchedulerTask.increment('tries', { where: { id } });
    } catch (err) {
      await SchedulerTask.update({ status: 'error', last_error: serializeError(err) }, { where: { id } });
      throw err;
    }
    return result;
  },

  async runAdhoc(name, payload = {}) {
    const fn = JOBS[name];
    if (!fn) throw new Error(`Unknown job: ${name}`);
    return fn(payload);
  },

  async pause(id) {
    const existing = handles.get(id);
    if (existing) { existing.stop(); handles.delete(id); }
    await SchedulerTask.update({ status: 'paused', enabled: false }, { where: { id } });
  },

  async resume(id) {
    const task = await SchedulerTask.findByPk(id);
    if (!task) throw new Error('Task not found');
    if (!cron.validate(task.cron_exp)) throw new Error('Invalid cron expression in task');
    const fn = JOBS[task.name];
    if (!fn) throw new Error(`Unknown job: ${task.name}`);

    const handle = cron.schedule(task.cron_exp, createRunner(id, task.name, task.payload), {
      scheduled: true,
      timezone: task.timezone || undefined,
    });
    handles.set(id, handle);
    await SchedulerTask.update({ status: 'idle', enabled: true }, { where: { id } });
  },

  async cancel(id) {
    const existing = handles.get(id);
    if (existing) { existing.stop(); handles.delete(id); }
    await SchedulerTask.destroy({ where: { id } });
  },

  async list() {
    return SchedulerTask.findAll({ order: [['name', 'ASC']] });
  },

  async ensureSetTasks(setCode) {
    const templates = [
      {
        id: `ingest:${setCode}`,
        cronExp: '0 4 * * *',
        name: 'ingestSet',
        payload: { input: setCode, refresh: false },
        description: `Daily ingest for ${setCode}`,
      },
      {
        id: `collect:${setCode}`,
        cronExp: '15 * * * *',
        name: 'collectPrices',
        payload: { set: setCode, prewarmFx: false },
        description: `Hourly price collect for ${setCode}`,
      },
      {
        id: `rollup:${setCode}`,
        cronExp: '0 */6 * * *',
        name: 'priceRollups',
        payload: { scope: 'set', set: setCode },
        description: `6-hour rollups for ${setCode}`,
      },
    ];

    for (const tpl of templates) {
      const exists = await SchedulerTask.findByPk(tpl.id);
      if (!exists) {
        await this.addCron(tpl.cronExp, tpl.name, tpl.payload, {
          id: tpl.id,
          description: tpl.description,
        });
      }
    }
  },
};

export default Scheduler;
