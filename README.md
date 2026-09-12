# Unicorn VR Missions

An entry for [js13kGames](https://js13kgames.com) 2026, theme **Unicorns and Rainbows**.

A stealth game in the shape of *Metal Gear Solid: VR Missions* (Sneaking mode, no weapon):
thirteen small floating platforms, hunters walking fixed rounds, and a white unicorn that
has to reach the goal — a diamond turning over the exit — without being seen. Where a key
lies on the platform, the goal only appears once the key is taken. The tiles a hunter can
see are painted grey on the floor. Snake knocked on walls to pull a guard off his round; the unicorn
farts a rainbow. Every sighting costs the mission and, for good, a little of the world's
colour — the ending is a rainbow drawn through whatever colour you have left.

- **Categories** — Desktop + Mobile + WebXR (one zip, no external library)
- **Budget** — 13,312 bytes, zipped
- **Controls** — arrows / WASD move, Space farts, R restarts, M mutes, Escape returns to
  the menu, Enter skips a mission after three failures. The mouse does nothing. On a
  touchscreen: a stick to move (a flick up or down also steers the mission list), a big
  button that says what it does (START, fart, NEXT, AGAIN) and drains its pink while the
  next fart recharges, and the mission box, the sound box and the clock are buttons (menu,
  mute, restart or skip). A tap anywhere confirms, outside a mission. A phone held upright
  gets the page turned a quarter turn: the game is always landscape, nothing to rotate.
  In a headset (an ENTER VR button appears when the browser has one): the platform is a
  diorama on a table in front of you, the head is the camera, a thumbstick walks the
  unicorn, the trigger farts or confirms, A or X goes back to the list, B or Y restarts
  or skips, a flick of the stick up or down moves through the list. You never move, so
  nothing can make you sick. The page's text hangs over the far edge of the platform

## How it plays

| Original (1998–99) | Here |
|---|---|
| Blocks floating in a digital void, a fixed overhead camera that follows Snake | Floating platforms in a care-bear sky, same camera |
| Guard's cone of vision on the Soliton radar | The tiles he can see, painted grey on the floor; red while he investigates |
| Knock on a wall, guard comes to look ("?") | Space: a rainbow fart, audible six tiles through walls, one every three seconds |
| "!" and the alert sting | Same |
| Noisy floor panels | Flowers that pop underfoot, audible four tiles, a note hanging over each |
| Snow that keeps footprints | Enchanted meadow that keeps a glitter trail; a hunter who sees it follows it |
| Crawl ducts through the blocks | Tunnels under the hedge: the unicorn slips through, hunters neither enter nor see in |
| Waist-high walls | Fences: they stop feet, not eyes |
| Sleeping guards | A dozing hunter: blind until a noise wakes him, then a lookout for good |
| Rotating cameras | A lookout: a hunter who never walks, only turns |
| The goal, a stage mark you walk onto; in SOCOM modes it appears once every target is down | A rainbow diamond over the exit tile; where there is a key, it appears once the key is taken |
| LIMIT / TIME box, 1ST / 2ND / 3RD table, MISSION FAILED, mission list with % | Same, as DOM text |
| Restarting a mission only costs time | Being seen also drains the world's colour, permanently |

## Development

```sh
npm install
npm run dev     # http://127.0.0.1:8000, rebuilds and reloads on save
npm run build   # release zip + size report
npm run check   # TypeScript typecheck
node tools/solve.mjs [n] [--quick]   # play every mission with the real hunter code, report optimum times
```

`npm run dev` prints an estimated zipped release size on every save. Dev builds define
`DEBUG` as true: in a mission, `N` clears it at once, which is how the later screens get
tested; the release build defines it false and terser drops the code.

The solver is how `par` and `limit` are set: it runs a breadth-first search over
(tile, frame) against the hunters' fixed timeline for a silent player, and a scan of
routes, waits and farts through the full simulation for the noisy ones. Par is 1.35 x the
best time it finds, the limit 3.5 x. It also reports how forgiving a mission is: the share
of naive plans that succeed, and on the most forgiving route the share of wait durations
that do (`tolerance`) — 100 % means the route works whatever you do, 10 % means you must
read the round. `--quick` samples fewer routes, about ten seconds a mission, for iterating
on a map; the full run is the one that sets the numbers.

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
wins. The build prints both sizes, which keeps the trade-off visible on every release.

Output: `game.zip` at the root (the deliverable) and `dist/index.html` (plays as-is).

## Structure

```
src/
  index.html      minimal HTML shell, __JS__ is the injection point
  main.ts         engine <-> game wiring
  game.ts         the game: phases, HUD, rendering
  level.ts        the thirteen missions as strings, and the loader
  hunter.ts       the hunters: rounds, hearing, sight, tracking
  unicorn.ts      creatures as eleven-number primitive tables
  mesh.ts         procedural geometry: prisms, cones, clouds, arcs, marks
  engine/
    gl.ts         WebGL2: one program, flat shading, iridescence, sky, desaturation
    mat.ts        column-major 4x4 matrices
    camera.ts     the fixed overhead camera and the player's movement
    view.ts       canvas, resizing, capped devicePixelRatio
    input.ts      keyboard by physical key code, single pointer
    loop.ts       fixed 1/60 s timestep
    audio.ts      thin layer over ZzFX
  vendor/
    zzfx.js       ZzFXMicro v1.3.2, MIT, Frank Force — readable source + an ESM export
    zzfx.d.ts     local typings (the library ships none)
tools/
  solver.ts       plays the missions to measure their optimum times
  solve.mjs       bundles and runs it under node, WebGL stubbed out
```

A level is a drawing: space is void, `.` floor, `#` wall, `U` start, `E` exit, `c` a
key to take (the goal waits for it), `,` flowers, `~` meadow, `-` a tunnel under the hedge, `=` a fence. A
hunter is a list of tiles he walks between; one tile repeated twice is a lookout who only
turns, one tile alone is a hunter asleep on it. A hunter walks straight between two
consecutive waypoints without checking for walls, so no round may cross a `#`, `=`, `-`
or void.

## Competition constraints

- 13,312 bytes maximum for the `.zip`, with `index.html` at the archive root.
- No external resources: everything ships inside the zip.
- Must run without console errors on current Chrome and Firefox.
- `localStorage`: every key is prefixed `lic13.` and nothing ever calls
  `localStorage.clear()` — all competition entries share one origin.

## Licence

[MIT](LICENSE).

Third-party code shipped: **ZzFX** (ZzFXMicro v1.3.2) by Frank Force, MIT licensed — full
text in [src/vendor/zzfx.LICENSE](src/vendor/zzfx.LICENSE), copyright notice preserved at
the top of [src/vendor/zzfx.js](src/vendor/zzfx.js). The only local change is one `export`
line at the end of the file: the library is a global script and the bundler needs a module.
