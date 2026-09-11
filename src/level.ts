// A level is a drawing plus a patrol. Space is the void beyond the platform, a dot is
// floor, a hash is a wall that cuts both movement and sight. There is no outer wall —
// the edge of the platform is the boundary, which is what lets a level have a
// silhouette instead of always being a rectangle.
//
//   U start · E exit · c colour to take · o cloud, the only place a cloud goes unnoticed
//
// Every level costs its strings and nothing else: the three meshes below are built once
// and only their placements change when a level loads.

import { mesh, type Mesh } from './engine/gl';
import { mat, place, type M4 } from './engine/mat';
import { prismSolid, puff } from './mesh';

export interface Level {
  map: string[];
  /** Tiles the hunter walks between, in order, then back to the first. */
  route: [number, number][];
}

export const LEVELS: Level[] = [
  // 1 — watch the round, wait for the gap. Walls hide you; the colour sits on his path.
  {
    map: [
      '  .......  ',
      ' ......... ',
      '...###...c.',
      '..U###.....',
      '.......###.',
      '..o....###.',
      '.....##....',
      ' ....##..E.',
      '  .......  ',
    ],
    route: [[10, 2], [10, 7], [7, 7], [10, 7]],
  },
  // 2 — he paces the whole column the exit sits in, so no timing gets you there. Fart
  // from the far side: he comes to look, and the other way round the block is clear.
  {
    map: [
      'U.......',
      '.######.',
      '.######E',
      '.######.',
      '.......c',
    ],
    route: [[7, 0], [7, 4]],
  },
];

export const TILE = 3;
export const WALL_H = 2.6;
export const SLAB = 0.7;

// Live state of the loaded level. Everything below reads these, so swapping a level is a
// matter of reassigning them and rebuilding the placements.
export let MAP: string[] = LEVELS[0].map;
export let COLS = 0;
export let ROWS = 0;
export let spawn = { i: 0, j: 0 };
export let exit = { i: 0, j: 0 };
export let gems: { i: number; j: number; hue: number; taken: boolean }[] = [];
export let covers: { i: number; j: number }[] = [];
export let route: [number, number][] = [];

export const wx = (i: number) => (i - (COLS - 1) / 2) * TILE;
export const wz = (j: number) => (j - (ROWS - 1) / 2) * TILE;
export const ti = (x: number) => Math.round(x / TILE + (COLS - 1) / 2);
export const tj = (z: number) => Math.round(z / TILE + (ROWS - 1) / 2);

export const at = (i: number, j: number) =>
  i < 0 || j < 0 || i >= COLS || j >= ROWS ? ' ' : MAP[j][i] ?? ' ';

/** Nothing to stand on: off the platform, or a wall. */
export const isSolid = (i: number, j: number) => {
  const c = at(i, j);
  return c === ' ' || c === '#';
};
/** Only walls stop a gaze — you can see straight across a gap in the platform. */
export const blocksSight = (i: number, j: number) => at(i, j) === '#';

/**
 * Solid under any corner of an oriented rectangle: long down the animal's spine, narrow
 * across it. A square would be both too wide — catching on nothing in a corridor — and
 * too short to keep the nose out of a wall, since a unicorn is about three times longer
 * than it is broad.
 *
 * Facing follows the movement convention: forward is (sin yaw, -cos yaw) on the floor.
 */
export function solidBox(x: number, z: number, yaw: number, half: number, wide: number) {
  const fx = Math.sin(yaw), fz = -Math.cos(yaw);
  const rx = Math.cos(yaw), rz = Math.sin(yaw);
  for (const a of [half, -half]) {
    for (const b of [wide, -wide]) {
      const px = x + fx * a + rx * b;
      const pz = z + fz * a + rz * b;
      if (isSolid(ti(px), tj(pz))) return true;
    }
  }
  return false;
}

export interface Part {
  mesh: Mesh;
  model: M4;
  rgb: [number, number, number];
}

let slab: Mesh, wall: Mesh, puffMesh: Mesh;

/** Read a level in: set the live state and lay out its placements. */
export function load(n: number): Part[] {
  const lv = LEVELS[n % LEVELS.length];
  MAP = lv.map;
  ROWS = MAP.length;
  COLS = Math.max(...MAP.map((r) => r.length));
  route = lv.route;
  gems = [];
  covers = [];

  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      const c = at(i, j);
      if (c === 'U') spawn = { i, j };
      if (c === 'E') exit = { i, j };
      if (c === 'c') gems.push({ i, j, hue: 0.13, taken: false });
      if (c === 'o') covers.push({ i, j });
    }
  }

  // The floor is a slab, not a sheet: its thickness is what makes the platform read as
  // floating rather than as a hole cut in a bigger ground.
  slab ??= mesh(prismSolid(TILE, TILE, TILE, TILE, SLAB));
  wall ??= mesh(prismSolid(TILE, TILE, TILE, TILE, WALL_H));
  puffMesh ??= mesh(puff(0.9));

  const parts: Part[] = [];
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      const c = at(i, j);
      if (c === ' ') continue;
      const x = wx(i);
      const z = wz(j);

      if (c === '#') {
        parts.push({ mesh: wall, model: place(mat(), x, 0, z, 0, 0), rgb: [0.62, 0.36, 0.76] });
        parts.push({ mesh: slab, model: place(mat(), x, -SLAB, z, 0, 0), rgb: [0.42, 0.2, 0.55] });
        continue;
      }

      // Two tones only, and they alternate: enough to read the grid and judge a
      // distance, quiet enough that the grey of a watched tile is the loudest thing on
      // the floor. In this game colour carries information, so decorating with it is
      // the same as lying.
      const warm = (i + j) % 2 === 0;
      const rgb: [number, number, number] =
        c === 'E' ? [0.45, 0.92, 0.76] : warm ? [1, 0.72, 0.87] : [0.95, 0.61, 0.82];
      parts.push({ mesh: slab, model: place(mat(), x, -SLAB, z, 0, 0), rgb });
    }
  }

  for (const c of covers) {
    parts.push({ mesh: puffMesh, model: place(mat(), wx(c.i), 0, wz(c.j), 0, 0), rgb: [1, 1, 1] });
  }

  return parts;
}
