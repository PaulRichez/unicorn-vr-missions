// Plays every mission with the game's own hunter code and reports the fastest clean run
// it can find, so that par and limit are measured rather than guessed. Run it with
// `node tools/solve.mjs [level]`; it prints one line per mission and a JSON summary.
//
// Two searches, because noise makes the hunters' future depend on the player's past:
//
//  1. EXACT — for a player who makes no noise. The hunters' rounds are then a fixed
//     timeline, so every (tile, frame) pair is a state and a breadth-first search over
//     them gives the true optimum, any route, any waits. Flower and meadow tiles are
//     forbidden here since stepping on them is a noise.
//
//  2. PLANS — the full simulation, noises included, over candidate routes with a scanned
//     wait at the start, a wait before the first noisy tile, and a fart at the start or
//     not. An upper bound on the optimum, but one that exercises squeaks and trails.

import { load, LEVELS, exit, spawn, at, wx, wz, ti, tj, isSolid, COLS, ROWS, TILE } from '../src/level';
import * as Hunter from '../src/hunter';

const DT = 1 / 60;
const PSPEED = 3.6; // camera.ts SPEED
const STEP = Math.round(TILE / PSPEED / DT); // frames to cross one tile: 50
const DIAG = Math.round(STEP * Math.SQRT2); // frames to cross a tile diagonally

const key = (i: number, j: number) => j * COLS + i;
const noisy = (i: number, j: number) => at(i, j) === ',' || at(i, j) === '~';

// ---------------------------------------------------------------------------- exact ---

function timeline(K: number): Uint8Array[] {
  Hunter.reset();
  const out: Uint8Array[] = [];
  for (let k = 0; k <= K; k++) {
    if (k) Hunter.step(DT);
    Hunter.look();
    out.push(Uint8Array.from(Hunter.seen, (b) => (b ? 1 : 0)));
  }
  return out;
}

/** Frames to the exit for a silent player, or -1. */
function exact(K: number): number {
  const seen = timeline(K);
  const n = COLS * ROWS;
  const buckets: Set<number>[] = Array.from({ length: K + 1 }, () => new Set());
  const visited = new Uint8Array((K + 1) * n);
  buckets[0].add(key(spawn.i, spawn.j));
  const ex = key(exit.i, exit.j);
  for (let k = 0; k <= K; k++) {
    for (const tile of buckets[k]) {
      if (visited[k * n + tile]) continue;
      visited[k * n + tile] = 1;
      const i = tile % COLS, j = (tile / COLS) | 0;
      if (k + 1 <= K && !seen[k + 1][tile]) buckets[k + 1].add(tile);
      // Eight ways, like the real player, who moves diagonally at full speed; a diagonal
      // needs both tiles it cuts between to be free, or the body square would catch.
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const ni = i + di, nj = j + dj;
        if (isSolid(ni, nj) || noisy(ni, nj)) continue;
        if (di && dj && (isSolid(i + di, j) || isSolid(i, j + dj))) continue;
        const nt = key(ni, nj);
        const len = di && dj ? DIAG : STEP;
        const last = nt === ex ? len / 2 : len;
        if (k + last > K) continue;
        let ok = true;
        for (let s = 1; s <= last && ok; s++) ok = !seen[k + s][s < len / 2 ? tile : nt];
        if (!ok) continue;
        if (nt === ex) return k + last;
        buckets[k + len].add(nt);
      }
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------- plans ---

type Act = ['go', number, number] | ['wait', number] | ['fart'];

/** The game loop's play phase, hunters and noises included, for one scripted player. */
function run(plan: Act[], K: number): { ok: boolean; t: number } {
  Hunter.reset();
  let px = wx(spawn.i), pz = wz(spawn.j);
  let lastI = -1, lastJ = -1;
  const marks: { i: number; j: number; age: number }[] = [];
  let a = 0, wait = 0;
  for (let k = 1; k <= K; k++) {
    if (wait > 0) wait -= DT;
    else if (a < plan.length) {
      const act = plan[a];
      if (act[0] === 'wait') { wait = act[1]; a++; }
      else if (act[0] === 'fart') { Hunter.hear(px, pz, Hunter.HEARING); a++; }
      else {
        const dx = wx(act[1]) - px, dz = wz(act[2]) - pz, d = Math.hypot(dx, dz);
        const s = Math.min(d, PSPEED * DT);
        if (d > 1e-9) { px += (dx / d) * s; pz += (dz / d) * s; }
        if (d <= PSPEED * DT) a++; // arrived this frame: no frame lost turning the corner
      }
    }
    const pi = ti(px), pj = tj(pz);
    if (pi !== lastI || pj !== lastJ) {
      lastI = pi; lastJ = pj;
      const c = at(pi, pj);
      if (c === ',') Hunter.hear(px, pz, 4);
      if (c === '~') { marks.push({ i: pi, j: pj, age: 0 }); if (marks.length > 10) marks.shift(); }
    }
    for (const m of marks) m.age += DT;
    while (marks.length && marks[0].age > 6) marks.shift();
    Hunter.step(DT);
    Hunter.look();
    Hunter.track(marks);
    if (Hunter.sees(pi, pj)) return { ok: false, t: k * DT };
    if (pi === exit.i && pj === exit.j) return { ok: true, t: k * DT };
  }
  return { ok: false, t: K * DT };
}

/**
 * Candidate routes: simple paths from U to E, never straying far from the shortest way.
 * With `quiet` the flower and meadow tiles count as walls, so the long way round a noisy
 * shortcut is sampled too — it is often the only way that works.
 */
function routes(maxExtra: number, cap: number, quiet = false): [number, number][][] {
  const solid = (i: number, j: number) => isSolid(i, j) || (quiet && noisy(i, j));
  const dist = new Int32Array(COLS * ROWS).fill(-1);
  const q: [number, number][] = [[exit.i, exit.j]];
  dist[key(exit.i, exit.j)] = 0;
  while (q.length) {
    const [i, j] = q.shift()!;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj;
      if (solid(ni, nj) || dist[key(ni, nj)] >= 0) continue;
      dist[key(ni, nj)] = dist[key(i, j)] + 1;
      q.push([ni, nj]);
    }
  }
  const shortest = dist[key(spawn.i, spawn.j)];
  if (shortest < 0) return [];
  const out: [number, number][][] = [];
  const path: [number, number][] = [[spawn.i, spawn.j]];
  const on = new Uint8Array(COLS * ROWS);
  on[key(spawn.i, spawn.j)] = 1;
  const dfs = (i: number, j: number) => {
    if (out.length >= cap) return;
    if (i === exit.i && j === exit.j) { out.push(path.slice()); return; }
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj;
      const k = key(ni, nj);
      if (solid(ni, nj) || on[k]) continue;
      if (path.length + dist[k] > shortest + maxExtra) continue;
      on[k] = 1; path.push([ni, nj]);
      dfs(ni, nj);
      path.pop(); on[k] = 0;
    }
  };
  dfs(spawn.i, spawn.j);
  return out;
}

/**
 * One wait of any length at any tile of the route, and a fart either not at all, at the
 * start, or where the wait is. Crude next to the exact search, but it plays the noises.
 */
function plans(K: number) {
  let best = { t: Infinity, plan: [] as Act[] };
  let clean = 0, total = 0;
  /** The most forgiving plan family: of the waits tried on one route/spot/fart, how many work. */
  let tol = 0;
  /** The same, counting only the families that never fart — the lure resets every round, so
   *  a fart-first family is forgiving by nature; this says how the map plays without it. */
  let tol0 = 0;
  const WAITS = QUICK ? 1 : 0.5;
  // Every route within four tiles of the shortest, then a spread of at most sixty of
  // them: the shortest two dozen and an even sample of the rest, so no side of a map
  // is skipped just because the search happened to turn right first.
  const seenRoute = new Set<string>();
  const all = [...routes(4, 3000), ...routes(4, 3000, true)]
    .filter((r) => { const k = JSON.stringify(r); return !seenRoute.has(k) && seenRoute.add(k); })
    .sort((a, b) => a.length - b.length);
  const CAP = QUICK ? 12 : 60, HEAD = QUICK ? 5 : 24;
  const paths = all.length <= CAP ? all : [...all.slice(0, HEAD), ...Array.from({ length: CAP - HEAD }, (_, k) => all[HEAD + Math.floor((k * (all.length - HEAD)) / (CAP - HEAD))])];
  for (const p of paths) {
    const goes: Act[] = p.slice(1).map(([i, j]) => ['go', i, j]);
    // Waits only where they can matter: at the start, at a corner, before a noisy tile.
    const spots = new Set([0]);
    for (let k = 1; k < p.length; k++) {
      if (noisy(p[k][0], p[k][1])) spots.add(k - 1);
      if (k + 1 < p.length && (p[k + 1][0] - p[k][0] !== p[k][0] - p[k - 1][0] || p[k + 1][1] - p[k][1] !== p[k][1] - p[k - 1][1])) spots.add(k);
    }
    for (const pos of spots) {
      for (const fart of [0, 1, 2]) {
        let ok = 0, tried = 0;
        for (let w = 0; w <= 20; w += WAITS) {
          if (!w && pos) continue; // a zero wait is the same plan whatever its position
          tried++;
          total++;
          const plan: Act[] = [];
          if (fart === 1) plan.push(['fart']);
          goes.forEach((g, k) => {
            if (k === pos) {
              if (fart === 2) plan.push(['fart']);
              if (w) plan.push(['wait', w]);
            }
            plan.push(g);
          });
          const r = run(plan, K);
          if (!r.ok) continue;
          clean++;
          ok++;
          if (r.t < best.t) best = { t: r.t, plan };
        }
        tol = Math.max(tol, ok / tried);
        if (!fart) tol0 = Math.max(tol0, ok / tried);
      }
    }
  }
  return { ...best, clean, total, tol, tol0, paths: paths.length };
}

// ------------------------------------------------------------------------------- main ---

const QUICK = process.argv.includes('--quick'); // fewer routes, coarser waits: ~10 s a mission
const only = Number(process.argv.find((a) => /^\d+$/.test(a))) || 0;
const summary: unknown[] = [];
for (let n = 0; n < LEVELS.length; n++) {
  if (only && only !== n + 1) continue;
  load(n);
  const lv = LEVELS[n];
  const K = lv.limit * 60;
  const t0 = Date.now();
  const ex = exact(K);
  const t1 = Date.now();
  const pl = plans(K);
  const t2 = Date.now();
  const opt = Math.min(ex < 0 ? Infinity : ex / 60, pl.t);
  // Par at 1.35 x the optimum leaves room for human hands; the limit at 3.5 x it, never
  // under 30 s, leaves room for one full round of watching before committing.
  const rec = { level: n + 1, exact: ex < 0 ? null : +(ex / 60).toFixed(2), plans: pl.t === Infinity ? null : +pl.t.toFixed(2), clean: pl.clean, total: pl.total, ratio: +(pl.clean / pl.total).toFixed(3), tolerance: +pl.tol.toFixed(2), silentTolerance: +pl.tol0.toFixed(2), routes: pl.paths, plan: pl.plan.map((a) => a.join(',')).join(' '), par: lv.par, limit: lv.limit, suggestPar: opt === Infinity ? null : Math.ceil(opt * 1.35), suggestLimit: opt === Infinity ? null : Math.max(30, Math.ceil((opt * 3.5) / 5) * 5) };
  summary.push(rec);
  console.log(`L${String(n + 1).padStart(2, '0')}  exact ${rec.exact ?? '   -'}  plans ${rec.plans ?? '   -'}  clean ${pl.clean}/${pl.total} = ${(rec.ratio * 100).toFixed(1)} %  tolerance ${(pl.tol * 100).toFixed(0)} % (silent ${(pl.tol0 * 100).toFixed(0)} %)  (${pl.paths} routes)  par ${lv.par} -> ${rec.suggestPar}  limit ${lv.limit} -> ${rec.suggestLimit}  [${t1 - t0} + ${t2 - t1} ms]`);
  if (pl.plan.length) console.log('     ' + rec.plan);
}
console.log(JSON.stringify(summary));
