/**
 * The ClassRelay API, as an Express app with no listener attached.
 *
 * Kept separate from `index.js` so the same app can be started as a normal Node server in
 * development and wrapped as a serverless function on Vercel. The AI key lives only here:
 * the browser sends a task name and its data, and never sees a prompt or a credential.
 */

import express from 'express';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AiError, resolveProvider } from './lib/ai.js';
import { runTask, TaskError, peerSuggestions } from './lib/tasks.js';
import { addContribution, closeRoom, createRoom, deleteRoom, ensureSeeded, getRoom, listRooms, markHelpful, setUnderstanding } from './lib/peers.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, 'dist');

// Minimal .env loader: no dependency, and it never overwrites a real environment value.
// On a serverless host there is no .env file and this is a no-op.
const envPath = path.join(ROOT, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) {
      let value = m[2];
      if (/^["']/.test(value)) value = value.replace(/^(["'])(.*)\1.*$/, '$2');
      else value = value.replace(/\s+#.*$/, '');
      process.env[m[1]] = value.trim();
    }
  }
}

/**
 * Vercel sets `VERCEL=1` and provides no persistent filesystem, so the bundled static
 * client is only served when we are a real long-running server. On Vercel the CDN serves
 * the built client and only `/api/*` reaches this app.
 */
const SERVERLESS = Boolean(process.env.VERCEL);
const provider = resolveProvider();
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '8mb' }));

// A tiny per-address rate limit so an open deployment cannot burn through an AI quota.
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 600;
const recent = new Map();
app.use('/api', (req, res, next) => {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return next();
  const now = Date.now();
  const times = (recent.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  times.push(now);
  recent.set(ip, times);
  if (recent.size > 500) {
    for (const [key, list] of recent) if (!list.some((t) => now - t < WINDOW_MS)) recent.delete(key);
  }
  if (times.length > LIMIT) return res.status(429).json({ error: 'Too many requests from this device. Wait a few minutes and try again.' });
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    mode: provider ? 'live' : 'demo',
    // The configured provider by name (groq | openai | gemini). Groq speaks the OpenAI
    // protocol, so reporting the protocol instead would be misleading here.
    provider: provider ? provider.name || provider.kind : null,
    // Never expose the key itself, only whether one is configured.
    hasKey: Boolean(provider),
  });
});

app.post('/api/task', async (req, res) => {
  const { task, payload } = req.body || {};
  if (!task) return res.status(400).json({ error: 'No task was given.' });
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) controller.abort();
  });
  try {
    const result = await runTask(task, payload, { provider, signal: controller.signal });
    res.json(result);
  } catch (err) {
    respondError(res, err);
  }
});

// ---------- PeerRelay ----------

ensureSeeded();

app.get('/api/peer/rooms', (req, res) => {
  res.json({ rooms: listRooms({ subject: req.query.subject ? String(req.query.subject) : undefined }) });
});

app.post('/api/peer/rooms', (req, res) => {
  const result = createRoom(req.body || {});
  if (result.error) return res.status(400).json({ error: result.error });
  res.status(201).json(result);
});

app.get('/api/peer/rooms/:id', (req, res) => {
  const room = getRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'That peer room no longer exists.' });
  res.json({ room });
});

app.post('/api/peer/rooms/:id/contributions', (req, res) => {
  const result = addContribution(req.params.id, req.body || {});
  if (result.error) return res.status(400).json({ error: result.error });
  res.status(201).json(result);
});

app.post('/api/peer/rooms/:id/contributions/:cid/helpful', (req, res) => {
  const result = markHelpful(req.params.id, req.params.cid);
  if (result.error) return res.status(404).json({ error: result.error });
  res.json(result);
});

app.post('/api/peer/rooms/:id/understanding', (req, res) => {
  const result = setUnderstanding(req.params.id, req.body?.understanding);
  if (result.error) return res.status(404).json({ error: result.error });
  res.json(result);
});

app.post('/api/peer/rooms/:id/close', (req, res) => {
  const result = closeRoom(req.params.id);
  if (result.error) return res.status(404).json({ error: result.error });
  res.json(result);
});

app.delete('/api/peer/rooms/:id', (req, res) => {
  res.json(deleteRoom(req.params.id));
});

app.post('/api/peer/rooms/:id/suggestions', async (req, res) => {
  const room = getRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'That peer room no longer exists.' });
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) controller.abort();
  });
  try {
    const result = await peerSuggestions({ room }, { provider, signal: controller.signal });
    res.json(result);
  } catch (err) {
    respondError(res, err);
  }
});

function respondError(res, err) {
  if (err?.name === 'AbortError') return; // nobody is waiting
  if (err instanceof TaskError) return res.status(err.status).json({ error: err.message });
  if (err instanceof AiError) return res.status(err.status).json({ error: err.message });
  console.error('[classrelay]', err);
  if (!res.headersSent) res.status(500).json({ error: 'Something went wrong on the server.' });
}

// ---------- Static client (only when running as a real server) ----------

if (!SERVERLESS && existsSync(DIST)) {
  app.use(express.static(DIST, { index: false, maxAge: '1h' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(DIST, 'index.html'));
  });
} else if (!SERVERLESS) {
  app.get('/', (_req, res) => {
    res
      .status(200)
      .type('text/plain')
      .send(
        'ClassRelay API is running.\n\n' +
          'The client has not been built yet. For development run:\n' +
          '  npm run dev        (Vite on http://localhost:5173, API on http://localhost:8787)\n\n' +
          'For a production build run:\n  npm run build && npm start\n',
      );
  });
}

export { app, provider };
export default app;
