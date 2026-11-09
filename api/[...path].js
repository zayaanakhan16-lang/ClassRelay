/**
 * Vercel serverless entry point.
 *
 * The catch-all filename makes Vercel route every `/api/*` request here. Vercel keeps the
 * original URL, but we normalise it anyway: the Express app in `server/app.js` defines its
 * routes under `/api`, so the handler guarantees that prefix is present before delegating.
 * Keeping one shared app means the same routes run locally and in the cloud.
 */

import app from '../server/app.js';

export default function handler(req, res) {
  if (!req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }
  return app(req, res);
}
