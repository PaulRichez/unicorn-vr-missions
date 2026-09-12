// A fixed camera, the way Metal Gear did it: the player moves the character, never the
// point of view. The angle is chosen once per level so the whole platform is readable,
// which makes the tactical read a given rather than a skill — and leaves nothing to
// control on a touchscreen but the unicorn.

import { keys } from './input';
import { W, H } from './view';

/** The unicorn on the floor: where it stands and which way it faces. */
export const player = { x: 0, z: 0, yaw: 0, speed: 0 };
/** The on-screen stick, -1..1 on each axis, screen-relative like the keys; zero at rest. */
export const stick = { x: 0, y: 0 };

/**
 * Where the eye sits. Overhead and square to the grid, the way Metal Gear framed it —
 * an inheritance from the top-down 2D games, not an isometric three-quarter view. The
 * angles never change; only the position does, and only to keep up with the character,
 * so the whole level is never on screen at once.
 *
 * The original also swings to other poses in context — flat along a corridor when you
 * press to a wall, low when you crawl. Worth stealing later; this is the default one.
 */
export const cam = { x: 0, y: 10, z: 12, pitch: -1.12, dist: 26 };
/** Half the platform's extent, set when a level loads: the shot never leaves it. */
export const bounds = { x: 0, z: 0 };

const SPEED = 3.6;
const TURN = 7;
const LAG = 5; // how eagerly the shot catches up; low enough to feel carried, not welded

export function follow(dt: number, snap = false) {
  // The camera aims at the unicorn, but no further out than the platform's edge minus
  // half of what the screen shows of the floor — so a small level sits centred and a big
  // one scrolls until its edge reaches the edge of the screen, never beyond into the void.
  // The half-widths are what this pitch and distance frame, scaled by the aspect ratio.
  // (W / H is 0 / 0 during module setup, before the first resize: hence the fallback.)
  const vx = cam.dist * 0.41 * (W / H || 1.6), vz = cam.dist * 0.37;
  const ax = Math.max(0, bounds.x - vx), az = Math.max(0, bounds.z - vz);
  const px = Math.max(-ax, Math.min(ax, player.x)), pz = Math.max(-az, Math.min(az, player.z));
  const tx = px;
  const ty = -Math.sin(cam.pitch) * cam.dist;
  const tz = pz + Math.cos(cam.pitch) * cam.dist;
  const k = snap ? 1 : Math.min(1, dt * LAG);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  cam.z += (tz - cam.z) * k;
}

/** Shortest way round the circle, so the body never turns the long way for ten degrees. */
function turnToward(from: number, to: number, max: number) {
  let d = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return from + Math.max(-max, Math.min(max, d));
}

/** Movement reads relative to the screen: up on the keys is away from the camera. */
export function update(dt: number) {
  const k = (a: string, b: string) => (keys.has(a) || keys.has(b) ? 1 : 0);
  let f = k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown');
  let s = k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft');
  if (stick.x || stick.y) { f = -stick.y; s = stick.x; }

  player.speed = 0;
  if (!f && !s) return;

  let dx = s;
  let dz = -f;
  const l = Math.hypot(dx, dz) || 1;
  dx /= l;
  dz /= l;

  player.x += dx * SPEED * dt;
  player.z += dz * SPEED * dt;
  player.yaw = turnToward(player.yaw, Math.atan2(dx, -dz), TURN * dt);
  player.speed = SPEED;
}
