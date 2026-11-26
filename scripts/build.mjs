// Production build: bundles the server for Node and the browser code and CSS into
// content-hashed, minified files, then copies public/ with the hashed names filled in.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { build } from 'esbuild';

const OUT = 'dist';
const PUBLIC_OUT = `${OUT}/public`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(PUBLIC_OUT, { recursive: true });

await build({
  entryPoints: ['src/server.ts', 'src/vercel.ts'],
  outdir: OUT,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  sourcemap: false,
  logLevel: 'warning',
});

const browser = await build({
  entryPoints: { app: 'web/boot.ts', styles: 'web/styles/app.css' },
  outdir: PUBLIC_OUT,
  entryNames: '[name]-[hash]',
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['es2022', 'chrome111', 'firefox113', 'safari16.4'],
  metafile: true,
  legalComments: 'none',
  logLevel: 'warning',
});

const outputs = Object.keys(browser.metafile.outputs).map((path) => basename(path));
const named = (prefix, extension) => {
  const file = outputs.find((name) => name.startsWith(`${prefix}-`) && name.endsWith(extension));
  if (file === undefined) throw new Error(`No ${prefix}*${extension} output`);
  return `/${file}`;
};

cpSync('public', PUBLIC_OUT, { recursive: true });
const html = readFileSync('public/index.html', 'utf8')
  .replace('href="/app.css"', `href="${named('styles', '.css')}"`)
  .replace('src="/app.js"', `src="${named('app', '.js')}"`);
writeFileSync(`${PUBLIC_OUT}/index.html`, html);
process.stdout.write(`Built ${outputs.join(', ')}\n`);
