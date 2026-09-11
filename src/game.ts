// ─────────────────────────────────────────────────────────────────────────────
//  NIVEAU 1 — one map, one hunter, one idea: he walks a fixed round, and where he
//  looks the colour drains out of the floor. Fold into a cloud to vanish, but a
//  cloud cannot walk. Reach the green tile.
//
//  A first playable level, not a balanced one.
// ─────────────────────────────────────────────────────────────────────────────

import { W, H, DPR } from './engine/view';
import { gl, mesh, frame, draw as drawMesh, setBands, setDark, setBlend, setSky } from './engine/gl';
import { mat, perspective, view, multiply, place, partAt } from './engine/mat';
import { cam, player, update as moveRig, follow } from './engine/camera';
import { sfx, toggleMute } from './engine/audio';
import { pressed } from './engine/input';
import { puff, dome, panel, ring, mark } from './mesh';
import { buildParts, PALETTE, SCALE, LEGS, HOOVES, HORN } from './unicorn';
import * as Hunter from './hunter';
import { load, LEVELS, gems, spawn, exit, wx, wz, ti, tj, solidBox, isSolid, COLS, ROWS, TILE } from './level';

// Wide enough that the hunter's full sight range (5 tiles) fits on screen around the
// player: about 14 x 9 tiles. Being spotted from off-screen is the one thing a stealth
// game may never do.
const FOV = 0.85;

// Half-extents taken from the model rather than guessed: the muzzle ends 1.28 m ahead of
// the origin and the tail 1.26 m behind it, on a body 0.84 m across. A shorter box lets
// the nose through a wall before anything stops it.
const BODY_LONG = 1.26;
const BODY_WIDE = 0.42;

/** The last pose known to be clear of every wall — the fallback when a frame goes wrong. */
const safe = { x: 0, z: 0, yaw: 0 };

const LIMB_PIVOT_Y = 12.75;

const proj = mat();
const cameraView = mat();
const vp = mat();
const bodyM = mat();
const partM = mat();
const worldM = mat();
const tmpM = mat();

let level = 0;
let scenery = load(level);
const overlay = mesh(panel(TILE, TILE));
const dot = mesh(panel(0.5, 0.5));
const cloudMesh = mesh(puff(1.1));
const gasMesh = mesh(puff(0.36));
const ringMesh = mesh(ring(0.93, 1));
const bang = mesh(mark(false));
const huh = mesh(mark(true));
const gemMesh = mesh(puff(0.3));
const skyMesh = mesh(dome(70));

// The sky: a care-bear sky, on purpose. The platform hangs in it, and the whole thing
// drains along with everything else when the hunter has taken enough.
const skyPuffs = Array.from({ length: 9 }, (_, k) => {
  const a = (k / 9) * Math.PI * 2 + 0.7;
  const r = 26 + (k % 3) * 9;
  return place(mat(), Math.cos(a) * r, 5 + (k % 4) * 4.5, Math.sin(a) * r, 0, -a, 2.6);
});

const uParts = buildParts();
const uMesh = uParts.map((p) => mesh(p.geo));
const hMesh = Hunter.parts.map((p) => mesh(p.geo));

let bands = 0;
let grey = 0;
/** Seconds until the next fart is allowed: one trick, not a machine gun. */
let gasCool = 0;
/** Puffs of rainbow gas in the air: where, how old. */
const gas: { x: number; z: number; age: number; hue: number }[] = [];
/** Age of the last noise ring, or -1 when there is none to draw. */
let ringAge = -1;
let ringX = 0;
let ringZ = 0;
/** Seconds of the "!" freeze left after being seen, before the reset lands. */
let caughtT = 0;
let t = 0;
let stride = 0;
let gait = 0;
let done = false;
/** Seconds left on the exit before the next level loads: a beat, not a cut. */
let doneT = 0;
/** K shows the collision box and the tiles it tests. Debug only — nothing ships with it. */
let debug = false;

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

function reset(caught: boolean) {
  player.x = safe.x = wx(spawn.i);
  player.z = safe.z = wz(spawn.j);
  player.yaw = safe.yaw = 0;
  gas.length = 0;
  ringAge = -1;
  // The hunter restarts his round too, so every attempt at a level plays out the same
  // way — a patrol you can learn is the whole point of a patrol.
  Hunter.reset();
  if (caught) {
    bands = 0;
    for (const g of gems) g.taken = false;
    grey = Math.min(0.7, grey + 0.12);
    sfx([1.1, , 90, 0.1, 0.4, 0.8, 4, 0.5, -3, , , , , 1.5, , 0.4, 0.2]);
  }
  follow(0, true); // no glide back to the start: cut straight there
}
reset(false);

/** Exit reached: read the next level in and start it. The list wraps for now. */
function nextLevel() {
  level = (level + 1) % LEVELS.length;
  scenery = load(level);
  done = false;
  reset(false);
}

export function resize() {
  gl.viewport(0, 0, (W * DPR) | 0, (H * DPR) | 0);
  perspective(proj, FOV, W / H, 0.1, 200);
}

export function update(dt: number) {
  t += dt;
  if (pressed.has('KeyM') || pressed.has('Semicolon')) toggleMute();
  if (pressed.has('KeyK')) debug = !debug;

  // Seen: everything holds for a beat under the "!" so the player sees what happened,
  // then the reset lands. Nothing else moves during it.
  if (caughtT > 0) {
    if ((caughtT -= dt) <= 0) reset(true);
    return;
  }

  // Space: the unicorn farts. Snake knocked on walls; this is the same trick, and the
  // noise carries through walls the way sound does. The hunter comes to look.
  gasCool -= dt;
  if (pressed.has('Space') && gasCool <= 0 && !done) {
    gasCool = 1.1;
    const fx = Math.sin(player.yaw), fz = -Math.cos(player.yaw);
    gas.push({ x: player.x - fx * 1.3, z: player.z - fz * 1.3, age: 0, hue: Math.random() });
    ringAge = 0;
    ringX = player.x;
    ringZ = player.z;
    sfx([1.2, 0.3, 70, 0.02, 0.12, 0.28, 4, 1.4, -9, , , , , 0.9, , 0.1, 0.05]);
    if (Hunter.hear(player.x, player.z)) sfx([0.6, , 640, 0.02, 0.05, 0.12, 1, 1.2, , , 260, 0.05], );
  }
  for (const g of gas) g.age += dt;
  while (gas.length && gas[0].age > 1.1) gas.shift();
  if (ringAge >= 0 && (ringAge += dt) > 0.7) ringAge = -1;

  const wasX = player.x;
  const wasZ = player.z;
  const wasYaw = player.yaw;
  moveRig(dt);

  // Turning is a move too. Left untested, a long body pivoting in a corner can swing
  // itself across two walls at once, and from there every push is refused because the
  // box already overlaps — stuck for good.
  if (solidBox(wasX, wasZ, player.yaw, BODY_LONG, BODY_WIDE)) player.yaw = wasYaw;

  // Slide along edges: resolve each axis on its own so a corner does not stop you dead.
  // There is no outer wall — what stops you is the platform simply ending.
  if (solidBox(player.x, wasZ, player.yaw, BODY_LONG, BODY_WIDE)) player.x = wasX;
  if (solidBox(player.x, player.z, player.yaw, BODY_LONG, BODY_WIDE)) player.z = wasZ;

  // Last resort. Whatever the geometry does, the pose ends the frame outside the walls.
  if (solidBox(player.x, player.z, player.yaw, BODY_LONG, BODY_WIDE)) {
    player.x = safe.x;
    player.z = safe.z;
    player.yaw = safe.yaw;
  } else {
    safe.x = player.x;
    safe.z = player.z;
    safe.yaw = player.yaw;
  }

  stride += player.speed * dt * 3.1;
  gait += ((player.speed > 0 ? 1 : 0) - gait) * Math.min(1, dt * 9);

  follow(dt);
  Hunter.step(dt);
  Hunter.look();

  const pi = ti(player.x);
  const pj = tj(player.z);

  if (!done && Hunter.sees(pi, pj)) {
    // The "!" — and the sting that every Metal Gear player hears in their sleep.
    caughtT = 0.9;
    Hunter.hunter.mark = 2;
    Hunter.hunter.markT = 0.9;
    sfx([1.4, , 1100, , 0.06, 0.16, 1, 2.2, , , 400, 0.04, , , , , , 0.6, 0.02]);
    return;
  }

  for (const g of gems) {
    if (g.taken) continue;
    if (Math.hypot(player.x - wx(g.i), player.z - wz(g.j)) < 1.2) {
      g.taken = true;
      bands++;
      sfx([, , 380 + bands * 80, , 0.03, 0.16, 1, 1.6, , , 220, 0.04, , , , , 0.04]);
    }
  }

  if (!done && pi === exit.i && pj === exit.j) {
    done = true;
    doneT = 0.9;
    sfx([, , 520, 0.02, 0.2, 0.5, 1, 1.5, , , 300, 0.06, 0.1]);
  }
  if (done && (doneT -= dt) <= 0) nextLevel();
}

export function draw() {
  view(cameraView, cam.x, cam.y, cam.z, cam.yaw, cam.pitch);
  multiply(vp, proj, cameraView);

  const bg = drain(0.42, 0.2, 0.5, grey);
  frame(vp, cam.x, cam.y, cam.z, bg[0], bg[1], bg[2]);
  // No moving pool of grey any more: the hunter's cone does that job, tile by tile.
  setDark(999, 999, 1, grey, cam.x, cam.z);

  // Sky first, from a dome that follows the camera so it can never be reached.
  setSky(true, 1, 0.72, 0.88);
  place(tmpM, cam.x, 0, cam.z, 0, 0);
  drawMesh(skyMesh, tmpM, 0.42, 0.2, 0.52);
  setSky(false);

  for (const m of skyPuffs) drawMesh(cloudMesh, m, 1, 0.97, 1);

  for (const p of scenery) drawMesh(p.mesh, p.model, p.rgb[0], p.rgb[1], p.rgb[2]);

  for (const g of gems) {
    if (g.taken) continue;
    const [r, gg, b] = hsv(g.hue, 0.95, 1);
    place(tmpM, wx(g.i), 0.55 + Math.sin(t * 2.2) * 0.12, wz(g.j), 0, t);
    drawMesh(gemMesh, tmpM, r, gg, b);
  }

  // What he can see, drawn flat on the floor with a hard edge at every tile border.
  setBlend(true);
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      if (!Hunter.sees(i, j)) continue;
      place(tmpM, wx(i), 0.04, wz(j), -Math.PI / 2, 0);
      drawMesh(overlay, tmpM, 0.08, 0.07, 0.1, 0, 0.55);
    }
  }
  // Debug: the four corners the collision actually tests, and the tile each one lands
  // in — green where the map says floor, red where it says solid. If a corner sits on
  // pink floor and reads red, the map and the drawing disagree; if the box floats away
  // from the animal, the pose is wrong. Either way it is visible instead of guessed.
  if (debug) {
    const fx = Math.sin(player.yaw), fz = -Math.cos(player.yaw);
    const rx = Math.cos(player.yaw), rz = Math.sin(player.yaw);
    for (const a of [BODY_LONG, -BODY_LONG]) {
      for (const b of [BODY_WIDE, -BODY_WIDE]) {
        const px = player.x + fx * a + rx * b;
        const pz = player.z + fz * a + rz * b;
        const i = ti(px);
        const j = tj(pz);
        const bad = isSolid(i, j);
        place(tmpM, wx(i), 0.09, wz(j), -Math.PI / 2, 0);
        drawMesh(overlay, tmpM, bad ? 1 : 0.2, bad ? 0.2 : 1, 0.3, 0, 0.4);
        place(tmpM, px, 0.14, pz, -Math.PI / 2, 0);
        drawMesh(dot, tmpM, 1, 1, 0.1, 0, 0.95);
      }
    }
  }
  setBlend(false);

  // The unicorn.
  place(bodyM, player.x, 0, player.z, 0, Math.PI / 2 - player.yaw, SCALE);
  {
    uParts.forEach((p, i) => {
      const leg = LEGS.indexOf(i);
      const hoof = HOOVES.indexOf(i);
      const limb = leg < 0 ? hoof : leg;
      let { x, y, z, rz } = p;
      if (limb >= 0) {
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
      const [r, g, b] = PALETTE[p.color];
      if (i === HORN) setBands(Math.max(bands, 0.001), 8.5);
      drawMesh(uMesh[i], worldM, r, g, b, i === HORN && bands > 0 ? 1 : 0);
    });
  }

  // Rainbow gas, rising and thinning; the noise ring on the floor, spreading to the
  // reach of the hunter's hearing so the player learns how far a noise carries.
  setBlend(true);
  for (const g of gas) {
    const k = g.age / 1.1;
    const [r, gg, b] = hsv(g.hue, 0.9, 1);
    place(tmpM, g.x, 0.7 + k * 1.4, g.z, 0, g.age * 2, 0.8 + k * 1.2);
    drawMesh(gasMesh, tmpM, r, gg, b, 0, 0.85 * (1 - k));
  }
  if (ringAge >= 0) {
    const k = ringAge / 0.7;
    place(tmpM, ringX, 0.06, ringZ, -Math.PI / 2, 0, 0.4 + k * Hunter.HEARING * TILE);
    drawMesh(ringMesh, tmpM, 1, 1, 1, 0, 0.7 * (1 - k));
  }
  setBlend(false);

  // The hunter, walking his round.
  place(bodyM, Hunter.hunter.x, 0, Hunter.hunter.z, 0, Math.PI / 2 - Hunter.hunter.yaw, Hunter.SCALE);
  Hunter.parts.forEach((p, i) => {
    const swing = i < 4 ? Math.sin(Hunter.hunter.leg + (i % 2) * Math.PI) * 0.4 : 0;
    partAt(partM, p.x, p.y, p.z, p.rz + swing, p.rx);
    multiply(worldM, bodyM, partM);
    const [r, g, b] = Hunter.PALETTE[p.color];
    drawMesh(hMesh[i], worldM, r, g, b);
  });

  // "!" or "?" over his head, tilted to face the camera, with a small bounce.
  if (Hunter.hunter.mark) {
    const bounce = Math.abs(Math.sin(t * 9)) * 0.12;
    place(tmpM, Hunter.hunter.x, 2.55 + bounce, Hunter.hunter.z, cam.pitch, 0, 1.7);
    if (Hunter.hunter.mark === 2) drawMesh(bang, tmpM, 1, 0.12, 0.1);
    else drawMesh(huh, tmpM, 1, 0.85, 0.2);
  }
}
