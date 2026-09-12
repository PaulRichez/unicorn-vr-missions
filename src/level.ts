// A level is a drawing plus a patrol. Space is the void beyond the platform, a dot is
// floor, a hash is a wall that cuts both movement and sight. There is no outer wall —
// the edge of the platform is the boundary, which is what lets a level have a
// silhouette instead of always being a rectangle.
//
//   U start · E exit · c a key: the goal only appears once every key is taken
//   , flowers that bloom underfoot with a pop — a noise you did not choose
//   ~ enchanted meadow that keeps a glitter of every step for a while — the snowfield
//   - a tunnel under the hedge: the unicorn slips through, a hunter neither enters nor
//     sees in, and nobody sees across it — the crawl duct of the original
//   = a fence: stops feet, not eyes — the waist-high wall of the original
//
// Every level costs its strings and nothing else: the three meshes below are built once
// and only their placements change when a level loads. Rows may be cut short: anything
// off the end of a string is void.
//
// Rule for authors: a hunter walks a straight line between two consecutive waypoints
// and never checks for walls on the way — so no round may cross a '#'.

import { mesh, type Mesh } from './engine/gl';
import { mat, place, type M4 } from './engine/mat';
import { prismSolid, puff } from './mesh';

export interface Level {
  map: string[];
  /** One round per hunter: tiles he walks between, in order, then back to the first. */
  routes: [number, number][][];
  /** Target and limit, in seconds, the way every VR mission carried both. */
  par: number;
  limit: number;
  /** One line at the start of the mission, the way every VR mission opened on a description. */
  brief: string;
}

export const LEVELS: Level[] = [
  // 1 — THE ROUND
  {
    map: [
      '.....#..E',
      '.###.#...',
      '.#...#...',
      '.#.###.#.',
      '.#.....#.',
      '.####.##.',
      'U........',
    ],
    routes: [[[8, 1], [8, 5]]],
    par: 17,
    limit: 45,
    brief: 'GREY IS WHAT HE SEES',
  },
  // 2 — KNOCK KNOCK
  {
    map: [
      '........E',
      '.##.#.##.',
      '.##...##.',
      '.........',
      '.##...##.',
      '.##.#.##.',
      'U........',
    ],
    routes: [[[8, 1], [8, 1]]],
    par: 17,
    limit: 45,
    brief: 'SPACE. HE WILL COME AND LOOK',
  },
  // 3 — TWO OF THEM
  {
    map: [
      '......E',
      '.......',
      '..#.#..',
      '.......',
      '..#c#..',
      '.......',
      '..#.#..',
      '.......',
      'U......',
    ],
    routes: [[[0, 3], [6, 3], [6, 1], [0, 1]], [[6, 5], [0, 5], [0, 7], [6, 7]]],
    par: 23,
    limit: 60,
    brief: 'TWO ROUNDS. ONE GAP',
  },
  // 4 — UNDER THE HEDGE
  {
    map: [
      'U........',
      '.##.#.##.',
      '.c..#....',
      '.##.#.##.',
      '....#....',
      '.##.-.##.',
      '....#....',
      '....#...E',
    ],
    routes: [[[3, 0], [5, 0]], [[8, 1], [8, 6]], [[0, 6], [3, 6]]],
    par: 18,
    limit: 45,
    brief: 'SLIP UNDER. HE CANNOT FOLLOW',
  },
  // 5 — BLIND CORNERS
  {
    map: [
      'U..........',
      '.####.####.',
      '.#.......#.',
      '.#.#####.#.',
      '.#.#####.#c',
      '.#.#####.#.',
      '.#.......#.',
      '.####.####.',
      '.....E.....',
    ],
    routes: [[[2, 2], [8, 2], [8, 6], [2, 6]], [[10, 1], [10, 8], [1, 8], [10, 8]]],
    par: 31,
    limit: 80,
    brief: 'WALLS HIDE YOU. THE EDGE DOES NOT',
  },
  // 6 — THE FLOWERS TELL
  {
    map: [
      '  ..E..',
      ' .......',
      '..,,,,,..',
      '..,#,#,..',
      '..,,,,,..',
      '..,#,#,..',
      '..,,,,,..',
      ' c......',
      '  ..U..',
    ],
    routes: [[[1, 1], [7, 1]], [[6, 6], [2, 6]]],
    par: 43,
    limit: 110,
    brief: 'THE FLOWERS TELL ON YOU',
  },
  // 7 — THE SLEEPER
  {
    map: [
      '.........',
      '..,,.,,..',
      '...#.#...',
      'U.#####.E',
      '...#.#.##',
      '.........',
      '....c....',
    ],
    routes: [[[4, 1]], [[1, 5], [7, 5]]],
    par: 27,
    limit: 70,
    brief: 'HE SLEEPS. TREAD ON NO FLOWER',
  },
  // 8 — THE GLITTER BRIDGE
  {
    map: [
      'U..........',
      '...........',
      '.##~~##~~##',
      '.##~~##~~##',
      '...........',
      '......#....',
      '.........E.',
    ],
    routes: [[[3, 1], [3, 5]], [[8, 5], [8, 1]]],
    par: 24,
    limit: 65,
    brief: 'THE MEADOW KEEPS YOUR TRAIL',
  },
  // 9 — THE LOOKOUT
  {
    map: [
      'U..........',
      '##.#######.',
      '##.#######.',
      '##########.',
      '...........',
      '.#######.##',
      '.####.##.##',
      '.####.#####',
      '.........E.',
    ],
    routes: [[[2, 2], [2, 2]], [[8, 6], [8, 6]], [[5, 6], [5, 6]]],
    par: 44,
    limit: 115,
    brief: 'HE DOES NOT WALK. HE TURNS',
  },
  // 10 — FENCED IN
  {
    map: [
      '....E....',
      '.........',
      '===.#.===',
      '.........',
      '===.#.===',
      '.........',
      '===.#.===',
      '.........',
      '....U....',
    ],
    routes: [[[0, 1], [8, 1]], [[8, 3], [0, 3]], [[0, 5], [8, 5]]],
    par: 16,
    limit: 40,
    brief: 'STOPS YOUR FEET, NOT HIS EYES',
  },
  // 11 — SAME FLOOR, NEW WATCH
  {
    map: [
      '......E',
      '.......',
      '..#.#..',
      '.......',
      '..#c#..',
      '.......',
      '..#.#..',
      '.......',
      'U......',
    ],
    routes: [[[0, 3], [6, 3]], [[6, 5], [0, 5]], [[3, 7], [3, 1]]],
    par: 23,
    limit: 60,
    brief: 'SAME FLOOR. THREE WATCHES',
  },
  // 12 — EVERYTHING YOU KNOW
  {
    map: [
      'U..........',
      '###-#####.#',
      '...........',
      '######.####',
      '.,,,,,.....',
      '.#########.',
      '...........',
      '====.======',
      '...........',
      '......c...E',
    ],
    routes: [[[9, 2], [9, 2]], [[2, 6], [6, 6]], [[10, 4], [7, 4]]],
    par: 52,
    limit: 135,
    brief: 'EVERYTHING YOU KNOW',
  },
  // 13 — THE LONG WATCH
  {
    map: [
      '....E....',
      '.###.###.',
      '.........',
      '.###.###.',
      '.###.###.',
      '.........',
      '.###.###.',
      '.###.###.',
      '.........',
      '.###.###.',
      'U........',
    ],
    routes: [[[4, 2], [4, 8]], [[0, 1], [0, 9]], [[8, 9], [8, 1]]],
    par: 41,
    limit: 105,
    brief: 'NO TRICK LEFT. ONLY PATIENCE',
  },
];

export const TILE = 3;
export const WALL_H = 2.6;
export const SLAB = 0.7;
export const FENCE_H = 0.9;

// Live state of the loaded level. Everything below reads these, so swapping a level is a
// matter of reassigning them and rebuilding the placements.
export let MAP: string[] = LEVELS[0].map;
export let COLS = 0;
export let ROWS = 0;
export let spawn = { i: 0, j: 0 };
export let exit = { i: 0, j: 0 };
export let gems: { i: number; j: number; hue: number; taken: boolean }[] = [];
export let routes: [number, number][][] = [];
/** The hedge roofs over the tunnels, drawn last and see-through so the unicorn shows under them. */
export let roofs: Part[] = [];
export let par = 0;
export let limit = 0;
export let brief = '';

export const wx = (i: number) => (i - (COLS - 1) / 2) * TILE;
export const wz = (j: number) => (j - (ROWS - 1) / 2) * TILE;
export const ti = (x: number) => Math.round(x / TILE + (COLS - 1) / 2);
export const tj = (z: number) => Math.round(z / TILE + (ROWS - 1) / 2);

export const at = (i: number, j: number) =>
  i < 0 || j < 0 || i >= COLS || j >= ROWS ? ' ' : MAP[j][i] ?? ' ';

/** Nothing to stand on: off the platform, or a wall. */
export const isSolid = (i: number, j: number) => ' #='.includes(at(i, j));
/** Only walls stop a gaze — you can see straight across a gap in the platform. */
export const blocksSight = (i: number, j: number) => '#-'.includes(at(i, j));

/**
 * Solid under any corner of a square box centred on (x, z): the barrel of the animal. The
 * oriented part of the fit, nose and rump along the body's axis, is game.ts's nose/tail
 * push, where forward is (sin yaw, -cos yaw) on the floor.
 */
export function solidBox(x: number, z: number, half: number) {
  for (const a of [half, -half]) {
    for (const b of [half, -half]) {
      if (isSolid(ti(x + b), tj(z + a))) return true;
    }
  }
  return false;
}

export interface Part {
  mesh: Mesh;
  model: M4;
  rgb: [number, number, number];
}

let slab: Mesh, wall: Mesh, fence: Mesh, puffMesh: Mesh;

/** Read a level in: set the live state and lay out its placements. */
export function load(n: number): Part[] {
  const lv = LEVELS[n % LEVELS.length];
  MAP = lv.map;
  ROWS = MAP.length;
  COLS = Math.max(...MAP.map((r) => r.length));
  routes = lv.routes;
  par = lv.par;
  limit = lv.limit;
  brief = lv.brief;
  gems = [];
  roofs = [];

  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      const c = at(i, j);
      if (c === 'U') spawn = { i, j };
      if (c === 'E') exit = { i, j };
      if (c === 'c') gems.push({ i, j, hue: 0.13, taken: false });
    }
  }

  // The floor is a slab, not a sheet: its thickness is what makes the platform read as
  // floating rather than as a hole cut in a bigger ground.
  slab ??= mesh(prismSolid(TILE, TILE, TILE, TILE, SLAB));
  wall ??= mesh(prismSolid(TILE, TILE, TILE, TILE, WALL_H));
  fence ??= mesh(prismSolid(TILE, TILE, TILE, TILE, FENCE_H));
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
      if (c === '=') parts.push({ mesh: fence, model: place(mat(), x, 0, z, 0, 0), rgb: [0.97, 0.93, 1] });
      // The hedge: a floor like any other under a roof the hunters cannot see through.
      if (c === '-') roofs.push({ mesh: slab, model: place(mat(), x, WALL_H - SLAB, z, 0, 0), rgb: [0.5, 0.26, 0.66] });

      // Two tones only, and they alternate: enough to read the grid and judge a
      // distance, quiet enough that the grey of a watched tile is the loudest thing on
      // the floor. In this game colour carries information, so decorating with it is
      // the same as lying.
      // Special floors are told apart at a glance: a pale yellow slab with a note painted
      // on it (game.ts) for the flowers, white glitter on the green meadow, and a pale gold
      // slab for the exit, with the goal hovering over it.
      const warm = (i + j) % 2 === 0;
      const rgb: [number, number, number] =
        c === 'E' ? [1, 0.95, 0.72]
        : c === ',' ? [1, 0.93, 0.6]
        : c === '~' ? [0.7, 0.92, 0.7]
        : warm ? [1, 0.72, 0.87] : [0.97, 0.66, 0.85];
      parts.push({ mesh: slab, model: place(mat(), x, -SLAB, z, 0, 0), rgb });
      if (c === '~') {
        for (let k = 0; k < 4; k++) {
          parts.push({
            mesh: puffMesh,
            model: place(mat(), x + Math.cos(k * 1.7) * 0.8, 0.05, z + Math.sin(k * 1.7) * 0.8, 0, k, 0.15),
            rgb: [1, 1, 1],
          });
        }
      }
    }
  }


  return parts;
}
