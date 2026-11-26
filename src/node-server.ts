/**
 * Long-running Node server: serves the composed app with tight socket timeouts against
 * slow-loris clients and shuts down cleanly on SIGTERM.
 */
import { getRequestListener } from '@hono/node-server';
import { getConnInfo } from '@hono/node-server/conninfo';
import { type Server, createServer } from 'node:http';
import { compose } from './compose';
import { loadAssets } from './http/assets';

/** Socket timeouts that stop slow clients from holding connections open. */
export const SOCKET_TIMEOUTS = {
  headersMs: 10_000,
  requestMs: 60_000,
  keepAliveMs: 5_000,
} as const;

/** Starts listening; returns the server so callers (and tests) can close it. */
export function startServer(env: Record<string, string | undefined>, publicDir: string): Server {
  const runtime = compose(env, {
    assets: loadAssets(publicDir),
    peer: (c) => getConnInfo(c).remote.address,
  });
  // The key now lives only inside the Gemini client.
  delete env['GEMINI_API_KEY'];
  const listener = getRequestListener(runtime.app.fetch);
  const server = createServer((request, response) => {
    void listener(request, response);
  });
  server.headersTimeout = SOCKET_TIMEOUTS.headersMs;
  server.requestTimeout = SOCKET_TIMEOUTS.requestMs;
  server.keepAliveTimeout = SOCKET_TIMEOUTS.keepAliveMs;
  server.listen(runtime.config.port, () => {
    runtime.logger.info('server.started', {
      port: runtime.config.port,
      models: runtime.config.models,
    });
  });
  process.once('SIGTERM', () => server.close());
  return server;
}
