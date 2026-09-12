// The hunters. In the medieval tapestries a unicorn cannot be taken by force — only by
// patience and trickery — so they do not chase. Each walks his round, and what he can
// see is what matters. What he can hear matters too: a noise pulls him off his round to
// go and look, the way Snake's knock on a wall did, and that is the player's one trick.
//
// Same eleven-number table as the unicorn, so a hunter costs geometry data and nothing
// else; a level with three of them costs three routes.

import { buildFrom, type Part } from './unicorn';
import { at, blocksSight, isSolid, wx, wz, ti, tj, routes, COLS, ROWS, TILE } from './level';

//            t   x   y   z  s1  s2  s3  rz  rx col fl
const TABLE = [
  [2, 0, 4, 2.6, 17, 17, 80, 0, 0, 0, 0], // leg
  [2, 0, 4, -2.6, 17, 17, 80, 0, 0, 0, 0],
  [2, 0, 0.8, 2.6, 20, 20, 18, 0, 0, 3, 0], // boot
  [2, 0, 0.8, -2.6, 20, 20, 18, 0, 0, 3, 0],
  [0, 0, 13, 0, 50, 100, 82, 0, 0, 0, 0], // coat
  [0, 0, 8.5, 0, 54, 40, 86, 0, 0, 2, 0], // belt and skirt of the coat
  [2, 1, 15, 5.2, 13, 13, 74, 6, 0, 0, 0], // arms
  [2, 1, 15, -5.2, 13, 13, 74, -6, 0, 0, 0],
  [1, 0, 20.4, 0, 32, 108, 96, 0, 0, 4, 0], // head
  [2, 0, 23.1, 0, 64, 64, 8, 0, 0, 5, 0], // hat brim
  [3, 0, 25.4, 0, 40, 46, 0, 0, 0, 5, 0], // crown of the hat
  [2, 3.5, 14, 6.2, 5, 5, 200, -74, 0, 1, 0], // the spear
];

/** coat · steel · trim · boot · skin · felt */
export const PALETTE: [number, number, number][] = [
  [0.16, 0.24, 0.19],
  [0.72, 0.75, 0.8],
  [0.35, 0.26, 0.18],
  [0.14, 0.11, 0.1],
  [0.85, 0.7, 0.6],
  [0.23, 0.17, 0.14],
];

export const parts: Part[] = buildFrom(TABLE);
export const SCALE = 0.058;

const SPEED = 1.9;
const HURRY = 2.6; // a man going to check on a noise walks faster than one on his round
const PAUSE = 1.1;
const LOOK = 2.2; // how long he stands at the noise, looking about, before giving up
const SWEEP = 0.85;

export const RANGE = 4.5; // tiles he can see down a clear line
export const HALF_ANGLE = 0.55; // half the cone, in radians: a 63-degree wedge, like the radar's
const NEAR = 1.5; // closer than this he notices you whatever way he faces
export const HEARING = 6; // tiles a noise carries, walls or not — sound goes round corners

export interface Hunter {
  x: number; z: number; yaw: number; leg: number;
  /** 0 nothing, 1 the "?" of a heard noise, 2 the "!" of a sighting; markT = seconds left. */
  mark: number; markT: number;
  route: [number, number][];
  target: number;
  waiting: number;
  /** Tiles still to walk, nearest first. Empty while on the round between waypoints. */
  path: [number, number][];
  /** True while off the round chasing a noise; back to false once he has looked. */
  curious: boolean;
  /** The tiles this one can see, refreshed every step. */
  seen: boolean[];
  /** A round of one tile is a hunter dozing on it: blind and still until a noise wakes
   *  him — and then he stays up, sweeping his post like a lookout. */
  asleep: boolean;
}

export const hunters: Hunter[] = [];

/** The union of every hunter's sight — what the floor shows, what catches the player. */
export let seen: boolean[] = [];
/** The part of it seen by a hunter who is off his round investigating — drawn red, the
 *  way the Soliton radar turned a cone red in noise mode. */
export let alert: boolean[] = [];

function resetOne(h: Hunter) {
  const [i, j] = h.route[0];
  h.x = wx(i);
  h.z = wz(j);
  h.leg = 0;
  h.mark = 0;
  h.markT = 0;
  h.target = 1 % h.route.length;
  h.waiting = 0;
  h.path = [];
  h.curious = false;
  h.asleep = h.route.length < 2;
  const [ni, nj] = h.route[h.target];
  h.yaw = Math.atan2(wx(ni) - h.x, -(wz(nj) - h.z));
  h.seen = new Array(COLS * ROWS).fill(false);
}

/** One hunter per route of the loaded level, each at the start of his round. */
export function reset() {
  hunters.length = 0;
  for (const route of routes) {
    const h = { route } as Hunter;
    hunters.push(h);
    resetOne(h);
  }
  seen = new Array(COLS * ROWS).fill(false);
  alert = new Array(COLS * ROWS).fill(false);
}

/**
 * Shortest walk between two tiles, four-way, never through walls or off the platform.
 * The grid is tiny, so a plain breadth-first search is cheaper than being clever.
 */
function findPath(si: number, sj: number, gi: number, gj: number): [number, number][] {
  if (si === gi && sj === gj) return [];
  const prev = new Map<number, number>();
  const key = (i: number, j: number) => j * COLS + i;
  const queue: [number, number][] = [[si, sj]];
  prev.set(key(si, sj), -1);
  while (queue.length) {
    const [i, j] = queue.shift()!;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj;
      if (isSolid(ni, nj) || at(ni, nj) === '-' || prev.has(key(ni, nj))) continue;
      prev.set(key(ni, nj), key(i, j));
      if (ni === gi && nj === gj) {
        const out: [number, number][] = [];
        let k = key(ni, nj);
        while (k !== key(si, sj)) {
          out.unshift([k % COLS, Math.floor(k / COLS)]);
          k = prev.get(k)!;
        }
        return out;
      }
      queue.push([ni, nj]);
    }
  }
  return [];
}

/** A noise at (x, z). Every hunter it carries to drops his round and goes to look. */
export function hear(x: number, z: number, reach = HEARING): boolean {
  const gi = ti(x), gj = tj(z);
  let heard = false;
  for (const h of hunters) {
    const hi = ti(h.x), hj = tj(h.z);
    if (Math.hypot(gi - hi, gj - hj) > reach) continue;
    const p = findPath(hi, hj, gi, gj);
    if (!p.length && !(gi === hi && gj === hj)) continue;
    h.asleep = false;
    h.path = p;
    h.curious = true;
    h.waiting = 0;
    h.mark = 1;
    h.markT = 1.6;
    heard = true;
  }
  return heard;
}

/** Walk towards a tile; true once standing on it. */
function walkTo(h: Hunter, i: number, j: number, speed: number, dt: number): boolean {
  const dx = wx(i) - h.x;
  const dz = wz(j) - h.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.12) return true;
  const s = Math.min(d, speed * dt);
  h.x += (dx / d) * s;
  h.z += (dz / d) * s;
  h.yaw = Math.atan2(dx, -dz);
  h.leg += dt * 7;
  return false;
}

function stepOne(h: Hunter, dt: number) {
  if ((h.markT -= dt) <= 0) h.mark = 0;
  if (h.asleep) return;

  if (h.waiting > 0) {
    h.waiting -= dt;
    // Standing still, he sweeps his gaze — the moment the player waits out.
    h.yaw += Math.sin(h.waiting * 2.4) * SWEEP * dt * 2;
    if (h.waiting <= 0 && h.curious) {
      // Nothing there. Back to the round, by the shortest walk to the next waypoint.
      h.curious = false;
      const [gi, gj] = h.route[h.target];
      h.path = findPath(ti(h.x), tj(h.z), gi, gj);
    }
    return;
  }

  if (h.path.length) {
    if (walkTo(h, h.path[0][0], h.path[0][1], h.curious ? HURRY : SPEED, dt)) {
      h.path.shift();
      if (!h.path.length && h.curious) h.waiting = LOOK;
    }
    return;
  }

  const [gi, gj] = h.route[h.target];
  if (walkTo(h, gi, gj, SPEED, dt)) {
    h.target = (h.target + 1) % h.route.length;
    h.waiting = PAUSE;
  }
}

export function step(dt: number) {
  for (const h of hunters) stepOne(h, dt);
}

/**
 * Whether nothing solid stands on the straight line from a point (in tile units) to a
 * tile's centre. Walks every tile the line crosses — a grid traversal, not a sampling,
 * which used to let a line slip between two walls that touch at a corner — and when it
 * passes exactly through a corner it looks at both tiles either side, so a hunter never
 * peeks through the seam.
 */
function clearLine(x0: number, y0: number, i1: number, j1: number): boolean {
  let i = Math.round(x0), j = Math.round(y0);
  const dx = i1 - x0, dy = j1 - y0;
  const si = Math.sign(dx), sj = Math.sign(dy);
  // Parametric distance to the next tile border on each axis; borders sit at k + 0.5.
  let tx = dx ? (i + si * 0.5 - x0) / dx : 2;
  let ty = dy ? (j + sj * 0.5 - y0) / dy : 2;
  const ddx = dx ? Math.abs(1 / dx) : 0, ddy = dy ? Math.abs(1 / dy) : 0;
  for (let n = 0; n < 64 && (i !== i1 || j !== j1); n++) {
    if (Math.abs(tx - ty) < 1e-6) {
      if (blocksSight(i + si, j) || blocksSight(i, j + sj)) return false;
      i += si; j += sj; tx += ddx; ty += ddy;
    } else if (tx < ty) { i += si; tx += ddx; }
    else { j += sj; ty += ddy; }
    if ((i !== i1 || j !== j1) && blocksSight(i, j)) return false;
  }
  return true;
}

/**
 * Which tiles a hunter can see. A tile counts as seen when it is inside the cone, within
 * range, and nothing solid stands on the straight line to its centre — the rule
 * Invisible Inc settled on, and the reason walls are worth walking behind.
 *
 * Deliberately per tile rather than a smooth gradient: a soft edge looks better and
 * plans worse, and a stealth player has to know, not guess.
 */
function lookOne(h: Hunter) {
  h.seen.fill(false);
  if (h.asleep) return;
  const hi = h.x / TILE + (COLS - 1) / 2;
  const hj = h.z / TILE + (ROWS - 1) / 2;

  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      const c = at(i, j);
      if ('# -'.includes(c)) continue;
      const dx = i - hi;
      const dj = j - hj;
      const dist = Math.hypot(dx, dj);
      if (dist > RANGE) continue;

      let a = Math.atan2(dx, -dj) - h.yaw;
      a = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
      if (a > HALF_ANGLE && dist > NEAR) continue; // he still notices what is underfoot

      if (clearLine(hi, hj, i, j)) {
        h.seen[j * COLS + i] = true;
        seen[j * COLS + i] = true;
        if (h.curious) alert[j * COLS + i] = true;
      }
    }
  }
}

export function look() {
  seen.fill(false);
  alert.fill(false);
  for (const h of hunters) lookOne(h);
}

/**
 * The snowfield rule: a hunter who sees a glitter left by the unicorn follows the trail —
 * to its freshest mark. Stand on it and he is a tracker; be gone and he is led astray.
 * Marks are newest last.
 */
export function track(marks: { i: number; j: number }[]) {
  if (!marks.length) return;
  for (const h of hunters) {
    if (h.curious) continue;
    let fresh: { i: number; j: number } | null = null;
    for (const m of marks) if (h.seen[m.j * COLS + m.i]) fresh = m;
    if (!fresh) continue;
    const last = marks[marks.length - 1];
    h.path = findPath(ti(h.x), tj(h.z), last.i, last.j);
    h.curious = true;
    h.waiting = 0;
    h.mark = 1;
    h.markT = 1.6;
  }
}

export const sees = (i: number, j: number) => seen[j * COLS + i] === true;

/** Which hunters have this tile in sight right now — for putting the "!" over their heads. */
export const seers = (i: number, j: number) => hunters.filter((h) => h.seen[j * COLS + i]);
