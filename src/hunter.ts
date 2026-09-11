// The hunter. In the medieval tapestries a unicorn cannot be taken by force — only by
// patience and trickery — so he does not chase. He walks his round, and what he can see
// is what matters. What he can hear matters too: a noise pulls him off his round to go
// and look, the way Snake's knock on a wall did, and that is the player's one trick.
//
// Same eleven-number table as the unicorn, so he costs geometry data and nothing else.

import { buildFrom, type Part } from './unicorn';
import { at, blocksSight, isSolid, wx, wz, ti, tj, route, COLS, ROWS, TILE } from './level';

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

/** coat · steel · trim · boot · skin · felt · unused */
export const PALETTE: [number, number, number][] = [
  [0.16, 0.24, 0.19],
  [0.72, 0.75, 0.8],
  [0.35, 0.26, 0.18],
  [0.14, 0.11, 0.1],
  [0.85, 0.7, 0.6],
  [0.23, 0.17, 0.14],
  [0.1, 0.1, 0.1],
];

export const parts: Part[] = buildFrom(TABLE);
export const SCALE = 0.058;

/** mark: 0 nothing, 1 the "?" of a heard noise, 2 the "!" of a sighting; markT = seconds left. */
export const hunter = { x: 0, z: 0, yaw: 0, leg: 0, mark: 0, markT: 0 };

const SPEED = 1.9;
const HURRY = 2.6; // a man going to check on a noise walks faster than one on his round
const PAUSE = 1.1;
const LOOK = 2.2; // how long he stands at the noise, looking about, before giving up
const SWEEP = 0.85;

export const RANGE = 5; // tiles he can see down a clear line
export const HALF_ANGLE = 0.62; // half the cone, in radians
export const HEARING = 8; // tiles a noise carries, walls or not — sound goes round corners

let target = 1;
let waiting = 0;
/** Tiles still to walk, nearest first. Empty while on the round between waypoints. */
let path: [number, number][] = [];
/** True while he is off his round chasing a noise; back to false once he has looked. */
let curious = false;

/** Put him on the first tile of the loaded level's round, facing the second. */
export function reset() {
  const [i, j] = route[0];
  hunter.x = wx(i);
  hunter.z = wz(j);
  hunter.leg = 0;
  hunter.mark = 0;
  hunter.markT = 0;
  target = 1 % route.length;
  waiting = 0;
  path = [];
  curious = false;
  const [ni, nj] = route[target];
  hunter.yaw = Math.atan2(wx(ni) - hunter.x, -(wz(nj) - hunter.z));
  seen = new Array(COLS * ROWS).fill(false);
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
      if (isSolid(ni, nj) || prev.has(key(ni, nj))) continue;
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

/** A noise at (x, z). If it carries this far, he drops the round and goes to look. */
export function hear(x: number, z: number): boolean {
  const gi = ti(x), gj = tj(z);
  const hi = ti(hunter.x), hj = tj(hunter.z);
  if (Math.hypot(gi - hi, gj - hj) > HEARING) return false;
  const p = findPath(hi, hj, gi, gj);
  if (!p.length && !(gi === hi && gj === hj)) return false;
  path = p;
  curious = true;
  waiting = 0;
  hunter.mark = 1;
  hunter.markT = 1.6;
  return true;
}

/** Walk towards a tile; true once he is standing on it. */
function walkTo(i: number, j: number, speed: number, dt: number): boolean {
  const dx = wx(i) - hunter.x;
  const dz = wz(j) - hunter.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.12) return true;
  const s = Math.min(d, speed * dt);
  hunter.x += (dx / d) * s;
  hunter.z += (dz / d) * s;
  hunter.yaw = Math.atan2(dx, -dz);
  hunter.leg += dt * 7;
  return false;
}

export function step(dt: number) {
  if ((hunter.markT -= dt) <= 0) hunter.mark = 0;

  if (waiting > 0) {
    waiting -= dt;
    // Standing still, he sweeps his gaze — the moment the player waits out.
    hunter.yaw += Math.sin(waiting * 2.4) * SWEEP * dt * 2;
    if (waiting <= 0 && curious) {
      // Nothing there. Back to the round, by the shortest walk to the next waypoint.
      curious = false;
      const [gi, gj] = route[target];
      path = findPath(ti(hunter.x), tj(hunter.z), gi, gj);
    }
    return;
  }

  if (path.length) {
    if (walkTo(path[0][0], path[0][1], curious ? HURRY : SPEED, dt)) {
      path.shift();
      if (!path.length && curious) waiting = LOOK;
    }
    return;
  }

  const [gi, gj] = route[target];
  if (walkTo(gi, gj, SPEED, dt)) {
    target = (target + 1) % route.length;
    waiting = PAUSE;
  }
}

/**
 * Which tiles he can see. A tile counts as seen when it is inside the cone, within
 * range, and nothing solid stands on the straight line to its centre — the rule
 * Invisible Inc settled on, and the reason walls are worth walking behind.
 *
 * Deliberately per tile rather than a smooth gradient: a soft edge looks better and
 * plans worse, and a stealth player has to know, not guess.
 */
export let seen: boolean[] = [];

export function look() {
  seen.fill(false);
  const hi = hunter.x / TILE + (COLS - 1) / 2;
  const hj = hunter.z / TILE + (ROWS - 1) / 2;

  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      const c = at(i, j);
      if (c === '#' || c === ' ') continue;
      const dx = i - hi;
      const dj = j - hj;
      const dist = Math.hypot(dx, dj);
      if (dist > RANGE) continue;

      let a = Math.atan2(dx, -dj) - hunter.yaw;
      a = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
      if (a > HALF_ANGLE && dist > 1.2) continue; // he still notices what is underfoot

      // March the line to the tile centre and stop at the first wall.
      let clear = true;
      const steps = Math.ceil(dist * 4);
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const si = Math.round(hi + dx * t);
        const sj = Math.round(hj + dj * t);
        if (blocksSight(si, sj)) { clear = false; break; }
      }
      if (clear) seen[j * COLS + i] = true;
    }
  }
}

export const sees = (i: number, j: number) => seen[j * COLS + i] === true;
