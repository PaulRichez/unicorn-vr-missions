// Procedural geometry. Nothing is stored: every vertex is computed from a handful of
// numbers at startup, which is why 3D costs almost nothing in bytes here.
//
// Winding matters — back faces are culled, so a quad wound the wrong way is invisible
// rather than merely wrong. Every face below is ordered so its normal points at the
// viewer: outward for the horn, inward for the room.

type V3 = [number, number, number];

/** Push one triangle with its face normal repeated per vertex — that is the flat look. */
function tri(out: number[], a: V3, b: V3, c: V3) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  nx /= l; ny /= l; nz /= l;
  for (const p of [a, b, c]) out.push(p[0], p[1], p[2], nx, ny, nz);
}

const quad = (out: number[], a: V3, b: V3, c: V3, d: V3) => {
  tri(out, a, b, c);
  tri(out, a, c, d);
};

/**
 * The horn: a tapered cone whose radius is modulated by a sine of the angle, the phase
 * drifting along the length. That drift is the whole trick — it turns straight ridges
 * into a spiral. Grows along +Y from the origin.
 */
export function horn(length = 0.62, radius = 0.036, lobes = 4, twist = 11, flute = 0.22): Float32Array {
  const RINGS = 26;
  // Sides scale with the number of ridges: a sine sampled four times per period reads as
  // a lumpy bulge, not an edge. Ten samples per ridge is where it starts looking carved.
  const SIDES = Math.max(24, lobes * 10);
  const out: number[] = [];

  const at = (i: number, j: number): V3 => {
    const u = i / RINGS;
    const a = (j / SIDES) * Math.PI * 2;
    const r = radius * (1 - u) * (1 + flute * Math.sin(lobes * a + twist * u));
    return [r * Math.cos(a), u * length, r * Math.sin(a)];
  };

  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j < SIDES; j++) {
      quad(out, at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1));
    }
  }

  // Cap the base. Without it the horn is an open tube whose mouth faces backwards —
  // straight at the eye — and the camera looks down the inside of it. The tip needs no
  // cap: the radius reaches zero there, so the surface already closes on a point.
  const centre: V3 = [0, 0, 0];
  for (let j = 0; j < SIDES; j++) tri(out, centre, at(0, j), at(0, j + 1));

  return new Float32Array(out);
}

// --- assembled shapes -------------------------------------------------------
// Parts are emitted straight into a shared buffer through a transform, so normals fall
// out of the triangle winding and never need transforming separately.

/** Position, then pitch about X and yaw about Y, applied to a part's local space. */
type Xf = [x: number, y: number, z: number, pitch: number, yaw: number];

function put(t: Xf, x: number, y: number, z: number): V3 {
  const sa = Math.sin(t[3]), ca = Math.cos(t[3]);
  const sb = Math.sin(t[4]), cb = Math.cos(t[4]);
  const y1 = y * ca - z * sa;
  const z1 = y * sa + z * ca;
  return [x * cb + z1 * sb + t[0], y1 + t[1], -x * sb + z1 * cb + t[2]];
}

/** A box extruded along +Y whose cross-section shrinks: neck, skull, muzzle. */
function prism(out: number[], t: Xf, w0: number, d0: number, w1: number, d1: number, h: number) {
  const p = (x: number, y: number, z: number) => put(t, x, y, z);
  const a = [p(-w0 / 2, 0, -d0 / 2), p(w0 / 2, 0, -d0 / 2), p(w0 / 2, 0, d0 / 2), p(-w0 / 2, 0, d0 / 2)];
  const b = [p(-w1 / 2, h, -d1 / 2), p(w1 / 2, h, -d1 / 2), p(w1 / 2, h, d1 / 2), p(-w1 / 2, h, d1 / 2)];
  quad(out, b[3], b[2], b[1], b[0]);                 // top,    normal +Y
  quad(out, a[0], a[1], a[2], a[3]);                 // bottom, normal -Y
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad(out, a[j], a[i], b[i], b[j]);               // sides,  normals outward
  }
}

/** A plain cone along +Y — ears, and anything else that tapers to a point. */
function cone(out: number[], t: Xf, len: number, rad: number, sides = 18) {
  const ring = (j: number) => {
    const ang = (j / sides) * Math.PI * 2;
    return put(t, rad * Math.cos(ang), 0, rad * Math.sin(ang));
  };
  const tip = put(t, 0, len, 0);
  const base = put(t, 0, 0, 0);
  for (let j = 0; j < sides; j++) {
    tri(out, ring(j), tip, ring(j + 1));
    tri(out, ring(j + 1), base, ring(j));
  }
}

/** Where the horn sits in the unicorn's own space, so both framings agree on it. */
export const HORN_ON_HEAD: Xf = [0, 0.62, -0.28, -0.95, 0];

/**
 * The crest of the mane: a thin sheet standing along the top of the neck. From behind
 * this is what makes the shape read as a horse rather than a tapered box, and it costs
 * a dozen triangles. Sheets have no inside, so each quad is emitted both ways round —
 * back-face culling would otherwise make half of it vanish depending on the angle.
 */
function mane(out: number[], steps = 7) {
  const ridge = (t: number): V3 => [0, 0.08 + t * 0.52, 0.12 - t * 0.2];
  const crest = (t: number): V3 => {
    const r = ridge(t);
    const height = 0.06 + 0.05 * Math.sin(t * Math.PI); // fuller in the middle
    return [0, r[1] + height, r[2] + height * 0.8];
  };
  for (let i = 0; i < steps; i++) {
    const a = i / steps, b = (i + 1) / steps;
    quad(out, ridge(a), ridge(b), crest(b), crest(a));
    quad(out, crest(a), crest(b), ridge(b), ridge(a));
  }
}

/**
 * A unicorn seen from behind: neck, skull tapering to a muzzle, ears, mane, and the
 * horn's mounting point. Deliberately a suggestion rather than an animal — from this
 * angle the eyes, nostrils and mouth are never in frame, which is exactly why this
 * framing is affordable: we are not modelling a unicorn, only the back of its neck.
 */
export function unicorn(): Float32Array {
  const out: number[] = [];
  prism(out, [0, 0, 0.1, -0.3, 0], 0.3, 0.32, 0.19, 0.21, 0.55); // neck
  prism(out, [0, 0.52, -0.12, -1.15, 0], 0.19, 0.21, 0.11, 0.13, 0.4); // skull to muzzle
  cone(out, [0.07, 0.6, -0.07, -0.3, 0.3], 0.14, 0.04); // left ear
  cone(out, [-0.07, 0.6, -0.07, -0.3, -0.3], 0.14, 0.04); // right ear
  mane(out);
  return new Float32Array(out);
}

/**
 * A cloud: a sphere whose radius is bent by two slow sine waves, so it comes out lumpy
 * rather than round. Flat-shaded, the facets read as a stylised cloud — the only kind a
 * polygon renderer can afford. `squash` flattens it into a bank rather than a puff.
 */
export function cloudInto(
  out: number[], t: Xf, radius: number, seed: number, squash = 1, bump = 0.22, rings = 7, sides = 12,
) {
  const at = (i: number, j: number): V3 => {
    const th = (i / rings) * Math.PI;
    const ph = (j / sides) * Math.PI * 2;
    const r = radius * (1 + bump * Math.sin(3 * ph + seed) * Math.sin(2 * th + seed * 1.7));
    return put(t, r * Math.sin(th) * Math.cos(ph), r * Math.cos(th) * squash, r * Math.sin(th) * Math.sin(ph));
  };
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < sides; j++) {
      quad(out, at(i, j), at(i, j + 1), at(i + 1, j + 1), at(i + 1, j));
    }
  }
}

export function cloud(t: Xf, radius: number, seed: number, squash = 1): Float32Array {
  const out: number[] = [];
  cloudInto(out, t, radius, seed, squash);
  return new Float32Array(out);
}

/**
 * A cartoon cloud: round lobes overlapping above a flat base. What makes the shape read
 * is the scalloped silhouette, not the surface — one dented ball reads as a rock, five
 * clean balls in a row read as a cloud.
 */
export function puff(scale = 1): Float32Array {
  const out: number[] = [];
  const lobes = [
    [-0.62, 0.34, 0, 0.4], [-0.22, 0.46, 0.04, 0.52], [0.24, 0.5, -0.03, 0.5],
    [0.66, 0.32, 0.02, 0.38], [0.02, 0.28, 0.16, 0.42],
  ];
  for (const [x, y, z, r] of lobes) {
    cloudInto(out, [x * scale, y * scale, z * scale, 0, 0], r * scale, 0, 1, 0, 6, 10);
  }
  return new Float32Array(out);
}

/** A sphere seen from the inside — the sky. Normals point inward, so nothing is culled. */
export function dome(r: number, rings = 10, sides = 16): Float32Array {
  const out: number[] = [];
  const at = (i: number, j: number): V3 => {
    const th = (i / rings) * Math.PI;
    const ph = (j / sides) * Math.PI * 2;
    return [r * Math.sin(th) * Math.cos(ph), r * Math.cos(th), r * Math.sin(th) * Math.sin(ph)];
  };
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < sides; j++) {
      quad(out, at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1));
    }
  }
  return new Float32Array(out);
}

/**
 * A solid box, standing on the floor and extruded upward, with its top edge chamfered.
 * The bevel faces the light on two sides and turns from it on the other two, so every
 * slab and wall shows its edge as a change of tone — the grid reads from the geometry
 * itself, and the checkerboard no longer has to shout to be seen.
 */
export function prismSolid(
  w0: number, d0: number, w1: number, d1: number, h: number, bevel = 0.1,
): Float32Array {
  const b = Math.min(bevel, w1 / 2, d1 / 2); // a tip narrower than the chamfer would turn inside out
  const out: number[] = [];
  prism(out, [0, 0, 0, 0, 0], w0, d0, w1, d1, h - b);
  prism(out, [0, h - b, 0, 0, 0], w1, d1, w1 - 2 * b, d1 - 2 * b, b);
  return new Float32Array(out);
}

/** A flat rectangle in XY facing +Z: walls, floors, posters, rugs. */
export function panel(w: number, h: number): Float32Array {
  const out: number[] = [];
  quad(out, [-w / 2, -h / 2, 0], [w / 2, -h / 2, 0], [w / 2, h / 2, 0], [-w / 2, h / 2, 0]);
  return new Float32Array(out);
}

/** A five-pointed star, flat, facing +Z. Wall stickers. */
export function star(r: number): Float32Array {
  const out: number[] = [];
  const p = (i: number): V3 => {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.42 : r;
    return [Math.cos(a) * rr, Math.sin(a) * rr, 0];
  };
  for (let i = 0; i < 10; i++) tri(out, [0, 0, 0], p(i), p(i + 1));
  return new Float32Array(out);
}

/** Shift every vertex of a mesh — positions only, normals are left alone. */
export function shift(a: Float32Array, dx: number, dy: number, dz: number): Float32Array {
  for (let k = 0; k < a.length; k += 6) { a[k] += dx; a[k + 1] += dy; a[k + 2] += dz; }
  return a;
}

export const join = (...parts: Float32Array[]): Float32Array => {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

/** A slice of annulus between two angles, flat, facing +Z. */
export function arc(r0: number, r1: number, from: number, to: number, segs = 24): Float32Array {
  const out: number[] = [];
  const at = (i: number, r: number): V3 => {
    const a = from + ((to - from) * i) / segs;
    return [Math.cos(a) * r, Math.sin(a) * r, 0];
  };
  for (let i = 0; i < segs; i++) {
    quad(out, at(i, r0), at(i, r1), at(i + 1, r1), at(i + 1, r0));
  }
  return new Float32Array(out);
}

/** A full ring, flat, facing +Z — the reach of a noise, drawn on the floor. */
export const ring = (r0: number, r1: number) => arc(r0, r1, 0, Math.PI * 2, 32);

/**
 * The marks over the hunter's head, the way Metal Gear drew them: "!" when he sees you,
 * "?" when he hears something. Built from a stroke and a dot; the "?" hooks round three
 * quarters of a ring. About 0.8 tall, meant to be scaled up and tilted at the camera.
 */
export function mark(question: boolean): Float32Array {
  const dot = shift(panel(0.13, 0.13), 0, -0.42, 0);
  if (!question) return join(shift(panel(0.12, 0.46), 0, 0.05, 0), dot);
  return join(
    shift(arc(0.13, 0.23, -Math.PI / 2, Math.PI, 18), 0, 0.12, 0),
    shift(panel(0.1, 0.16), 0, -0.14, 0),
    dot,
  );
}

/** A key, upright, facing +Z: a ring for the bow, a shaft, two teeth. About 1.1 tall. */
export function keyShape(): Float32Array {
  return join(
    shift(ring(0.16, 0.3), 0, 0.8, 0),
    shift(panel(0.12, 0.7), 0, 0.3, 0),
    shift(panel(0.16, 0.1), 0.14, 0.08, 0),
    shift(panel(0.16, 0.1), 0.14, 0.26, 0),
  );
}

/** A quaver, the sign of a noise to come: a head, a stem and a flag. About 0.7 tall. */
export function note(): Float32Array {
  return join(
    shift(ring(0, 0.13), -0.1, 0, 0),
    shift(panel(0.07, 0.6), -0.02, 0.3, 0),
    shift(panel(0.16, 0.08), 0.06, 0.55, 0),
  );
}

/** One band of a rainbow arch: half an annulus, flat, facing +Z. */
export function arcBand(r0: number, r1: number, segs = 24): Float32Array {
  const out: number[] = [];
  const at = (i: number, r: number): V3 => {
    const a = (i / segs) * Math.PI;
    return [Math.cos(a) * r, Math.sin(a) * r, 0];
  };
  for (let i = 0; i < segs; i++) {
    quad(out, at(i, r0), at(i, r1), at(i + 1, r1), at(i + 1, r0));
  }
  return new Float32Array(out);
}

/** A room seen from the inside: one box with every normal turned inward. */
export function room(w: number, h: number, d: number): Float32Array {
  const x = w / 2, z = d / 2;
  const out: number[] = [];
  const c: V3[] = [
    [-x, 0, -z], [x, 0, -z], [x, 0, z], [-x, 0, z], // 0..3 floor
    [-x, h, -z], [x, h, -z], [x, h, z], [-x, h, z], // 4..7 ceiling
  ];
  quad(out, c[0], c[3], c[2], c[1]); // floor,   normal +Y
  quad(out, c[4], c[5], c[6], c[7]); // ceiling, normal -Y
  quad(out, c[0], c[1], c[5], c[4]); // back,    normal +Z
  quad(out, c[2], c[3], c[7], c[6]); // front,   normal -Z
  quad(out, c[3], c[0], c[4], c[7]); // left,    normal +X
  quad(out, c[1], c[2], c[6], c[5]); // right,   normal -X
  return new Float32Array(out);
}
