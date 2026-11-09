/**
 * Vercel serverless entry point.
 *
 * Vercel's plain-function router does not treat `[...path].js` as a catch-all, so only
 * one-segment paths such as `/api/health` reached Express while `/api/peer/rooms` was
 * answered by the platform with its own 404. A single function plus an explicit rewrite
 * (see `vercel.json`) routes every `/api/*` request here instead.
 *
 * The rewrite carries the real path in `__p`, so the original request line is rebuilt
 * before delegating: the Express app in `server/app.js` defines its routes under `/api`,
 * and keeping one shared app means the same routes run locally and in the cloud.
 */

import app from '../server/app.js';

export default function handler(req, res) {
  const url = new URL(req.url || '/', 'http://internal');
  const captured = url.searchParams.get('__p');
  if (captured !== null) {
    // The rewrite carried the real path in `__p`; rebuild the request line from it and keep
    // whichever query parameters survived.
    url.searchParams.delete('__p');
    const query = url.searchParams.toString();
    const path = captured.replace(/^\/+|\/+$/g, '');
    req.url = `/api${path ? `/${path}` : ''}${query ? `?${query}` : ''}`;
  } else if (!req.url.startsWith('/api')) {
    // Older deployments preserved the original URL without the prefix; restore it.
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }
  return app(req, res);
}
