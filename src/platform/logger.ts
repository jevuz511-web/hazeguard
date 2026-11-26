/**
 * JSON-lines logger for stdout. Callers pass event names and small facts, never user
 * text; any configured secret that slips into a line is masked before it is written.
 */
import type { Logger } from '../services/ports';

type Level = 'info' | 'warn' | 'error';

/** Creates a logger that writes one JSON object per line and masks `secrets`. */
export function createLogger(
  write: (line: string) => void,
  secrets: readonly string[] = [],
): Logger {
  const masked = secrets.filter((secret) => secret.length > 0);
  const emit =
    (level: Level) =>
    (event: string, data: Readonly<Record<string, unknown>> = {}) => {
      let line = JSON.stringify({ time: new Date().toISOString(), level, event, ...data });
      for (const secret of masked) line = line.replaceAll(secret, '[redacted]');
      write(`${line}\n`);
    };
  return { info: emit('info'), warn: emit('warn'), error: emit('error') };
}
