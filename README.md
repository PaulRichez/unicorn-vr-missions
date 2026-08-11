# js13kGames 2026

An entry for [js13kGames](https://js13kgames.com) 2026. The theme is announced on
August 13th; for now this repository holds the build pipeline and the engine skeleton.

- **Title** — to be decided
- **Categories** — Desktop + Mobile
- **Budget** — 13,312 bytes, zipped

## Development

```sh
npm install
npm run dev     # http://127.0.0.1:8000, rebuilds and reloads on save
npm run build   # release zip + size report
npm run check   # TypeScript typecheck
```

`npm run dev` prints an estimated zipped release size on every save, so the budget stays
visible instead of being discovered at the deadline.

## Build pipeline

`build.mjs` chains:

1. **esbuild** — bundles the TypeScript sources into a single IIFE. Types are simply
   stripped, so they cost nothing in the zip.
2. **terser** — multiple passes, `unsafe` options, toplevel mangling.
3. **roadroller** — context-mixing compression of the JavaScript.
4. **inline** — the JS is injected into `src/index.html` in place of `__JS__`.
5. **zip** — deflate level 9, fixed mtime for reproducible builds.
6. **ECT** — zip recompression at level `10009`, the level recommended for js13k. The
   binary comes from the `ect-bin` package, falling back to an `ect` on `PATH`.

Steps 3 to 6 produce **two candidates**, with and without roadroller, and the smaller zip
wins. On a modest payload the roadroller decoder (~700 B) does not pay for itself; it
starts winning somewhere around 4-5 KB of JavaScript. The build prints both sizes, which
keeps the trade-off visible on every release.

Output: `game.zip` at the root (the deliverable) and `dist/index.html` (plays as-is).

### Measurements

Taken on the boilerplate, 2026-08-11. Worth redoing on the real payload — the ratios move
with the size of the input.

| Zip recompression | Size |
|---|---|
| fflate, level 9 | 1985 B |
| + advzip `-z -4` | 1985 B (no gain) |
| + ECT `-10009` | **1944 B** (−41 B, −2.1%) |

advzip was dropped on that basis. Note that ZzFX costs ~698 B zipped against ~256 B for
the hand-rolled synth it replaced: 442 B bought a battle-tested synth with an online
editor instead of audio code to debug.

## Structure

```
src/
  index.html      minimal HTML shell, __JS__ is the injection point
  main.ts         engine <-> game wiring
  game.ts         THE game — the only file that knows the rendering technology
  engine/
    view.ts       canvas, resizing, capped devicePixelRatio
    input.ts      unified keyboard + pointer (mouse, touch, pen)
    loop.ts       fixed 1/60 s timestep with interpolation
    audio.ts      thin layer over ZzFX
  vendor/
    zzfx.js       ZzFXMicro v1.3.2, MIT, Frank Force — readable source + an ESM export
    zzfx.d.ts     local typings (the library ships none)
```

The engine assumes no rendering technology: `view.ts` only hands out a sized `<canvas>`.
Moving from Canvas 2D to WebGL2 touches `game.ts` alone.

## Competition constraints

- 13,312 bytes maximum for the `.zip`, with `index.html` at the archive root.
- No external resources: everything ships inside the zip.
- Must run without console errors on current Chrome and Firefox.
- `localStorage`: namespace every key and never call `localStorage.clear()` — all
  competition entries share one origin.

## Licence

Game licence to be decided before submission.

Third-party code shipped: **ZzFX** (ZzFXMicro v1.3.2) by Frank Force, MIT licensed — full
text in [src/vendor/zzfx.LICENSE](src/vendor/zzfx.LICENSE), copyright notice preserved at
the top of [src/vendor/zzfx.js](src/vendor/zzfx.js). The only local change is one `export`
line at the end of the file: the library is a global script and the bundler needs a module.
