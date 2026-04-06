/* Admin UI script for catalog-service */

const BASE = '';

function getKey() {
  return document.getElementById('admin-key').value.trim();
}

function headers() {
  return { 'Content-Type': 'application/json', 'x-admin-key': getKey() };
}

async function apiPost(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiGet(path) {
  const res = await fetch(`${BASE}${path}`, { headers: headers() });
  return res.json();
}

async function apiPatch(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiDelete(path) {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE', headers: headers() });
  return res.json();
}

function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 3500);
}

function showJobOutput(data) {
  const el = document.getElementById('job-output');
  const pre = document.getElementById('job-result');
  el.style.display = 'block';
  pre.textContent = JSON.stringify(data, null, 2);
  el.scrollIntoView({ behavior: 'smooth' });
}

// ---- Nav ----

document.querySelectorAll('nav a').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('nav a').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('main section').forEach(s => s.classList.remove('active'));
    a.classList.add('active');
    const sec = a.dataset.section;
    document.getElementById(sec).classList.add('active');
    if (sec === 'scheduler') loadScheduler();
  });
});

// ---- Jobs ----

async function runIngest() {
  const input = document.getElementById('ingest-input').value.trim();
  if (!input) return showToast('Set input is required', true);
  const refresh = document.getElementById('ingest-refresh').checked;
  const dryRun = document.getElementById('ingest-dry').checked;
  try {
    showToast('Running ingest...');
    const result = await apiPost('/admin/jobs/ingest', { input, refresh, dryRun });
    showJobOutput(result);
    showToast(result.ok ? 'Ingest complete' : 'Ingest returned error', !result.ok);
  } catch (e) { showToast(e.message, true); }
}

async function runCollect() {
  const set = document.getElementById('collect-set').value.trim();
  if (!set) return showToast('Set is required', true);
  const since = document.getElementById('collect-since').value || undefined;
  const dryRun = document.getElementById('collect-dry').checked;
  try {
    showToast('Collecting prices...');
    const result = await apiPost('/admin/jobs/collect', { set, since, dryRun });
    showJobOutput(result);
    showToast(result.ok ? 'Collect complete' : 'Error', !result.ok);
  } catch (e) { showToast(e.message, true); }
}

async function runFxDaily() {
  const days = document.getElementById('fx-days').value;
  try {
    showToast('Running FX daily...');
    const result = await apiPost('/admin/jobs/fx-daily', { backfillDays: days ? Number(days) : undefined });
    showJobOutput(result);
    showToast(result.ok ? 'FX cache updated' : 'Error', !result.ok);
  } catch (e) { showToast(e.message, true); }
}

async function runRollups() {
  const scope = document.getElementById('rollup-scope').value;
  const target = document.getElementById('rollup-target').value.trim();
  const body = { scope };
  if (scope === 'set' && target) body.set = target;
  if (scope === 'card' && target) body.cardId = target;
  try {
    showToast('Rebuilding rollups...');
    const result = await apiPost('/admin/jobs/rollups', body);
    showJobOutput(result);
    showToast(result.ok ? 'Rollups rebuilt' : 'Error', !result.ok);
  } catch (e) { showToast(e.message, true); }
}

async function runEnsureTasks() {
  const setCode = document.getElementById('ensure-set').value.trim();
  if (!setCode) return showToast('Set code is required', true);
  try {
    const result = await apiPost(`/admin/sets/${encodeURIComponent(setCode)}/ensure-tasks`, {});
    showJobOutput(result);
    showToast(result.ok ? 'Tasks ensured' : 'Error', !result.ok);
  } catch (e) { showToast(e.message, true); }
}

// ---- Scheduler ----

async function loadScheduler() {
  const wrap = document.getElementById('scheduler-table-wrap');
  wrap.innerHTML = '<p style="color:#718096;font-size:0.875rem;">Loading...</p>';
  try {
    const tasks = await apiGet('/admin/scheduler');
    if (!Array.isArray(tasks) || tasks.length === 0) {
      wrap.innerHTML = '<p style="color:#718096;font-size:0.875rem;">No scheduled tasks.</p>';
      return;
    }
    const rows = tasks.map(t => `
      <tr>
        <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;" title="${t.id}">${t.id}</td>
        <td>${t.name}</td>
        <td><code>${t.cron_exp}</code></td>
        <td><code style="font-size:0.75rem;">${JSON.stringify(t.payload || {})}</code></td>
        <td><span class="status-badge status-${t.status}">${t.status}</span></td>
        <td>${t.tries || 0}</td>
        <td>${t.last_run_at ? new Date(t.last_run_at).toLocaleString() : '-'}</td>
        <td>
          <div class="actions">
            <button onclick="runTask('${t.id}')" style="font-size:0.75rem;padding:0.25rem 0.6rem;">Run</button>
            ${t.status === 'paused' || !t.enabled
              ? `<button class="success" onclick="resumeTask('${t.id}')" style="font-size:0.75rem;padding:0.25rem 0.6rem;">Resume</button>`
              : `<button class="secondary" onclick="pauseTask('${t.id}')" style="font-size:0.75rem;padding:0.25rem 0.6rem;">Pause</button>`}
            <button class="danger" onclick="deleteTask('${t.id}')" style="font-size:0.75rem;padding:0.25rem 0.6rem;">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
    wrap.innerHTML = `
      <table>
        <thead><tr>
          <th>ID</th><th>Job</th><th>Cron</th><th>Payload</th><th>Status</th><th>Runs</th><th>Last Run</th><th>Actions</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  } catch (e) {
    wrap.innerHTML = `<p style="color:#fc8181;">${e.message}</p>`;
  }
}

async function runTask(id) {
  try {
    showToast('Starting task...');
    await apiPost(`/admin/scheduler/${id}/run`, {});
    showToast('Task complete');
    loadScheduler();
  } catch (e) { showToast(e.message, true); }
}

async function pauseTask(id) {
  try {
    await apiPost(`/admin/scheduler/${id}/pause`, {});
    showToast('Task paused');
    loadScheduler();
  } catch (e) { showToast(e.message, true); }
}

async function resumeTask(id) {
  try {
    await apiPost(`/admin/scheduler/${id}/resume`, {});
    showToast('Task resumed');
    loadScheduler();
  } catch (e) { showToast(e.message, true); }
}

async function deleteTask(id) {
  if (!confirm(`Delete task ${id}?`)) return;
  try {
    await apiDelete(`/admin/scheduler/${id}`);
    showToast('Task deleted');
    loadScheduler();
  } catch (e) { showToast(e.message, true); }
}

// ---- Add Task ----

async function addCronTask() {
  const cronExp = document.getElementById('new-cron-exp').value.trim();
  const name = document.getElementById('new-job-name').value;
  const payloadStr = document.getElementById('new-payload').value.trim();
  const description = document.getElementById('new-desc').value.trim();
  const timezone = document.getElementById('new-tz').value.trim();

  if (!cronExp) return showToast('Cron expression is required', true);

  let payload = {};
  if (payloadStr) {
    try { payload = JSON.parse(payloadStr); } catch { return showToast('Invalid JSON payload', true); }
  }

  try {
    const result = await apiPost('/admin/scheduler', { cronExp, name, payload, description: description || null, timezone: timezone || null });
    const pre = document.getElementById('add-task-result');
    pre.style.display = 'block';
    pre.textContent = JSON.stringify(result, null, 2);
    showToast('Task added');
    loadScheduler();
  } catch (e) { showToast(e.message, true); }
}
