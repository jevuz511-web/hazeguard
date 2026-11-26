/** Entry point for `npm start` and containers: serves the bundled public files. */
import { fileURLToPath } from 'node:url';
import { startServer } from './node-server';

startServer(process.env, fileURLToPath(new URL('./public/', import.meta.url)));
