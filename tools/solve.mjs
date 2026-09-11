// Bundles tools/solver.ts for node — with the WebGL module stubbed out, since a level
// builds meshes when it loads — and runs it. `node tools/solve.mjs [level]`.
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const noGl = {
  name: 'no-gl',
  setup(b) {
    b.onResolve({ filter: /engine\/gl$/ }, () => ({ path: 'gl-stub', namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const mesh = () => ({});' }));
  },
};

const out = join(mkdtempSync(join(tmpdir(), 'solve-')), 'solver.mjs');
const r = await build({
  entryPoints: ['tools/solver.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  plugins: [noGl],
});
writeFileSync(out, r.outputFiles[0].text);
await import(pathToFileURL(out).href);
