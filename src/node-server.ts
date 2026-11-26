/**
 * Long-running Node server: serves the composed app with tight socket timeouts against
 * slow-loris clients and shuts down cleanly on SIGTERM.
 */
import { type HttpBindings, serve } from '@hono/node-server';
import type { Server } from 'node:http';
import { compose } from './compose';
import { loadAssets } from './http/assets';

/** Starts listening; returns the server so callers (and tests) can close it. */
export function startServer(env: Record<string, string | undefined>, publicDir: string): Server {
  const runtime = compose(env, {
    assets: loadAssets(publicDir),
    peer: (c) => (c.env as HttpBindings).incoming.socket.remoteAddress,
  });
  // The key now lives only inside the Gemini client.
  delete env['GEMINI_API_KEY'];
  const server = serve({ fetch: runtime.app.fetch, port: runtime.config.port }, (info) => {
    runtime.logger.info('server.started', { port: info.port, models: runtime.config.models });
  }) as Server;
  server.headersTimeout = 10_000;
  server.requestTimeout = 60_000;
  server.keepAliveTimeout = 5_000;
  process.once('SIGTERM', () => server.close());
  return server;
}
