/**
 * docker-mgmt — tiny HTTP service that proxies Docker Engine API commands
 * so the admin app can manage containers over HTTPS without SSH.
 *
 * Communicates with the Docker daemon via Unix socket (/var/run/docker.sock).
 * Protected by ADMIN_API_KEY checked on every request.
 */

import express from 'express';
import http    from 'node:http';

const PORT        = Number(process.env.PORT || 4030);
const ADMIN_KEY   = process.env.ADMIN_API_KEY || '';
const DOCKER_SOCK = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
const DOCKER_API  = '/v1.43';
// Container name of this service — excluded from restart-all
const SELF_NAME   = process.env.CONTAINER_NAME || 'DockerMgmt';

// ── Docker Engine API client ──────────────────────────────────────────────────

/**
 * Issue an HTTP request to the Docker Engine API over the Unix socket.
 * @param {string} method  HTTP method
 * @param {string} path    Path under /v1.43 (e.g. "/containers/json")
 * @param {{ body?: object, raw?: boolean }} opts
 * @returns {Promise<any>}  Parsed JSON, raw Buffer if opts.raw, or null for empty body
 */
function dockerRequest(method, path, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath: DOCKER_SOCK,
        path: `${DOCKER_API}${path}`,
        method,
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const { statusCode } = res;

          // 204 No Content / 304 Not Modified = success, no body
          if (statusCode === 204 || statusCode === 304) return resolve(null);

          if (statusCode >= 200 && statusCode < 300) {
            if (opts.raw) return resolve(buf);
            const text = buf.toString('utf8');
            if (!text.trim()) return resolve(null);
            try { resolve(JSON.parse(text)); }
            catch { resolve(text); }
          } else {
            const text = buf.toString('utf8');
            let msg = `Docker API ${statusCode}`;
            try { msg = JSON.parse(text)?.message || msg; } catch { /* ignore */ }
            reject(Object.assign(new Error(msg), { statusCode }));
          }
        });
      }
    );
    req.on('error', reject);
    if (opts.body) req.write(JSON.stringify(opts.body));
    req.end();
  });
}

/**
 * Docker log stream uses a multiplexed frame format:
 *   [STREAM(1)] [000(3)] [SIZE_BE(4)] [DATA(SIZE)]
 * Strip the headers and return the plain text.
 */
function parseDockerLogs(buf) {
  const lines = [];
  let offset  = 0;

  while (offset + 8 <= buf.length) {
    const size = buf.readUInt32BE(offset + 4);
    if (size === 0) { offset += 8; continue; }
    if (offset + 8 + size > buf.length) break;
    lines.push(buf.slice(offset + 8, offset + 8 + size).toString('utf8'));
    offset += 8 + size;
  }

  // If nothing was parsed (e.g. TTY mode or plain text), return as-is
  return lines.length ? lines.join('') : buf.toString('utf8');
}

/** Get container list and find one by name (case-insensitive). */
async function findContainer(name) {
  const all = await dockerRequest('GET', '/containers/json?all=1');
  return (all || []).find(c =>
    (c.Names || []).some(n => n.replace(/^\//, '').toLowerCase() === name.toLowerCase())
  );
}

/** Map a raw Docker container object to our ServiceStatus shape. */
function mapContainer(c) {
  const name   = (c.Names?.[0] || '').replace(/^\//, '');
  const status = c.Status || '';
  return {
    id:     c.Id.slice(0, 12),
    name,
    image:  c.Image,
    state:  c.State,   // running | exited | paused | restarting | created | dead
    status,
    health: /\(healthy\)/.test(status)           ? 'healthy'
          : /\(unhealthy\)/.test(status)          ? 'unhealthy'
          : /\(health: starting\)/.test(status)   ? 'starting'
          : null,
  };
}

// ── Middleware ────────────────────────────────────────────────────────────────

function requireAdminKey(req, res, next) {
  if (!ADMIN_KEY) return next(); // no key configured → open (dev / first boot)
  if (req.headers['x-admin-key'] !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── Routes ────────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// Health — public, no auth needed
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'docker-mgmt' });
});

// GET /services — list all containers
app.get('/services', requireAdminKey, async (_req, res) => {
  try {
    const containers = await dockerRequest('GET', '/containers/json?all=1');
    res.json((containers || []).map(mapContainer));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /services/:name/logs?tail=100
app.get('/services/:name/logs', requireAdminKey, async (req, res) => {
  const { name } = req.params;
  const tail = Math.min(Number(req.query.tail) || 100, 1000);
  try {
    const container = await findContainer(name);
    if (!container) return res.status(404).json({ error: `Container "${name}" not found` });

    const buf  = await dockerRequest(
      'GET',
      `/containers/${container.Id}/logs?stdout=1&stderr=1&tail=${tail}&timestamps=0`,
      { raw: true }
    );
    const logs = parseDockerLogs(buf);
    res.json({ name, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /services/:name/restart|start|stop
app.post('/services/:name/:action', requireAdminKey, async (req, res) => {
  const { name, action } = req.params;
  if (!['restart', 'start', 'stop'].includes(action)) {
    return res.status(400).json({ error: `Unknown action: ${action}` });
  }
  try {
    const container = await findContainer(name);
    if (!container) return res.status(404).json({ error: `Container "${name}" not found` });
    await dockerRequest('POST', `/containers/${container.Id}/${action}`);
    res.json({ ok: true, name, action });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /services/restart-all — restart every running container except ourselves
app.post('/services/restart-all', requireAdminKey, async (_req, res) => {
  try {
    const all      = await dockerRequest('GET', '/containers/json?all=1');
    const targets  = (all || []).filter(c =>
      c.State === 'running' &&
      !(c.Names || []).some(n => n.replace(/^\//, '') === SELF_NAME)
    );

    const results = await Promise.allSettled(
      targets.map(c => dockerRequest('POST', `/containers/${c.Id}/restart`))
    );

    const summary = targets.map((c, i) => ({
      name:  (c.Names?.[0] || '').replace(/^\//, ''),
      ok:    results[i].status === 'fulfilled',
      error: results[i].status === 'rejected' ? results[i].reason?.message : null,
    }));

    res.json({
      ok:         true,
      restarted:  summary.filter(s => s.ok).length,
      failed:     summary.filter(s => !s.ok).length,
      results:    summary,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[docker-mgmt] listening on :${PORT}`);
  console.log(`[docker-mgmt] Docker socket: ${DOCKER_SOCK}`);
  console.log(`[docker-mgmt] Admin key: ${ADMIN_KEY ? '*** (set)' : 'NOT SET — all requests allowed'}`);
});
