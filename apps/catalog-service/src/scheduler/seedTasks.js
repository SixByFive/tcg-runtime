/**
 * seedTasks — standard ingest schedule for all tracked sets.
 *
 * Strategy:
 *   - Uses `ingestBatch` (2 sets per task) to refresh card data + TCGDex prices.
 *   - Tasks are staggered 30 min apart so at most one batch runs at a time.
 *   - HOT sets  (me/sv10 era): daily ingest + per-set 6-hourly rollup.
 *   - ACTIVE sets (sv/swsh era): daily ingest, global rollup covers them.
 *   - LEGACY sets (sm/xy/bw/dp era): seeded but disabled — enable when needed.
 *
 * All cron times use Europe/London timezone.
 * Idempotent — skips tasks that already exist by ID.
 */

const TZ = 'Europe/London';

// ---------------------------------------------------------------------------
// HOT — daily ingest, 6-hourly per-set rollup
// ---------------------------------------------------------------------------
const HOT_BATCHES = [
  { time: '45 23', sets: ['me05']               },
  { time: '15 0',  sets: ['me04',    'me03']    },
  { time: '45 0',  sets: ['me02.5',  'me02']    },
  { time: '15 1',  sets: ['me01',    'mep']     },
  { time: '45 1',  sets: ['sv10.5w', 'sv10.5b'] },
  { time: '15 2',  sets: ['sv10',    'sv09']    },
  { time: '45 2',  sets: ['sv08.5',  'sv08']    },
];

const HOT_SETS = HOT_BATCHES.flatMap((b) => b.sets);

// ---------------------------------------------------------------------------
// ACTIVE — daily ingest, global rollup only
// ---------------------------------------------------------------------------
const ACTIVE_BATCHES = [
  { time: '15 3',  sets: ['sv07',    'sv06.5']  },
  { time: '45 3',  sets: ['sv06',    'sv05']    },
  { time: '15 4',  sets: ['sv04.5',  'sv04']    },
  { time: '45 4',  sets: ['sv03.5',  'sv03']    },
  { time: '15 5',  sets: ['sv02',    'sv01']    },
  { time: '45 5',  sets: ['svp',     'swsh12.5']},
  { time: '15 6',  sets: ['swsh12',  'swsh11']  },
  { time: '45 6',  sets: ['swsh10.5','swsh10']  },
  { time: '15 7',  sets: ['swsh9',   'swsh8']   },
  { time: '45 7',  sets: ['cel25',   'swsh7']   },
  { time: '15 8',  sets: ['swsh6',   'swsh5']   },
  { time: '45 8',  sets: ['swsh4.5', 'swsh4']   },
  { time: '15 9',  sets: ['swsh3.5', 'swsh3']   },
  { time: '45 9',  sets: ['swsh2',   'swsh1']   },
  { time: '15 10', sets: ['swshp']              },
];

// ---------------------------------------------------------------------------
// LEGACY — SM / XY / BW / DP eras: every 3 days
// ---------------------------------------------------------------------------
const LEGACY_BATCHES = [
  { time: '15 11', sets: ['sm12',  'sm115'] },
  { time: '45 11', sets: ['sma',   'sm11']  },
  { time: '15 12', sets: ['sm10',  'sm9']   },
  { time: '45 12', sets: ['sm8',   'sm7.5'] },
  { time: '15 13', sets: ['sm7',   'sm6']   },
  { time: '45 13', sets: ['sm5',   'sm4']   },
  { time: '15 14', sets: ['sm3.5', 'sm3']   },
  { time: '45 14', sets: ['sm2',   'sm1']   },
  { time: '15 15', sets: ['smp',   'det1']  },
  { time: '45 15', sets: ['xy12',  'xy11']  },
  { time: '15 16', sets: ['xy10',  'xy9']   },
  { time: '45 16', sets: ['xy8',   'xy7']   },
  { time: '15 17', sets: ['xy6',   'dc1']   },
  { time: '45 17', sets: ['xy5',   'xy4']   },
  { time: '15 18', sets: ['xy3',   'xy2']   },
  { time: '45 18', sets: ['xy1',   'xy0']   },
  { time: '15 19', sets: ['xyp']            },
  { time: '45 19', sets: ['bw11',  'rc']    },
  { time: '15 20', sets: ['bw10',  'bw9']   },
  { time: '45 20', sets: ['bw8',   'bw7']   },
  { time: '15 21', sets: ['bw6',   'bw5']   },
  { time: '45 21', sets: ['bw4',   'bw3']   },
  { time: '15 22', sets: ['bw2',   'bw1']   },
  { time: '45 22', sets: ['bwp']            },
  { time: '15 23', sets: ['dp7',   'dp6']   },
  { time: '45 23', sets: ['dp5',   'dp4']   },
  { time: '30 0',  sets: ['dp3',   'dp2']   },
  { time: '0 1',   sets: ['dp1',   'dpp']   },
];

// ---------------------------------------------------------------------------
// Build task list
// ---------------------------------------------------------------------------
function batchTasks(batches, enabled, every = 1) {
  const dayCron = every === 1 ? '* * *' : `*/3 * *`;
  const freqLabel = every === 1 ? 'Daily' : 'Every-3d';
  return batches.map(({ time, sets }) => {
    const id = `ingest-batch:${sets.join('+')}`;
    const label = sets.join('+');
    return {
      id,
      name: 'ingestBatch',
      cronExp: `${time} ${dayCron}`,
      payload: { sets, refresh: false, pauseMs: 500 },
      timezone: TZ,
      description: `${freqLabel} ingest for ${label}`,
      enabled,
    };
  });
}

function rollupTasks(sets) {
  return sets.map((setCode) => ({
    id: `rollup:${setCode}`,
    name: 'priceRollups',
    cronExp: '0 */6 * * *',
    payload: { scope: 'set', set: setCode },
    timezone: TZ,
    description: `6-hourly rollup for ${setCode}`,
    enabled: true,
  }));
}

export const STANDARD_TASKS = [
  ...batchTasks(HOT_BATCHES,    true),
  ...batchTasks(ACTIVE_BATCHES, true),
  ...batchTasks(LEGACY_BATCHES, true, 3),
  ...rollupTasks(HOT_SETS),
];

// ---------------------------------------------------------------------------
// Seed function — idempotent, skips existing tasks
// ---------------------------------------------------------------------------
export async function seedStandardTasks(scheduler) {
  let created = 0;
  let skipped = 0;

  for (const task of STANDARD_TASKS) {
    try {
      await scheduler.addCron(task.cronExp, task.name, task.payload, {
        id:          task.id,
        timezone:    task.timezone,
        description: task.description,
        enabled:     task.enabled,
      });
      created++;
    } catch (err) {
      // Unique constraint means it already exists — skip
      if (err.name === 'SequelizeUniqueConstraintError' || err.message?.includes('already exists') || err.message?.includes('Validation error')) {
        skipped++;
      } else {
        throw err;
      }
    }
  }

  return { created, skipped, total: STANDARD_TASKS.length };
}
