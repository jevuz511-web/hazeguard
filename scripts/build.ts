/**
 * Production build: bundles the server for Node and the browser code and CSS into
 * content-hashed, minified files, then copies public/ with the hashed names filled in.
 * Run with `npm run build` (Node's built-in TypeScript stripping).
 */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { build } from 'esbuild';

/** Output folders: the server bundle, the public files and Vercel's static placeholder. */
const OUT = { root: 'dist', public: 'dist/public', vercel: 'vercel-static' } as const;

/** Bundles the Node entry points; dependencies stay in node_modules. */
async function buildServer(): Promise<void> {
  await build({
    entryPoints: ['src/server.ts', 'src/vercel.ts'],
    outdir: OUT.root,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    packages: 'external',
    logLevel: 'warning',
  });
}

/** Bundles and minifies the browser code and CSS; returns the hashed file names. */
async function buildBrowser(): Promise<string[]> {
  const result = await build({
    entryPoints: { app: 'web/boot.ts', styles: 'web/styles/app.css' },
    outdir: OUT.public,
    entryNames: '[name]-[hash]',
    bundle: true,
    minify: true,
    format: 'esm',
    target: ['es2022', 'chrome111', 'firefox113', 'safari16.4'],
    metafile: true,
    legalComments: 'none',
    logLevel: 'warning',
  });
  return Object.keys(result.metafile.outputs).map((path) => basename(path));
}

/** The URL path of the hashed output starting with `prefix` and ending with `extension`. */
function hashedPath(outputs: readonly string[], prefix: string, extension: string): string {
  const file = outputs.find((name) => name.startsWith(`${prefix}-`) && name.endsWith(extension));
  if (file === undefined) throw new Error(`No ${prefix}*${extension} output`);
  return `/${file}`;
}

/** Copies public/ and points index.html at the hashed bundles. */
function writePublic(outputs: readonly string[]): void {
  cpSync('public', OUT.public, { recursive: true });
  const html = readFileSync('public/index.html', 'utf8')
    .replace('href="/app.css"', `href="${hashedPath(outputs, 'styles', '.css')}"`)
    .replace('src="/app.js"', `src="${hashedPath(outputs, 'app', '.js')}"`);
  writeFileSync(`${OUT.public}/index.html`, html);
}

/** Vercel needs a non-empty output folder even though every request goes to api/index.js. */
function writeVercelPlaceholder(): void {
  mkdirSync(OUT.vercel, { recursive: true });
  writeFileSync(`${OUT.vercel}/README.txt`, 'HazeGuard is served entirely by api/index.js.\n');
}

rmSync(OUT.root, { recursive: true, force: true });
mkdirSync(OUT.public, { recursive: true });
await buildServer();
const outputs = await buildBrowser();
writePublic(outputs);
writeVercelPlaceholder();
process.stdout.write(`Built ${outputs.join(', ')}\n`);
