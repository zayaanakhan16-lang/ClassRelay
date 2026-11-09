/**
 * Vercel serverless entry point.
 *
 * Every request under `/api/*` is rewritten to this function (see `vercel.json`), which
 * hands the original request straight to the shared Express app. Keeping the app in
 * `server/app.js` means the same routes run locally and in the cloud.
 */

import app from '../server/app.js';

export default function handler(req, res) {
  return app(req, res);
}
