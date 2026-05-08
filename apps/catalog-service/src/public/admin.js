/* Catalog admin UI — works both direct (/admin/ui/) and via gateway proxy (/catalog-admin/ui/) */

const BASE = window.location.pathname.includes('/catalog-admin') ? '/catalog-admin' : '/admin';

// ── Key management ────────────────────────────────────────────────────────────

function getKey() {
  return sessionStorage.getItem('catalogAdminKey') || '';
}

function setKey(val) {
  if (val) sessionStorage.setItem('catalogAdminKey', val);
  else sessionStorage.removeItem('catalogAdminKey');
  updateKeyIndicator();
}

function updateKeyIndicator() {
  const ind = document.getElementById('keyStatus');
  const has = !!getKey();
  ind.textContent = has ? 'Set' : 'Not set';
  ind.className = 'key-ind ' + (has ? 'ok' : 'err');
}

document.getElementById('saveKey').addEventListener('click', () => {
  const v = document.getElementById('adminKey').value.trim();
  setKey(v);
  document.getElementById('adminKey').value = '';
  toast('Key saved', 'ok');
});

document.getElementById('clearKey').addEventListener('click', () => {
  setKey('');
  toast('Key cleared', 'warn');
});

updateKeyIndicator();

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function headers(extra = {}) {
  return { 'Content-Type': 'application/json', 'x-admin-key': getKey(), ...extra };
}

async function api(method, path, body) {
  const opts = { method, headers: headers() };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

const GET    = p        => api('GET',    p);
const POST   = (p, b)   => api('POST',   p, b);
const PATCH  = (p, b)   => api('PATCH',  p, b);
const DELETE = p        => api('DELETE', p);

// ── Toast ─────────────────────────────────────────────────────────────────────

function toast(msg, kind = 'ok') {
  const wrap = document.getElementById('toast');
  const el = document.createElement('div');
  el.className = `t ${kind}`;
  el.textContent = msg;
  wrap.appendChild(el);

  const kpi = document.getElementById('kpiLast');
  kpi.textContent = msg;

  setTimeout(() => el.remove(), 4000);
}

// ── Output boxes ──────────────────────────────────────────────────────────────

function showOutput(id, data) {
  const el = document.getElementById(id);
  el.style.display = 'block';
  el.textContent = JSON.stringify(data, null, 2);
}

// ── KPIs ──────────────────────────────────────────────────────────────────────

async function loadKpis() {
  try {
    const tasks = await GET('/scheduler');
    document.getElementById('kpiTasks').textContent = Array.isArray(tasks) ? tasks.length : '-';
  } catch { document.getElementById('kpiTasks').textContent = 'err'; }

  try {
    const sets = await GET('/sets?pageSize=1');
    document.getElementById('kpiSets').textContent = sets?.total ?? '-';
  } catch { document.getElementById('kpiSets').textContent = 'err'; }
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

function statusChip(task) {
  if (!task.enabled) return '<span class="chip">Disabled</span>';
  const s = task.status || 'idle';
  const cls = s === 'running' ? 'busy' : s === 'error' ? 'err' : 'ok';
  return `<span class="chip ${cls}">${s}</span>`;
}

async function loadTasks() {
  const wrap = document.getElementById('tasksList');
  wrap.innerHTML = '<div class="empty">Loading…</div>';
  try {
    const tasks = await GET('/scheduler');
    document.getElementById('kpiTasks').textContent = Array.isArray(tasks) ? tasks.length : '-';
    if (!Array.isArray(tasks) || !tasks.length) {
      wrap.innerHTML = '<div class="empty">No scheduled tasks found.</div>';
      return;
    }
    wrap.innerHTML = tasks.map(t => `
      <div class="task-card">
        <div class="task-card__header">
          <div class="task-card__title">
            <strong>${t.name || t.id}</strong>
            <span class="muted small monospace">${t.cron_exp || ''}</span>
          </div>
          ${statusChip(t)}
        </div>
        <ul class="task-card__facts">
          <li><span class="lbl">Payload</span><span class="monospace">${JSON.stringify(t.payload || {})}</span></li>
          <li><span class="lbl">Last run</span><span>${t.last_run_at ? new Date(t.last_run_at).toLocaleString() : 'Never'}</span></li>
          <li><span class="lbl">Runs</span><span>${t.tries || 0}</span></li>
          ${t.description ? `<li><span class="lbl">Note</span><span>${t.description}</span></li>` : ''}
        </ul>
        <div class="task-card__actions">
          <button class="btn-accent btn-sm" onclick="runTask('${t.id}')">Run now</button>
          ${t.enabled
            ? `<button class="btn-outline btn-sm" onclick="pauseTask('${t.id}')">Pause</button>`
            : `<button class="btn-ok btn-sm" onclick="resumeTask('${t.id}')">Resume</button>`}
          <button class="btn-err btn-sm" onclick="deleteTask('${t.id}')">Delete</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    wrap.innerHTML = `<div class="empty" style="color:var(--err)">${e.message}</div>`;
  }
}

async function runTask(id) {
  toast('Running task…', 'ok');
  try {
    const r = await POST(`/scheduler/${id}/run`, {});
    toast(r?.ok ? 'Task complete' : (r?.error || 'Task returned error'), r?.ok ? 'ok' : 'err');
    loadTasks();
  } catch (e) { toast(e.message, 'err'); }
}

async function pauseTask(id) {
  try { await POST(`/scheduler/${id}/pause`, {}); toast('Task paused', 'warn'); loadTasks(); }
  catch (e) { toast(e.message, 'err'); }
}

async function resumeTask(id) {
  try { await POST(`/scheduler/${id}/resume`, {}); toast('Task resumed', 'ok'); loadTasks(); }
  catch (e) { toast(e.message, 'err'); }
}

async function deleteTask(id) {
  if (!confirm(`Delete task ${id}?`)) return;
  try { await DELETE(`/scheduler/${id}`); toast('Task deleted', 'warn'); loadTasks(); }
  catch (e) { toast(e.message, 'err'); }
}

document.getElementById('refreshTasks').addEventListener('click', loadTasks);

document.getElementById('addTask').addEventListener('click', async () => {
  const cronExp = document.getElementById('newCron').value.trim();
  const name    = document.getElementById('newJobName').value;
  const payloadStr = document.getElementById('newPayload').value.trim();
  const description = document.getElementById('newDesc').value.trim() || null;
  const timezone    = document.getElementById('newTz').value.trim()   || null;

  if (!cronExp) return toast('Cron expression is required', 'err');
  let payload = {};
  if (payloadStr) { try { payload = JSON.parse(payloadStr); } catch { return toast('Invalid JSON payload', 'err'); } }

  try {
    const r = await POST('/scheduler', { cronExp, name, payload, description, timezone });
    showOutput('addTaskOutput', r);
    toast('Task added', 'ok');
    loadTasks();
  } catch (e) { toast(e.message, 'err'); }
});

// ── Jobs ──────────────────────────────────────────────────────────────────────

function jobBtn(id, label) {
  const btn = document.getElementById(id);
  btn.disabled = true;
  btn.textContent = 'Running…';
  return () => { btn.disabled = false; btn.textContent = label; };
}

document.getElementById('btnIngest').addEventListener('click', async () => {
  const input = document.getElementById('ingestInput').value.trim();
  if (!input) return toast('Set identifier is required', 'err');
  const done = jobBtn('btnIngest', 'Run ingest');
  toast('Ingesting…');
  try {
    const r = await POST('/jobs/ingest', {
      input,
      refresh: document.getElementById('ingestRefresh').value === 'true',
      dryRun:  document.getElementById('ingestDry').value === 'true',
    });
    showOutput('ingestOutput', r);
    toast(r?.ok ? `Ingest done — ${r?.counts?.cards?.inserted ?? 0} inserted` : (r?.error || 'Error'), r?.ok ? 'ok' : 'err');
    loadKpis();
  } catch (e) { toast(e.message, 'err'); } finally { done(); }
});

document.getElementById('btnCollect').addEventListener('click', async () => {
  const set = document.getElementById('collectSet').value.trim();
  if (!set) return toast('Set identifier is required', 'err');
  const done = jobBtn('btnCollect', 'Run collect');
  toast('Collecting prices…');
  try {
    const body = { set, dryRun: document.getElementById('collectDry').value === 'true' };
    const since = document.getElementById('collectSince').value;
    if (since) body.since = since;
    const r = await POST('/jobs/collect', body);
    showOutput('collectOutput', r);
    toast(r?.ok ? `Collect done — ${r?.counts?.observations?.written ?? 0} written` : (r?.error || 'Error'), r?.ok ? 'ok' : 'err');
  } catch (e) { toast(e.message, 'err'); } finally { done(); }
});

document.getElementById('btnFx').addEventListener('click', async () => {
  const done = jobBtn('btnFx', 'Run FX daily');
  toast('Updating FX cache…');
  try {
    const days = document.getElementById('fxDays').value;
    const r = await POST('/jobs/fx-daily', { backfillDays: days ? Number(days) : undefined });
    showOutput('fxOutput', r);
    toast(r?.ok ? 'FX cache updated' : (r?.error || 'Error'), r?.ok ? 'ok' : 'err');
  } catch (e) { toast(e.message, 'err'); } finally { done(); }
});

document.getElementById('btnRollups').addEventListener('click', async () => {
  const done = jobBtn('btnRollups', 'Rebuild');
  toast('Rebuilding rollups…');
  try {
    const scope   = document.getElementById('rollupScope').value || undefined;
    const target  = document.getElementById('rollupTarget').value.trim() || undefined;
    const variant = document.getElementById('rollupVariant').value.trim() || undefined;
    const body = { scope: scope || 'all' };
    if (scope === 'set'  && target) body.set    = target;
    if (scope === 'card' && target) body.cardId = target;
    if (variant) body.variant = variant;
    const r = await POST('/jobs/rollups', body);
    showOutput('rollupsOutput', r);
    toast(r?.ok ? 'Rollups rebuilt' : (r?.error || 'Error'), r?.ok ? 'ok' : 'err');
  } catch (e) { toast(e.message, 'err'); } finally { done(); }
});

// ── FX rates ──────────────────────────────────────────────────────────────────

document.getElementById('fxFetch').addEventListener('click', async () => {
  const date = document.getElementById('fxDate').value || undefined;
  try {
    const r = await GET('/fx/rates' + (date ? `?date=${date}` : ''));
    const tbody = document.getElementById('fxRatesTbody');
    if (!r?.rates) { tbody.innerHTML = '<tr><td colspan="2" class="muted">No rates returned.</td></tr>'; return; }
    document.getElementById('fxMeta').textContent = `EUR base · ${r.date || 'unknown date'}`;
    tbody.innerHTML = Object.entries(r.rates)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ccy, rate]) => `<tr><td class="monospace">${ccy}</td><td>${Number(rate).toFixed(4)}</td></tr>`)
      .join('');
  } catch (e) { toast(e.message, 'err'); }
});

// ── Sets ──────────────────────────────────────────────────────────────────────

async function searchSets() {
  const q = document.getElementById('setsQuery').value.trim();
  const wrap = document.getElementById('setsList');
  wrap.innerHTML = '<div class="empty">Loading…</div>';
  try {
    const r = await GET(`/sets?pageSize=50${q ? '&q=' + encodeURIComponent(q) : ''}`);
    document.getElementById('setsFoot').textContent = r?.total ? `Showing ${r.sets?.length} of ${r.total}` : '';
    if (!r?.sets?.length) { wrap.innerHTML = '<div class="empty">No sets found.</div>'; return; }
    wrap.innerHTML = r.sets.map(s => `
      <div class="set-card">
        <div class="set-card__header">
          <div>
            <strong>${s.name || s.code}</strong>
            <span class="muted small"> · ${s.code}${s.abbreviation ? ' / ' + s.abbreviation : ''}</span>
          </div>
        </div>
        <div class="set-card__body">
          <div><span class="lbl">Era</span>${s.era || '—'}</div>
          <div><span class="lbl">Released</span>${s.release_date || '—'}</div>
          <div><span class="lbl">Cards</span>${s.total_cards ?? s.official_count ?? '—'}</div>
        </div>
        <div class="set-card__actions">
          <button class="btn-outline btn-sm" onclick="ensureTasks('${s.code}')">Ensure tasks</button>
          <button class="btn-accent btn-sm" onclick="ingestFromSet('${s.code}')">Re-ingest</button>
        </div>
      </div>
    `).join('');
  } catch (e) { wrap.innerHTML = `<div class="empty" style="color:var(--err)">${e.message}</div>`; }
}

async function ensureTasks(code) {
  try {
    const r = await POST(`/sets/${code}/ensure-tasks`, {});
    toast(r?.ok ? `Tasks ensured for ${code}` : (r?.error || 'Error'), r?.ok ? 'ok' : 'err');
  } catch (e) { toast(e.message, 'err'); }
}

function ingestFromSet(code) {
  document.getElementById('ingestInput').value = code;
  document.getElementById('btnIngest').scrollIntoView({ behavior: 'smooth', block: 'center' });
  toast(`Set ${code} loaded into ingest form`, 'ok');
}

document.getElementById('searchSets').addEventListener('click', searchSets);
document.getElementById('setsQuery').addEventListener('keydown', e => { if (e.key === 'Enter') searchSets(); });

// ── Refresh all ───────────────────────────────────────────────────────────────

document.getElementById('refreshAll').addEventListener('click', () => {
  loadTasks();
  loadKpis();
  toast('Refreshed', 'ok');
});

// ── Init ──────────────────────────────────────────────────────────────────────

loadTasks();
loadKpis();
