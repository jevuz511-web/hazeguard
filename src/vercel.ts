/**
 * Vercel entry: web-standard handlers for every method, so the app's own security
 * headers, gate and limits apply to every path, including static files.
 */
import { join } from 'node:path';
import { compose } from './compose';
import { loadAssets } from './http/assets';

/** Builds the request handler for a deployment rooted at `root`. */
export function vercelHandler(
  env: Record<string, string | undefined>,
  root: string,
): (request: Request) => Promise<Response> {
  const { app } = compose(env, { assets: loadAssets(join(root, 'dist', 'public')) });
  delete env['GEMINI_API_KEY'];
  return async (request) => app.fetch(request);
}
