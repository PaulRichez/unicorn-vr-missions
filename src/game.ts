// ─────────────────────────────────────────────────────────────────────────────
//  A unicorn's VR Missions. Floating platforms, hunters on fixed rounds, the tiles
//  they can see drawn grey on the floor. Space: the unicorn farts a rainbow, and
//  the noise pulls a hunter off his round to go and look. Reach the goal.
//  Being seen costs the level and, for good, a little of the world's colour.
// ─────────────────────────────────────────────────────────────────────────────

import { W, H, DPR } from './engine/view';
import { gl, mesh, frame, draw as drawMesh, setBands, setDark, setBlend, setSky, setFade } from './engine/gl';
import { mat, perspective, view, multiply, place, partAt } from './engine/mat';
import { cam, player, update as moveRig, follow } from './engine/camera';
import { sfx, toggleMute, isMuted } from './engine/audio';
import { pressed } from './engine/input';
import { puff, dome, panel, ring, mark, arc, prismSolid, join, shift } from './mesh';
import { buildParts, PALETTE, SCALE, LEGS, HOOVES, HORN } from './unicorn';
import * as Hunter from './hunter';
import {
  load, LEVELS, gems, spawn, exit, roofs, par, limit, brief, at, wx, wz, ti, tj, solidBox, COLS, ROWS, TILE,
} from './level';

const NAME = 'UNICORN VR';
const STORE = 'lic13.'; // every key prefixed: the competition site shares one origin
const N = LEVELS.length;
/** Every colour there is to take over a whole run — the horn's full set of bands. */
const ALL_GEMS = LEVELS.reduce((a, l) => a + l.map.join('').split('c').length - 1, 0);
/** What one sighting costs the world. Thirteen of them and there is no colour left. */
const FADE = 0.077;

// Wide enough that a hunter's full sight range (5 tiles) fits on screen around the
// player: about 14 x 9 tiles. Being spotted from off-screen is the one thing a stealth
// game may never do.
const FOV = 0.85;

// What stops the unicorn: a small square under the barrel, slid along walls one axis at
// a time so no corner stops it dead, and the muzzle and the rump as two points that may
// not sit inside a wall. Turning is never refused: a turn that puts the nose in a wall
// pushes the body back along its own axis until it is out. A long oriented box tested as
// a whole used to wedge itself in corners for good; this cannot.
const BODY = 0.7;
const NOSE = 1.2;
const TAIL = 1.05;
const wallAt = (x: number, z: number) => at(ti(x), tj(z)) === '#';

/** The last place known to be clear of every wall — the fallback when a frame goes wrong. */
const safe = { x: 0, z: 0 };

const LIMB_PIVOT_Y = 12.75;

const proj = mat();
const cameraView = mat();
const vp = mat();
const bodyM = mat();
const partM = mat();
const worldM = mat();
const tmpM = mat();

const overlay = mesh(panel(TILE, TILE));
const cloudMesh = mesh(puff(1.1));
const gasMesh = mesh(puff(0.36));
const ringMesh = mesh(ring(0.93, 1));
/** A disc: a ring with no hole. Half its triangles are empty, which the GPU does not mind. */
const shadowMesh = mesh(ring(0, 1));
const bang = mesh(mark(false));
const huh = mesh(mark(true));
const gemMesh = mesh(puff(0.3));
const skyMesh = mesh(dome(95)); // wide enough that the title's rainbow never crosses it
/**
 * The seven bands of a rainbow, each its own mesh with its own radii, so that no band
 * overlaps its neighbour: two coplanar bands fighting for the same pixels tore the
 * ending's arch apart. Scaled together they stay edge to edge. Each runs a little past
 * the half circle, below the ground, so the fade has feet to dissolve.
 */
const arcMeshes = Array.from({ length: 7 }, (_, i) => mesh(arc(17 + i * 1.15, 18.15 + i * 1.15, -0.35, Math.PI + 0.35, 30)));
/** The goal: a diamond, the stage mark hovering over the exit the way people remember it. */
const goalMesh = mesh(join(shift(prismSolid(1, 1, 0.02, 0.02, 0.8), 0, 0.8, 0), prismSolid(0.02, 0.02, 1, 1, 0.8)));

const uParts = buildParts();
const uMesh = uParts.map((p) => mesh(p.geo));
const hMesh = Hunter.parts.map((p) => mesh(p.geo));

// --- text, as DOM: the browser's font costs nothing, and VR Missions was mostly text ---
// The original's green becomes pink and its black becomes the sky; the overlay is
// transparent and the scene is the background. Its colour drains with the world's.
const ui = document.createElement('div');
ui.style.cssText =
  'position:fixed;inset:0;pointer-events:none;font:700 15px/1.5 ui-monospace,Consolas,monospace;' +
  'color:#ffe0f2;text-transform:uppercase;letter-spacing:.14em;text-shadow:0 0 10px #f3a,0 2px 0 #3a1048;' +
  'display:flex;flex-direction:column;justify-content:space-between;padding:18px 22px;text-align:center';
ui.innerHTML =
  // The bar's negative margin keeps its text on the column with the lines above and below;
  // the cursor sits outside the bar, in the margin, so the column never shifts under it.
  '<style>.b{background:#ff3fb0;color:#2a0730;padding:0 .6em;margin:0 -.6em;position:relative}' +
  '.c:before{content:"▶";position:absolute;right:100%;margin-right:.5em}' +
  // A dark backing behind the border, so a boxed line stays readable over a pink floor
  // or a white cloud instead of dissolving into whatever the camera happens to be over.
  '.x{border:1px solid #fbd9;background:#2a073066;padding:.1em .7em;display:inline-block}' +
  '.o{-webkit-text-stroke:1px #ff4fa0;color:transparent;font-style:italic}' +
  '.s{font-size:16px;letter-spacing:.14em;line-height:1.6}.w{letter-spacing:.6em}.d{opacity:.35}.r{color:#ff3b6b}' +
  // A table is a left-aligned block that still sits in the middle of the screen: the
  // centred layer would otherwise centre every row of a table on its own width.
  '.q{font-size:13px;letter-spacing:.3em;opacity:.7;margin:1em 0}.t{display:inline-block;text-align:left}' +
  // Every screen arrives instead of cutting in: .f rises into place, .p breathes on the
  // prompt, and MISSION FAILED flashes white and shakes — the sting, written in type.
  '.f{animation:f .5s both}.p{animation:p 1.2s infinite}.k{animation:s .5s}' +
  '@keyframes f{from{opacity:0;translate:0 .6em}}@keyframes p{50%{opacity:.35}}' +
  '@keyframes s{0%{color:#fff}25%,75%{translate:-8px}50%{translate:8px}}</style>';
const top = document.createElement('div');
const mid = document.createElement('div');
const low = document.createElement('div');
const pct = document.createElement('div');
top.style.cssText = 'text-align:left;white-space:pre;opacity:.9';
mid.style.cssText = 'font-size:34px;letter-spacing:.24em;white-space:pre;line-height:1.35';
low.style.cssText = 'opacity:.8;white-space:pre';
pct.style.cssText = 'position:absolute;top:18px;right:22px';
ui.append(top, mid, low, pct);
document.body.appendChild(ui);

/** Writes only on change: rewriting the same HTML every frame would restart its animations. */
const set = (el: HTMLElement, s: string) => { if (el.dataset.h !== s) el.innerHTML = el.dataset.h = s; };
/** One line of a screen that builds itself up: the i-th fades in after the others. */
const line = (s: string, i: number) => '<div class=f style="animation-delay:' + i * 0.6 + 's">' + s + '</div>';

const two = (n: number) => (n < 10 ? '0' : '') + n;
/** mm:ss.c — the format of the LIMIT / TIME box every VR mission ran under. */
const fmt = (s: number) => two((s / 60) | 0) + ':' + two(s % 60 | 0) + '.' + (((s * 10) % 10) | 0);

// --- state ------------------------------------------------------------------------------
type Phase = 'title' | 'menu' | 'intro' | 'play' | 'won' | 'end';
let phase: Phase = 'title';
let phaseT = 0;
let level = 0;
let scenery = load(level);
let cursor = 0;

let bands = 0;
let grey = 0;
/** Seconds since the level started — the number every VR mission was judged on. */
let clock = 0;
/** The run's clocks added up, for the last screen. */
let runT = 0;
/** The horn's white flash when a colour lands on it; drains in a third of a second. */
let flash = 0;
/** Seconds until the next fart is allowed: one trick, not a machine gun. */
let gasCool = 0;
/**
 * Puffs in the air: rainbow gas, or the sparkles of a colour just taken. Each rises on
 * its own spoke of one spiral (`a`, radians) and dies at `life` seconds; a short life is
 * what makes a burst read as sparkles rather than as smoke.
 */
let gas: { x: number; z: number; age: number; hue: number; a: number; life: number }[] = [];
/** The last noise ring: age (or -1 when there is none), centre, reach in tiles. */
let ringAge = -1;
let ringX = 0;
let ringZ = 0;
let ringR = 0;
/** Seconds of the "!" freeze left after a failure, before the reset lands. */
let caughtT = 0;
/** Whether that failure was the clock rather than a hunter — no colour is lost then. */
let timeUp = false;
/** Failures on this mission so far; after three, it may be skipped. */
let fails = 0;
/** Glitter left on enchanted meadow, oldest first: the footprints in the snow. */
const marks: { i: number; j: number; age: number }[] = [];
let lastI = -1;
let lastJ = -1;
let t = 0;
let stride = 0;
let gait = 0;

const drain = (r: number, g: number, b: number, k: number): [number, number, number] => {
  const l = r * 0.3 + g * 0.59 + b * 0.11;
  return [r + (l - r) * k, g + (l - g) * k, b + (l - b) * k];
};

const hsv = (h: number, s: number, v: number): [number, number, number] => {
  const f = (n: number) => {
    const k = (n + h * 6) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
};

// Storage can throw on a profile that refuses site data; the game must not care.
const ls = (k: string) => { try { return localStorage.getItem(STORE + k); } catch { return null; } };
const put = (k: string, v: string) => { try { localStorage.setItem(STORE + k, v); } catch { /* keep playing */ } };
const best = (n: number) => Number(ls(String(n))) || 0;
/** How many missions have been cleared, ever — what the menu unlocks and the % shows. */
const cleared = () => Number(ls('p')) || 0;

function reset(caught: boolean) {
  player.x = safe.x = wx(spawn.i);
  player.z = safe.z = wz(spawn.j);
  player.yaw = 0;
  gas = [];
  marks.length = 0;
  ringAge = -1;
  clock = 0;
  lastI = -1;
  // Every attempt at a level plays out the same way — a patrol you can learn is the
  // whole point of a patrol — so the colours taken this attempt go back on the floor.
  for (const g of gems) if (g.taken) { g.taken = false; bands--; }
  gasCool = 0;
  stride = gait = player.speed = 0;
  Hunter.reset();
  Hunter.look(); // the gaze is on the floor while the brief is up, not only once play starts
  if (caught) {
    grey = Math.min(1, grey + FADE);
    sfx([1.1, , 90, 0.1, 0.4, 0.8, 4, 0.5, -3, , , , , 1.5, , 0.4, 0.2]);
  }
  follow(0, true); // no glide back to the start: cut straight there
}

function begin(n: number) {
  level = n;
  scenery = load(level);
  cam.dist = 26;
  cam.pitch = -1.12;
  fails = 0;
  reset(false);
  phase = 'intro';
  phaseT = 2.2;
  sfx([0.7, , 420, 0.01, 0.08, 0.2, 1, 1.4, , , 180, 0.06]);
}
reset(false);

/** A new run: the colour comes back, the horn is bare again. Best times are kept. */
function restart() {
  grey = 0;
  bands = 0;
  runT = 0;
}

function next() {
  if (level + 1 < N) begin(level + 1);
  else {
    phase = 'end';
    phaseT = 0;
    sfx([0.8, , 260, 0.05, 0.5, 0.9, 1, 1.5, , , 130, 0.1, 0.2]);
  }
}

/**
 * Six puffs on six spokes of one spiral. Without a hue they take the six hues of the
 * spectrum in turn — a rainbow, which one puff of one random colour never was.
 */
function burst(x: number, z: number, life: number, hue = -1) {
  for (let n = 0; n < 6; n++) gas.push({ x, z, age: 0, hue: hue < 0 ? n / 6 : hue, a: n, life });
}

/** A noise here that carries r tiles. Draws the ring, alerts whoever is in earshot. */
function noise(r: number) {
  ringAge = 0;
  ringX = player.x;
  ringZ = player.z;
  ringR = r;
  if (Hunter.hear(player.x, player.z, r)) sfx([0.6, , 640, 0.02, 0.05, 0.12, 1, 1.2, , , 260, 0.05]);
}

export function resize() {
  gl.viewport(0, 0, (W * DPR) | 0, (H * DPR) | 0);
  perspective(proj, FOV, W / H, 0.1, 200);
}

function hud() {
  // The one line that carries the game: the interface loses its colour with the world.
  ui.style.filter = 'saturate(' + (1 - grey) + ')';
  const n = two(level + 1);
  const p = cleared();
  set(pct, '<span class=x>' + Math.round((p / N) * 100) + ' %</span>');
  set(top, phase === 'title' || phase === 'menu' || phase === 'end' ? ''
    : '<span class=x>MISSION ' + n + (isMuted() ? ' · MUTED' : '') + '</span>' +
      (phase === 'play' ? (level < 2 ? '\nSPACE · FART' : '') + (fails > 2 ? '\nENTER · SKIP' : '') : ''));
  let m = '';
  let l = '';

  if (phase === 'title') {
    m =
      '<div class=f><div class=q>TACTICAL FLATULENCE ACTION</div><span class=w>' + NAME + '<br>MISSIONS</span>' +
      '<div class=q>NO ONE TAKES A UNICORN BY FORCE.<br>ONLY BY PATIENCE AND TRICKERY.</div>' +
      '<div class="s r p">PRESS SPACE</div></div>';
    l = 'ARROWS / WASD · MOVE      SPACE · FART      M · MUTE';
  } else if (phase === 'menu') {
    // The original's list: vertical, looping, cursor held at the centre, a full bar on
    // the current line, [EXIT] at the bottom whether or not it has anything to do.
    // A cleared mission carries its best time on its own line; a locked one is dimmed.
    m = '<div class="s f">SNEAKING MODE · NO HORN<br><br><div class=t>';
    for (let k = -2; k <= 2; k++) {
      const i = (cursor + k + N) % N;
      const b = best(i);
      m += '<div class="' + (k ? '' : 'b c ') + (i > p ? 'd' : '') + '">MISSION ' + two(i + 1) + (b ? '   ' + fmt(b) : '') + '</div>';
    }
    m += '<br><span class=x>EXIT</span></div></div>';
    l = (cursor <= p ? 'TARGET ' + fmt(LEVELS[cursor].par) : 'LOCKED') + '\n\nUP / DOWN · CHOOSE      SPACE · START      ESC · EXIT';
  } else if (phase === 'intro') {
    m = phaseT > 0.5 ? line('MISSION ' + n + '<div class=s><br>' + brief + '</div>', 0) : line('START', 0);
    l = 'TARGET ' + fmt(par) + '      LIMIT ' + fmt(limit);
  } else if (phase === 'play') {
    m = caughtT > 0 ? '<span class="o k">' + (timeUp ? 'TIME UP<br>' : '') + 'MISSION FAILED</span>' : '';
    // The two-line box of every VR mission; TIME turns red and pulses in the last ten seconds.
    l =
      caughtT > 0 && caughtT < 0.9
        ? 'TRY AGAIN'
        : '<div class="x t"><span style="opacity:.6">LIMIT  ' + fmt(limit) +
          '</span>\n<span class="' + (limit - clock < 10 && (t * 4) % 1 < 0.5 ? 'r' : '') +
          '">TIME   ' + fmt(clock) + '</span></div>';
  } else if (phase === 'won') {
    // The original's table of three times, filled in by the machine before you ran.
    m =
      line('MISSION ' + n + ' CLEARED', 0) + '<div class="s t">' +
      line('1ST    ' + fmt(par) + '<br>2ND    ' + fmt(par * 1.5) + '<br>3RD    ' + fmt(limit) + '<br><span class="' +
        (clock <= par ? 'b' : '') + '">TIME   ' + fmt(clock) + '</span><br>BEST   ' + fmt(best(level)), 0.5) + '</div>';
    l = level + 1 < N ? 'NEXT STAGE...' : '';
  } else if (phase === 'end') {
    const full = bands === ALL_GEMS;
    m =
      phaseT < 2
        ? ''
        : line('ALL MISSIONS COMPLETE', 0) + '<div class="s t">' + line('TOTAL         ' + fmt(runT), 1) +
          line('COLOUR KEPT   ' + Math.round((1 - grey) * 100) + ' %', 2) +
          line('BANDS         ' + bands + ' / ' + ALL_GEMS, 3) + '</div>' +
          line('<div class=s><br>' +
            (!grey && full ? 'PERFECT RUN' : !grey ? 'NO ONE EVER SAW YOU' : grey === 1 ? 'THE COLOUR IS GONE.<br>LIFE IS NOT A FAIRY TALE.' : full ? 'THE HORN HAS EVERY BAND' : '') +
            '</div>', 4);
    l = phaseT > 3 ? 'SPACE · AGAIN' : '';
  }
  set(mid, m);
  set(low, l);
}

export function update(dt: number) {
  t += dt;
  // Puffs age in every phase: what is in the air keeps rising through the "!" hold and
  // over the cleared-mission table, when the rest of the world stands still.
  gas = gas.filter((g) => (g.age += dt) < g.life);
  flash -= dt * 3;
  if (pressed.has('KeyM') || pressed.has('Semicolon')) toggleMute();
  const go = pressed.has('Space') || pressed.has('Enter');

  // The title and the menu stand back and look up, at the sky the platform hangs in; a
  // mission looks down, at the floor — the one angle the original ever played from.
  if (phase === 'title' || phase === 'menu') { cam.pitch = -0.5; cam.dist = 52; follow(dt); }

  if (phase === 'title') {
    if (go) { phase = 'menu'; cursor = Math.min(cleared(), N - 1); }
  } else if (phase === 'menu') {
    if (pressed.has('ArrowUp') || pressed.has('KeyW')) cursor = (cursor + N - 1) % N;
    if (pressed.has('ArrowDown') || pressed.has('KeyS')) cursor = (cursor + 1) % N;
    if (pressed.has('Escape')) phase = 'title';
    if (go && cursor <= cleared()) begin(cursor);
    else if (go) sfx([0.6, , 120, 0.02, 0.05, 0.1, 2, 0.3]);
  } else if (phase === 'end') {
    // The camera backs off until the platform is small in the sky, and the horn draws
    // the arch it earned — through the same grey as everything else.
    phaseT += dt;
    cam.dist += (62 - cam.dist) * Math.min(1, dt * 1.2);
    cam.pitch += (-0.7 - cam.pitch) * Math.min(1, dt * 1.2);
    follow(dt);
    if (go && phaseT > 3) { restart(); phase = 'title'; }
  } else if (phase === 'intro') {
    if ((phaseT -= dt) <= 0) phase = 'play';
  } else if (phase === 'won') {
    if ((phaseT -= dt) <= 0 || go) next();
  } else play(dt);
  hud();
  // One press is one simulation step. The frame flushes presses only after every step it
  // runs, so a long frame (a 30 Hz screen, a hitch, a tab coming back) would otherwise hand
  // the same Space to two steps and carry the player from the title through the menu into
  // mission one before they saw either.
  pressed.clear();
}

function play(dt: number) {
  // Failed: everything holds for a beat under the "!" so the player sees what happened,
  // then the reset lands. Nothing else moves during it.
  if (caughtT > 0) {
    if ((caughtT -= dt) <= 0) reset(!timeUp);
    return;
  }
  // R starts the mission over; after three failures Enter lets it go. Nobody should
  // have to close the tab on mission twelve.
  if (pressed.has('KeyR')) reset(false);
  if (fails > 2 && pressed.has('Enter')) return next();
  if (DEBUG && pressed.has('KeyN')) return win();
  clock += dt;
  if (clock > limit) {
    caughtT = 1.4;
    timeUp = true;
    fails++;
    sfx([1.2, , 200, 0.05, 0.3, 0.4, 2, 0.5, -2]);
    return;
  }

  // Space: the unicorn farts. Snake knocked on walls; this is the same trick, and the
  // noise carries through walls the way sound does. Any hunter in earshot comes to look.
  gasCool -= dt;
  if (pressed.has('Space') && gasCool <= 0) {
    gasCool = 1.1;
    const fx = Math.sin(player.yaw), fz = -Math.cos(player.yaw);
    burst(player.x - fx * 1.3, player.z - fz * 1.3, 1.1);
    sfx([1.2, 0.3, 70, 0.02, 0.12, 0.28, 4, 1.4, -9, , , , , 0.9, , 0.1, 0.05]);
    noise(Hunter.HEARING);
  }
  if (ringAge >= 0 && (ringAge += dt) > 0.7) ringAge = -1;

  const wasX = player.x;
  const wasZ = player.z;
  moveRig(dt);

  // Slide along edges: resolve each axis on its own so a corner does not stop you dead.
  // There is no outer wall — what stops you is the platform simply ending.
  if (solidBox(player.x, wasZ, 0, BODY, BODY)) player.x = wasX;
  if (solidBox(player.x, player.z, 0, BODY, BODY)) player.z = wasZ;

  // The muzzle and the rump against walls: pushed out along the body's axis, never refused.
  const fx = Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  const nose = () => wallAt(player.x + fx * NOSE, player.z + fz * NOSE);
  const tail = () => wallAt(player.x - fx * TAIL, player.z - fz * TAIL);
  const px = player.x, pz = player.z;
  for (let k = 0; k < 6 && nose(); k++) { player.x -= fx * 0.1; player.z -= fz * 0.1; }
  for (let k = 0; k < 6 && tail(); k++) { player.x += fx * 0.1; player.z += fz * 0.1; }
  if (solidBox(player.x, player.z, 0, BODY, BODY)) { player.x = px; player.z = pz; }

  // Last resort. Whatever the geometry does, the pose ends the frame outside the walls.
  if (solidBox(player.x, player.z, 0, BODY, BODY) || nose() || tail()) {
    player.x = safe.x;
    player.z = safe.z;
  } else {
    safe.x = player.x;
    safe.z = player.z;
  }

  stride += player.speed * dt * 3.1;
  gait += ((player.speed > 0 ? 1 : 0) - gait) * Math.min(1, dt * 9);

  const pi = ti(player.x);
  const pj = tj(player.z);

  // Stepping onto a new tile: the floor has things to say about some of them.
  if (pi !== lastI || pj !== lastJ) {
    lastI = pi;
    lastJ = pj;
    const c = at(pi, pj);
    // Flowers pop open underfoot — a noise you did not choose, and no cooldown on it.
    if (c === ',') {
      sfx([0.8, 0.1, 900, 0.01, 0.04, 0.08, 3, 2, , , 300, 0.03]);
      burst(player.x, player.z, 0.6, 0.15); // petals, up from the hooves
      noise(4);
    }
    // Enchanted meadow keeps a glitter of every step for a while. Footprints in the snow.
    if (c === '~') {
      marks.push({ i: pi, j: pj, age: 0 });
      if (marks.length > 10) marks.shift();
    }
  }
  for (const m of marks) m.age += dt;
  while (marks.length && marks[0].age > 6) marks.shift();

  follow(dt);
  Hunter.step(dt);
  Hunter.look();
  Hunter.track(marks);

  if (Hunter.sees(pi, pj)) {
    // The "!" — and the sting that every Metal Gear player hears in their sleep.
    caughtT = 1.4;
    timeUp = false;
    fails++;
    for (const h of Hunter.seers(pi, pj)) { h.mark = 2; h.markT = 1.4; }
    sfx([1.4, , 1100, , 0.06, 0.16, 1, 2.2, , , 400, 0.04, , , , , , 0.6, 0.02]);
    return;
  }

  for (const g of gems) {
    if (g.taken) continue;
    if (Math.hypot(player.x - wx(g.i), player.z - wz(g.j)) < 1.2) {
      g.taken = true;
      bands++;
      // The colour leaves the floor as a short burst of its own hue, and the horn blinks.
      burst(wx(g.i), wz(g.j), 0.6, g.hue);
      flash = 1;
      sfx([, , 380 + bands * 80, , 0.03, 0.16, 1, 1.6, , , 220, 0.04, , , , , 0.04]);
    }
  }

  if (pi === exit.i && pj === exit.j) win();
}

function win() {
  phase = 'won';
  phaseT = 2.2;
  runT += clock;
  burst(player.x, player.z, 1.1); // the one rainbow that makes no noise
  const b = best(level);
  if (!DEBUG && (!b || clock < b)) put(String(level), clock.toFixed(1));
  if (!DEBUG && level + 1 > cleared()) put('p', String(level + 1));
  sfx([, , 520, 0.02, 0.2, 0.5, 1, 1.5, , , 300, 0.06, 0.1]);
}

/**
 * An arch of seven bands, violet in to red out, at scale k, tilted at rx to face the
 * camera and catch the light; `twice` adds the fainter, inverted outer bow of a double
 * rainbow. Drawn through the world's grey like everything else.
 */
function arch(x: number, z: number, rx: number, k: number, twice: boolean) {
  setBlend(true);
  setFade(7);
  for (let i = 0; i < (twice ? 14 : 7); i++) {
    const j = i % 7;
    const [r, g, b] = hsv(((i < 7 ? 6 - j : j) / 7) * 0.82, 0.95, 1);
    place(tmpM, x, 0.5, z, rx, 0, k * (i < 7 ? 1 : 1.6));
    drawMesh(arcMeshes[j], tmpM, r, g, b, 0, i < 7 ? 1 : 0.6);
  }
  setFade(0);
  setBlend(false);
}

/**
 * A blob on the floor under whatever stands on it — what makes a thing stand on the
 * platform rather than hover over it. The disc can be stretched along a heading, since
 * a unicorn is three times longer than it is wide and a round shadow would say otherwise.
 */
function shadow(x: number, z: number, r: number, yaw = 0, long = 1) {
  // Two discs, the inner one darker where they overlap: a soft blob, not a hard coin.
  for (let k = 1; k > 0.5; k -= 0.4) {
    place(tmpM, x, 0.05, z, -Math.PI / 2, Math.PI / 2 - yaw, r * k);
    tmpM[0] *= long;
    tmpM[2] *= long;
    drawMesh(shadowMesh, tmpM, 0.3, 0.1, 0.35, 0, 0.2);
  }
}

function drawUnicorn() {
  // The body rides up as the legs pass under it: the hop that stops a walk from sliding.
  place(bodyM, player.x, Math.abs(Math.cos(stride)) * 0.08 * gait, player.z, 0, Math.PI / 2 - player.yaw, SCALE);
  uParts.forEach((p, i) => {
    const leg = LEGS.indexOf(i);
    const hoof = HOOVES.indexOf(i);
    const limb = leg < 0 ? hoof : leg;
    let { x, y, z, rz } = p;
    // Standing, the head turns slowly to look about; the tail swings, wider towards its
    // tip. Neither is a rotation — each part only slides sideways, further the farther it
    // sits from its root — which from above reads the same and costs one line.
    if ((i > 2 && i < 11) || (i > 18 && i < 22)) z += (x - 7) * Math.sin(t * 0.9) * 0.25 * (1 - gait);
    if (i > 21) z += (x + 14) * Math.sin(t * 3.3) * 0.5;
    if (limb >= 0) {
      // Limbs swing in diagonal pairs about the shoulder or hip, hoof following its leg.
      const swing = Math.sin(stride + (limb === 0 || limb === 3 ? 0 : Math.PI)) * 0.42 * gait;
      const root = uParts[LEGS[limb]];
      const ox = x - root.x;
      const oy = y - LIMB_PIVOT_Y;
      const c = Math.cos(swing);
      const s = Math.sin(swing);
      x = root.x + ox * c - oy * s;
      y = LIMB_PIVOT_Y + ox * s + oy * c;
      rz += swing;
    }
    partAt(partM, x, y, z, rz, p.rx);
    multiply(worldM, bodyM, partM);
    const lit = i === HORN && flash > 0.5;
    const [r, g, b] = lit ? [1, 1, 1] : PALETTE[p.color];
    if (i === HORN) setBands(Math.max(bands, 0.001), 8.5);
    drawMesh(uMesh[i], worldM, r, g, b, i === HORN && bands > 0 && !lit ? 1 : 0);
  });
}

function drawHunter(h: Hunter.Hunter) {
  // Asleep he lies flat, which reads from above as what it is. Awake, the same hop as the
  // unicorn's while he walks; flat on his feet while he stands and looks.
  place(bodyM, h.x, h.asleep ? 0.35 : h.waiting > 0 ? 0 : Math.abs(Math.cos(h.leg)) * 0.07, h.z, h.asleep ? -Math.PI / 2 : 0, Math.PI / 2 - h.yaw, Hunter.SCALE);
  Hunter.parts.forEach((p, i) => {
    const swing = i < 4 ? Math.sin(h.leg + (i % 2) * Math.PI) * 0.4 : 0;
    partAt(partM, p.x, p.y, p.z, p.rz + swing, p.rx);
    multiply(worldM, bodyM, partM);
    const [r, g, b] = Hunter.PALETTE[p.color];
    drawMesh(hMesh[i], worldM, r, g, b);
  });
  // "!" or "?" over his head, tilted to face the camera. It pops in — past full size,
  // then settling, in a sixth of a second — and keeps a small bounce after. The "!"
  // runs on the freeze clock: nothing else ticks while the world holds for it. Both
  // clocks start at their maximum (1.4 and 1.6), so e never goes below 0 and the
  // glyph is never turned inside out; raise either start and this needs a clamp.
  if (h.mark) {
    const e = Math.min(1, (h.mark > 1 ? 1.4 - caughtT : 1.6 - h.markT) * 6);
    const bounce = Math.abs(Math.sin(t * 9)) * 0.12;
    place(tmpM, h.x, 2.55 + bounce, h.z, cam.pitch, 0, 2.28 * Math.sin(e * 2.3));
    if (h.mark === 2) drawMesh(bang, tmpM, 1, 0.12, 0.1);
    else drawMesh(huh, tmpM, 1, 0.85, 0.2);
  }
}

export function draw() {
  view(cameraView, cam.x, cam.y, cam.z, cam.yaw, cam.pitch);
  multiply(vp, proj, cameraView);

  const bg = drain(0.42, 0.2, 0.5, grey);
  frame(vp, cam.x, cam.y, cam.z, bg[0], bg[1], bg[2]);
  setDark(999, 999, 1, grey, cam.x, cam.z);

  // The sky: a care-bear sky, on purpose. The platform hangs in it, and the whole thing
  // drains along with everything else when the hunters have taken enough. Its pink
  // breathes over a minute and a half — too slow to see happen, enough that it is alive.
  // Drawn first, from a dome that follows the camera so it can never be reached.
  setSky(true, 1, 0.72 + Math.sin(t * 0.07) * 0.05, 0.88);
  place(tmpM, cam.x, 0, cam.z, 0, 0);
  drawMesh(skyMesh, tmpM, 0.42, 0.2, 0.52);
  setSky(false);
  // Nine clouds at three distances and four heights, drifting once round the platform
  // in about ten minutes and riding a slow swell: no two missions open on the same sky.
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + 0.7 + t * 0.01;
    const r = 26 + (k % 3) * 9;
    place(tmpM, Math.cos(a) * r, 5 + (k % 4) * 4.5 + Math.sin(t * 0.3 + k) * 0.6, Math.sin(a) * r, 0, -a, 2.6);
    drawMesh(cloudMesh, tmpM, 1, 0.97, 1);
  }

  for (const p of scenery) drawMesh(p.mesh, p.model, p.rgb[0], p.rgb[1], p.rgb[2]);

  for (const g of gems) {
    if (g.taken) continue;
    const [r, gg, b] = hsv(g.hue, 0.95, 1);
    place(tmpM, wx(g.i), 0.55 + Math.sin(t * 2.2) * 0.12, wz(g.j), 0, t);
    drawMesh(gemMesh, tmpM, r, gg, b);
  }
  // The goal turns over the exit, iridescent from red at its foot to violet at its tip.
  place(tmpM, wx(exit.i), 1 + Math.sin(t * 2) * 0.15, wz(exit.j), 0, t * 1.4, 0.9);
  setBands(7, 1.6);
  drawMesh(goalMesh, tmpM, 1, 1, 1, 1);

  setBlend(true);
  // What they can see, drawn flat on the floor with a hard edge at every tile border.
  // Grey while he is on his round; red once he has left it to look for something — the
  // Soliton radar turned its cone red the same way. The shade pulses — the whole cone at
  // once, so every edge stays hard — to keep the gaze alive; the red beats faster.
  const pulse = 0.55 + Math.sin(t * 2) * 0.05;
  const alarm = 0.55 + Math.sin(t * 8) * 0.1;
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      if (!Hunter.sees(i, j)) continue;
      const red = Hunter.alert[j * COLS + i];
      place(tmpM, wx(i), 0.04, wz(j), -Math.PI / 2, 0);
      drawMesh(overlay, tmpM, red ? 0.34 : 0.08, red ? 0.05 : 0.07, 0.1, 0, red ? alarm : pulse);
    }
  }
  // The exit breathes: its tile brightens and a ring in its own green swells and thins
  // around it, so the goal reads from anywhere on screen — under a hunter's grey too.
  const beat = 0.5 + 0.5 * Math.sin(t * 3);
  place(tmpM, wx(exit.i), 0.05, wz(exit.j), -Math.PI / 2, 0);
  drawMesh(overlay, tmpM, 0.6, 1, 0.85, 0, beat * 0.35);
  place(tmpM, wx(exit.i), 0.05, wz(exit.j), -Math.PI / 2, 0, 1.5 + beat * 0.5);
  drawMesh(ringMesh, tmpM, 0.5, 1, 0.8, 0, 0.75 - beat * 0.5);
  shadow(player.x, player.z, 0.65, player.yaw, 1.9);
  for (const h of Hunter.hunters) shadow(h.x, h.z, 0.55);
  for (const g of gems) if (!g.taken) shadow(wx(g.i), wz(g.j), 0.3);
  // The glitter trail, fading and turning as it goes.
  for (const m of marks) {
    const k = m.age / 6;
    const [r, g, b] = hsv(k, 0.9, 1);
    place(tmpM, wx(m.i), 0.12, wz(m.j), 0, m.age * 3, 0.9);
    drawMesh(gemMesh, tmpM, r, g, b, 0, 1 - k);
  }
  setBlend(false);

  drawUnicorn();

  // Rainbow gas, rising in a slow spiral that widens as it thins; the noise ring on the
  // floor, spreading to the reach of the noise so the player learns how far it carries.
  setBlend(true);
  for (const g of gas) {
    const k = g.age / g.life;
    const [r, gg, b] = hsv(g.hue, 0.9, 1);
    const a = g.a + k * 4;
    const w = 0.3 + k;
    place(tmpM, g.x + Math.cos(a) * w, 0.6 + k * 1.6, g.z + Math.sin(a) * w, 0, g.age * 2, (0.6 + k) * g.life);
    drawMesh(gasMesh, tmpM, r, gg, b, 0, 0.85 * (1 - k));
  }
  if (ringAge >= 0) {
    const k = ringAge / 0.7;
    place(tmpM, ringX, 0.06, ringZ, -Math.PI / 2, 0, 0.4 + k * ringR * TILE);
    drawMesh(ringMesh, tmpM, 1, 1, 1, 0, 0.7 * (1 - k));
  }
  setBlend(false);

  for (const h of Hunter.hunters) drawHunter(h);

  // The hedge roofs last and see-through: the unicorn shows under them to the player,
  // while to the hunters what is under a hedge does not exist.
  setBlend(true);
  for (const p of roofs) drawMesh(p.mesh, p.model, p.rgb[0], p.rgb[1], p.rgb[2], 0, 0.55);
  setBlend(false);

  // The ending: an arch the horn draws over the platform, opening over three seconds,
  // seven bands from violet in to red out — through the grey, so a run that was seen
  // eight times gets a beige one. A perfect run gets the second, inverted arch too.
  if (phase === 'end' && phaseT > 1) {
    const k = Math.min(1, (phaseT - 1) / 3);
    arch(player.x, player.z, cam.pitch, k * (2 - k), !grey && bands === ALL_GEMS);
  }
  // The title's rainbow stands behind the far edge of the platform, the one time the
  // camera is low enough to see a whole one.
  if (phase === 'title' || phase === 'menu') arch(0, wz(0) - 4, -0.3, 0.38 + COLS * 0.045, false);
}
