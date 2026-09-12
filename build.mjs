// js13k build pipeline:
//   esbuild (bundle + strip TS) -> terser -> [roadroller] -> inline HTML -> zip -> [ECT]
//
// Release builds produce TWO candidates, packed and unpacked, and keep the smaller zip.
// On a small payload the roadroller decoder (~700 B) does not pay for itself against
// plain deflate, so the winner is decided by measurement rather than by assumption.
//
//   node build.mjs               release build + size report
//   node build.mjs --dev         readable build, no roadroller (fast)
//   node build.mjs --dev --serve dev server, rebuilds and reloads on save

import { context, build as esbuild } from 'esbuild';
import { minify } from 'terser';
import { Packer } from 'roadroller';
import { zipSync } from 'fflate';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');
const LIMIT = 13312; // 13 * 1024 bytes, the competition's hard limit

const dev = process.argv.includes('--dev');
const serve = process.argv.includes('--serve');

const TEMPLATE = () => readFileSync(join(ROOT, 'src', 'index.html'), 'utf8');

// --- steps ----------------------------------------------------------------

/** Bundle TS into a single IIFE with no exports: roadroller needs a standalone script. */
const esbuildOptions = {
  entryPoints: [join(ROOT, 'src', 'main.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  // DEBUG is true in dev builds only; terser drops what hangs off it in a release.
  define: { DEBUG: dev ? 'true' : 'false' },
  charset: 'utf8',
  write: false,
  legalComments: 'none',
  minify: dev ? false : true,
};

async function bundle() {
  const out = await esbuild(esbuildOptions);
  return out.outputFiles[0].text;
}

/** Terser with multiple passes: still shaves 5-15% off esbuild's output. */
async function squeeze(js) {
  const res = await minify(js, {
    ecma: 2020,
    module: false,
    toplevel: true,
    compress: {
      passes: 3,
      unsafe: true,
      unsafe_arrows: true,
      unsafe_math: true,
      unsafe_methods: true,
      booleans_as_integers: true,
      drop_console: true,
      pure_getters: true,
      // unsafe_comps, unsafe_proto, unsafe_undefined, keep_fargs: false and hoist_funs were
      // measured on 12/09: +33 B zipped together. Not worth their risk.
    },
    // Property mangling on an explicit list of the game's own object keys only — never the
    // DOM's, WebGL's or Array's — so nothing can be renamed out from under a browser API.
    mangle: {
      toplevel: true,
      properties: {
        regex: /^(yaw|mark|markT|route|routes|target|waiting|path|curious|seen|asleep|limit|brief|mesh|model|rgb|geo|color|age|hue|life|taken|pitch|dist|speed|leg|vao|count|par|session|frame|space|onEnd|fy|up|hunters|parts|k)$/,
      },
    },
    format: { comments: false },
  });
  return shrinkGlsl(res.code ?? js);
}

/**
 * The shaders travel as string literals that terser leaves alone: indentation, spaces round
 * operators and after commas are dead weight there. Collapsed here, on the minified output,
 * so the sources stay readable. Only spaces next to punctuation go; tokens stay apart.
 */
function shrinkGlsl(js) {
  return js.replace(/"#version 300 es(?:[^"\\]|\\.)*"/g, (glsl) =>
    glsl
      .replace(/\\n +/g, '\\n')
      // Every statement ends in ; or a brace: only the #version line needs its newline.
      .replace(/#version 300 es\\n/g, '\u00a7')
      .replace(/\\n/g, '')
      .replace(/\u00a7/g, '#version 300 es\\n')
      .replace(/ ([=+\-*\/,<>?:]) /g, '$1')
      .replace(/([,;{}()]) /g, '$1')
      .replace(/ ([{}()])/g, '$1'),
  );
}

/**
 * A `</script` anywhere in the payload closes the tag early and breaks the page. Checked
 * on the JavaScript, never on the HTML — the template legitimately ends with one.
 * This catches both a packer artifact and a literal `</script` in game text.
 */
const htmlUnsafe = (js) => /<\/script/i.test(js);

/** Roadroller's context-mixing packer. Slow (seconds), so release builds only. */
async function roadroll(js) {
  const packer = new Packer([{ data: js, type: 'js', action: 'eval' }], { maxMemoryMB: 150 });
  await packer.optimize(2); // slower, a few dozen bytes better
  const { firstLine, secondLine } = packer.makeDecoder();
  const packed = firstLine + secondLine;
  if (htmlUnsafe(packed)) throw new Error('roadroller output is not HTML-safe');
  return packed;
}

const inline = (js) => TEMPLATE().replace('__JS__', () => js);

/** Fixed mtime, so two identical builds produce byte-identical zips. */
function zip(html) {
  return zipSync(
    { 'index.html': [new TextEncoder().encode(html), { level: 9, mem: 12 }] },
    { mtime: new Date('2026-08-13T13:00:00Z') },
  );
}

/**
 * Recompress the zip without touching its contents. ECT level 10009 is the one
 * recommended for js13k: very slow, smallest output. A missing tool is skipped.
 *
 * advzip was measured on 2026-08-11 and gained nothing on top of ECT (1944 B either
 * way), so it was dropped. Worth re-measuring on a real payload near the deadline.
 */
function recompress(file) {
  const passes = [['ect', ['-10009', '-zip', file]]];
  const applied = [];
  for (const [tool, args] of passes) {
    for (const bin of binaries(tool)) {
      try {
        execFileSync(bin, args, { stdio: 'ignore' });
        applied.push(tool);
        break;
      } catch {
        /* try the next candidate; if none works, the previous zip stays valid */
      }
    }
  }
  return applied;
}

/**
 * Candidates for a recompressor: the npm package first, then a system binary.
 * `ect-bin` drags in vulnerable install-time dependencies; installing ECT natively
 * (`choco install ect`) lets you drop the package without touching this build.
 */
function binaries(tool) {
  const out = [];
  try {
    const pkg = require(`${tool}-bin`);
    out.push(pkg.default ?? pkg);
  } catch {
    /* npm package missing: fall through to PATH */
  }
  out.push(tool);
  return out;
}

// --- reporting ------------------------------------------------------------

const pct = (n) => ((n / LIMIT) * 100).toFixed(1);

function report(zipped, detail) {
  const left = LIMIT - zipped;
  const bar = '#'.repeat(Math.min(40, Math.round((zipped / LIMIT) * 40))).padEnd(40, '.');
  console.log('');
  for (const [k, v] of detail) console.log(`  ${k.padEnd(22)} ${String(v).padStart(7)} B`);
  console.log('');
  console.log(`  [${bar}] ${pct(zipped)} %`);
  console.log(`  zip ${zipped} / ${LIMIT} B  —  ${left >= 0 ? `${left} B left` : `OVER by ${-left} B`}`);
  console.log('');
  if (left < 0) process.exitCode = 1;
}

// --- modes ----------------------------------------------------------------

async function release() {
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });

  const raw = await bundle();
  const js = await squeeze(raw);

  const candidates = [{ name: 'plain', js }];
  try {
    candidates.push({ name: 'roadroller', js: await roadroll(js) });
  } catch (e) {
    console.warn(`  ! skipping roadroller: ${e.message}`);
  }

  let best = null;
  for (const c of candidates) {
    // Hard failure, not a warning: shipping this would produce a blank page.
    if (htmlUnsafe(c.js)) throw new Error(`'${c.name}' payload contains </script`);
    const html = inline(c.js);
    const file = join(DIST, `${c.name}.zip`);
    writeFileSync(file, zip(html));
    const before = readFileSync(file).length;
    const tools = recompress(file);
    const size = readFileSync(file).length;
    console.log(
      `  ${c.name.padEnd(12)} js ${String(c.js.length).padStart(6)} B -> zip ${before} B -> ${size} B`,
    );
    if (!best || size < best.size) best = { ...c, html, size, file, tools };
  }
  // Reported per candidate: a tool can succeed on one payload and fail on the other.
  console.log(
    `  recompression: ${best.tools.length ? best.tools.join(' + ') : 'NONE (tools missing)'}`,
  );

  writeFileSync(join(DIST, 'index.html'), best.html);
  writeFileSync(join(ROOT, 'game.zip'), readFileSync(best.file));
  for (const c of candidates) rmSync(join(DIST, `${c.name}.zip`), { force: true });

  report(best.size, [
    ['js after esbuild', raw.length],
    ['js after terser', js.length],
    ['inlined html', best.html.length],
    ['final zip', best.size],
  ]);
  console.log(`  -> game.zip (${best.name} strategy)   dist/index.html plays as-is\n`);
}

/** Live reload: esbuild publishes rebuild events as SSE on /esbuild. */
const LIVERELOAD = `<script>new EventSource('/esbuild').addEventListener('change',()=>location.reload())</script>`;

async function watch() {
  mkdirSync(DIST, { recursive: true });
  const ctx = await context({
    ...esbuildOptions,
    // esbuild refuses to serve an entry point without an output path, even though
    // write is false and our plugin is the one writing the final HTML.
    outdir: DIST,
    write: false,
    plugins: [
      {
        name: 'inline-html',
        setup(b) {
          b.onEnd(async (result) => {
            if (result.errors.length) return;
            const js = result.outputFiles[0].text;
            writeFileSync(join(DIST, 'index.html'), inline(js) + LIVERELOAD);
            // Estimate the release size on every save, so the budget stays visible
            // instead of being discovered the night before the deadline.
            const size = zip(inline(await squeeze(js))).length;
            console.log(`  build ok — ${js.length} B of js, ~${size} B zipped (${pct(size)} %)`);
          });
        },
      },
    ],
  });
  await ctx.watch();
  const { hosts, port } = await ctx.serve({ servedir: DIST, host: '127.0.0.1' });
  console.log(`\n  dev -> http://${hosts[0] ?? '127.0.0.1'}:${port}\n`);
}

await (serve ? watch() : release());
