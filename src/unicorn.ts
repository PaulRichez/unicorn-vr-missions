// The unicorn, ported from the 25-primitive table. Every part is one of four shapes
// with a position, two rotations and a palette index — 11 bytes each, 277 for the whole
// animal. The table is the model; nothing here depends on any particular renderer.
//
// Geometry is baked at its real size so the per-part matrix only rotates and moves it.
// Cones are grown from their base rather than centred, so the horn's banding can be
// driven by distance along the shape.

import { tri, quad } from './mesh';

type V3 = [number, number, number];

/** Centred box. */
function boxG(w: number, h: number, d: number): number[] {
  const out: number[] = [];
  const x = w / 2, y = h / 2, z = d / 2;
  const c: V3[] = [
    [-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z],
    [-x, y, -z], [x, y, -z], [x, y, z], [-x, y, z],
  ];
  quad(out, c[7], c[6], c[5], c[4]);
  quad(out, c[0], c[1], c[2], c[3]);
  quad(out, c[1], c[0], c[4], c[5]);
  quad(out, c[3], c[2], c[6], c[7]);
  quad(out, c[0], c[3], c[7], c[4]);
  quad(out, c[2], c[1], c[5], c[6]);
  return out;
}

/** Sphere of radius r, then squashed on Y and Z — the body masses are all ellipsoids. */
function sphereG(r: number, sy: number, sz: number, rings = 8, sides = 10): number[] {
  const out: number[] = [];
  const at = (i: number, j: number): V3 => {
    const th = (i / rings) * Math.PI, ph = (j / sides) * Math.PI * 2;
    return [r * Math.sin(th) * Math.cos(ph), r * Math.cos(th) * sy, r * Math.sin(th) * Math.sin(ph) * sz];
  };
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < sides; j++) quad(out, at(i, j), at(i, j + 1), at(i + 1, j + 1), at(i + 1, j));
  }
  return out;
}

/** Centred cylinder, top and bottom radii independent — legs and hooves. */
function cylG(rTop: number, rBot: number, h: number, sides = 10): number[] {
  const out: number[] = [];
  const ring = (r: number, y: number, j: number): V3 => {
    const a = (j / sides) * Math.PI * 2;
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  };
  for (let j = 0; j < sides; j++) {
    quad(out, ring(rBot, -h / 2, j), ring(rTop, h / 2, j), ring(rTop, h / 2, j + 1), ring(rBot, -h / 2, j + 1));
    tri(out, [0, h / 2, 0], ring(rTop, h / 2, j + 1), ring(rTop, h / 2, j));
    tri(out, [0, -h / 2, 0], ring(rBot, -h / 2, j), ring(rBot, -h / 2, j + 1));
  }
  return out;
}

/** Cone grown from its base at y = 0 — horn and ears. */
function coneG(r: number, h: number, sides: number): number[] {
  const out: number[] = [];
  const ring = (j: number): V3 => {
    const a = (j / sides) * Math.PI * 2;
    return [Math.cos(a) * r, 0, Math.sin(a) * r];
  };
  for (let j = 0; j < sides; j++) {
    tri(out, ring(j), [0, h, 0], ring(j + 1));
    tri(out, ring(j + 1), [0, 0, 0], ring(j));
  }
  return out;
}

export interface Part {
  geo: Float32Array;
  x: number; y: number; z: number;
  rz: number; rx: number;
  color: number;
}

//            t   x   y   z  s1  s2  s3  rz  rx col fl
const TABLE = [
  [1, 0, 13, 0, 100, 80, 74, 0, 0, 0, 0], // torso
  [1, 7, 15, 0, 72, 92, 86, 0, 0, 0, 0], // chest
  [1, -8, 13, 0, 80, 88, 82, 0, 0, 0, 0], // croup
  [2, 10, 20, 0, 34, 56, 125, -35, 0, 0, 0], // neck
  [0, 16, 26, 0, 82, 56, 58, -12, 0, 0, 0], // head
  [0, 21, 24, 0, 46, 42, 44, -12, 0, 4, 0], // muzzle
  [1, 17, 27, 3, 8, 75, 55, 0, 0, 6, 0], // eye R
  [1, 17, 27, -3, 8, 75, 55, 0, 0, 6, 0], // eye L
  [3, 15, 30, 0, 14, 85, 0, -20, 0, 1, 1], // horn
  [3, 13, 29, 3, 10, 30, 0, 15, 8, 0, 0], // ear R
  [3, 13, 29, -3, 10, 30, 0, 15, -8, 0, 0], // ear L
  [2, 7, 7, 4, 20, 17, 115, 2, 0, 0, 0], // front R
  [2, 7, 7, -4, 20, 17, 115, 2, 0, 0, 0], // front L
  [2, -8, 7, 4, 21, 17, 115, -3, 0, 0, 0], // rear R
  [2, -8, 7, -4, 21, 17, 115, -3, 0, 0, 0], // rear L
  [2, 7, 1, 4, 21, 23, 24, 0, 0, 3, 0], // hooves
  [2, 7, 1, -4, 21, 23, 24, 0, 0, 3, 0],
  [2, -8, 1, 4, 21, 23, 24, 0, 0, 3, 0],
  [2, -8, 1, -4, 21, 23, 24, 0, 0, 3, 0],
  [1, 11, 25, 0, 30, 85, 55, -35, 0, 2, 0], // mane high
  [1, 8, 21, 0, 28, 90, 52, -35, 0, 5, 0], // mane low
  [1, 13, 29, 0, 24, 70, 55, -15, 0, 5, 0], // forelock
  [1, -16, 15, 0, 34, 80, 66, 35, 0, 2, 0], // tail
  [1, -19, 11, 0, 27, 80, 64, 48, 0, 5, 0],
  [1, -21, 7, 0, 21, 80, 62, 60, 0, 2, 0],
];

/** Legs, in table order, so the walk cycle can swing them in diagonal pairs. */
export const LEGS = [11, 12, 13, 14];
export const HOOVES = [15, 16, 17, 18];
export const HORN = 8;

/** Palette slots: body, horn, mane A, hoof, muzzle, mane B, eye. */
export const PALETTE: V3[] = [
  [0.957, 0.929, 0.871], // ivory body
  [0.949, 0.714, 0.235], // gold horn
  [1.0, 0.498, 0.682], // pink mane
  [0.216, 0.196, 0.243], // dark hoof
  [0.933, 0.765, 0.804], // muzzle
  [0.886, 0.337, 0.561], // deeper mane
  [0.149, 0.133, 0.188], // eye
];

const D2R = Math.PI / 180;

/** Turn any 11-number table into drawable parts — the unicorn, the hunter, anything. */
export function buildFrom(table: number[][]): Part[] {
  return table.map((p) => {
    const [type, x, y, z, s1, s2, s3, rz, rx, color, flags] = p;
    let geo: number[];
    let yOff = 0;
    if (type === 0) geo = boxG(s1 / 10, s2 / 10, s3 / 10);
    else if (type === 1) geo = sphereG(s1 / 10, s2 / 100, s3 / 100);
    else if (type === 2) geo = cylG(s1 / 10, s2 / 10, s3 / 10);
    else {
      geo = coneG(s1 / 10, s2 / 10, flags & 1 ? 5 : 9);
      yOff = -s2 / 20; // grown from its base, so drop it half a height to stay put
    }
    return { geo: new Float32Array(geo), x, y: y + yOff, z, rz: rz * D2R, rx: rx * D2R, color };
  });
}

export const PARTS = buildFrom(TABLE);

/** Model units are roughly a hand tall; this brings the animal to about 1.9 metres. */
export const SCALE = 0.055;
