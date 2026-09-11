// A fixed camera, the way Metal Gear did it: the player moves the character, never the
// point of view. The angle is chosen once per level so the whole platform is readable,
// which makes the tactical read a given rather than a skill — and leaves nothing to
// control on a touchscreen.

import { keys } from './input';

/** The unicorn on the floor: where it stands and which way it faces. */
export const player = { x: 0, z: 0, yaw: 0, speed: 0 };

/**
 * Where the eye sits. Overhead and square to the grid, the way Metal Gear framed it —
 * an inheritance from the top-down 2D games, not an isometric three-quarter view. The
 * angles never change; only the position does, and only to keep up with the character,
 * so the whole level is never on screen at once.
 *
 * The original also swings to other poses in context — flat along a corridor when you
 * press to a wall, low when you crawl. Worth stealing later; this is the default one.
 */
export const cam = { x: 0, y: 10, z: 12, yaw: 0, pitch: -1.12, dist: 26 };

const SPEED = 3.6;
const TURN = 7;
const LAG = 5; // how eagerly the shot catches up; low enough to feel carried, not welded

export function follow(dt: number, snap = false) {
  const cp = Math.cos(cam.pitch);
  const tx = player.x - Math.sin(cam.yaw) * cp * cam.dist;
  const ty = -Math.sin(cam.pitch) * cam.dist;
  const tz = player.z + Math.cos(cam.yaw) * cp * cam.dist;
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
  const f = k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown');
  const s = k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft');

  player.speed = 0;
  if (!f && !s) return;

  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  let dx = sy * f + cy * s;
  let dz = -cy * f + sy * s;
  const l = Math.hypot(dx, dz) || 1;
  dx /= l;
  dz /= l;

  player.x += dx * SPEED * dt;
  player.z += dz * SPEED * dt;
  player.yaw = turnToward(player.yaw, Math.atan2(dx, -dz), TURN * dt);
  player.speed = SPEED;
}
