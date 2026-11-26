import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function files(root: string, pattern: RegExp): string[] {
  return readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter((path) => pattern.test(path))
    .map((path) => join(root, path).replaceAll('\\', '/'));
}

const SOURCES = [...files('src', /\.ts$/u), ...files('web', /\.ts$/u)];
const EVERYTHING = [
  ...SOURCES,
  ...files('test', /\.ts$/u),
  ...files('public', /\.(html|txt|svg|webmanifest)$/u),
  ...files('web', /\.css$/u),
];
const read = (path: string) => readFileSync(path, 'utf8');
const importsOf = (path: string) =>
  [...read(path).matchAll(/^import (type )?.*? from '([^']+)';$/gmu)].map((match) => ({
    typeOnly: match[1] !== undefined,
    from: match[2]!,
  }));

/** Which folders each layer may import at runtime (type-only imports are free). */
const LAYERS: Record<string, RegExp> = {
  'src/domain/': /^\.\/[\w-]+$/u,
  'src/services/': /^(\.\/[\w-]+|\.\.\/domain\/[\w-]+|zod)$/u,
  'src/adapters/':
    /^(\.\/[\w-]+|\.\.\/domain\/units|\.\.\/services\/(problem|ports)|zod|@google\/genai)$/u,
  'src/platform/': /^(zod)$/u,
  'src/http/': /^(\.\/[\w-]+|\.\.\/(domain|services)\/[\w-]+|zod|hono\/?[\w-]*|node:\w+)$/u,
  'web/': /^(\.\/[\w-]+|\.\.\/src\/domain\/[\w-]+)$/u,
};

describe('code conventions', () => {
  it.each(SOURCES)('%s opens with a comment saying what the module is for', (path) => {
    expect(read(path).trimStart().startsWith('/**')).toBe(true);
  });

  it.each(SOURCES)('%s documents every export', (path) => {
    const lines = read(path).split('\n');
    const undocumented = lines.flatMap((line, index) =>
      /^export (async )?(function|const|interface|type|class) /u.test(line) &&
      !(lines[index - 1] ?? '').trimEnd().endsWith('*/')
        ? [line]
        : [],
    );
    expect(undocumented).toEqual([]);
  });

  it.each(SOURCES.filter((path) => Object.keys(LAYERS).some((layer) => path.startsWith(layer))))(
    '%s only imports from layers below it',
    (path) => {
      const [, rule] = Object.entries(LAYERS).find(([layer]) => path.startsWith(layer))!;
      const offending = importsOf(path).filter(
        ({ typeOnly, from }) => !typeOnly && !rule.test(from),
      );
      expect(offending).toEqual([]);
    },
  );

  it('keeps the domain free of I/O, clocks and randomness', () => {
    for (const path of files('src/domain', /\.ts$/u)) {
      expect(read(path)).not.toMatch(/\b(fetch|Date\.now|new Date|Math\.random|process\.)/u);
    }
  });

  it.each(EVERYTHING)('%s has no invisible or direction-changing characters', (path) => {
    expect(read(path)).not.toMatch(/[\u200B\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/u);
  });

  it('never builds HTML from strings in browser code', () => {
    for (const path of files('web', /\.ts$/u))
      expect(read(path)).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/u);
  });
});
