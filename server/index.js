/**
 * ClassRelay local server entry point.
 *
 * Starts the shared Express app (see `app.js`) and listens. In production this process
 * serves both the built client from `dist/` and the JSON API; in development the Vite dev
 * server serves the client and proxies `/api` here.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, provider } from './app.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, 'dist');

const PORT = Number(process.env.API_PORT || process.env.PORT || 8787);
const HOST = String(process.env.API_HOST || '127.0.0.1').trim() || '127.0.0.1';

app.listen(PORT, HOST, () => {
  console.log(`\n  ClassRelay API listening on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  if (provider) {
    console.log(`  Mode: live AI (${provider.name || provider.kind})`);
  } else {
    console.log('  Mode: DEMO — no AI key found, using the built-in simulation.');
    console.log('  Add GROQ_API_KEY, OPENAI_API_KEY or GEMINI_API_KEY to .env to enable live AI.\n');
  }
  if (!existsSync(DIST)) console.log('  Client: run `npm run dev` for the Vite dev server on port 5173.\n');
});
