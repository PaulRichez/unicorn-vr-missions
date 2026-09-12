// Procedural geometry. Nothing is stored: every vertex is computed from a handful of
// numbers at startup, which is why 3D costs almost nothing in bytes here.
//
// Winding matters — back faces are culled, so a quad wound the wrong way is invisible
// rather than merely wrong. Every face below is ordered so its normal points at the
// viewer: outward for the horn, inward for the room.

type V3 = [number, number, number];

/** Push one triangle with its face normal repeated per vertex — that is the flat look. */
export function tri(out: number[], a: V3, b: V3, c: V3) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  nx /= l; ny /= l; nz /= l;
  for (const p of [a, b, c]) out.push(p[0], p[1], p[2], nx, ny, nz);
}

export const quad = (out: number[], a: V3, b: V3, c: V3, d: V3) => {
  tri(out, a, b, c);
  tri(out, a, c, d);
};

// --- assembled shapes -------------------------------------------------------
// Parts are emitted straight into a shared buffer through a transform, so normals fall
// out of the triangle winding and never need transforming separately.

/** A part's offset in the shared buffer. Parts are posed by their model matrix, not here. */
const put = (t: V3, x: number, y: number, z: number): V3 => [x + t[0], y + t[1], z + t[2]];

/** A box extruded along +Y whose cross-section shrinks: neck, skull, muzzle. */
function prism(out: number[], t: V3, w0: number, d0: number, w1: number, d1: number, h: number) {
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

/**
 * A cloud: a sphere whose radius is bent by two slow sine waves, so it comes out lumpy
 * rather than round. Flat-shaded, the facets read as a stylised cloud â€” the only kind a
 * polygon renderer can afford. `squash` flattens it into a bank rather than a puff.
 */
function cloudInto(out: number[], t: V3, r: number, rings: number, sides: number) {
  const at = (i: number, j: number): V3 => {
    const th = (i / rings) * Math.PI;
    const ph = (j / sides) * Math.PI * 2;
    return put(t, r * Math.sin(th) * Math.cos(ph), r * Math.cos(th), r * Math.sin(th) * Math.sin(ph));
  };
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < sides; j++) {
      quad(out, at(i, j), at(i, j + 1), at(i + 1, j + 1), at(i + 1, j));
    }
  }
}

/**
 * A cartoon cloud: round lobes overlapping above a flat base. What makes the shape read
 * is the scalloped silhouette, not the surface — one dented ball reads as a rock, five
 * clean balls in a row read as a cloud.
 */
export function puff(scale: number): Float32Array {
  const out: number[] = [];
  const lobes = [
    [-0.62, 0.34, 0, 0.4], [-0.22, 0.46, 0.04, 0.52], [0.24, 0.5, -0.03, 0.5],
    [0.66, 0.32, 0.02, 0.38], [0.02, 0.28, 0.16, 0.42],
  ];
  for (const [x, y, z, r] of lobes) {
    cloudInto(out, [x * scale, y * scale, z * scale], r * scale, 6, 10);
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
  prism(out, [0, 0, 0], w0, d0, w1, d1, h - b);
  prism(out, [0, h - b, 0], w1, d1, w1 - 2 * b, d1 - 2 * b, b);
  return new Float32Array(out);
}

/** A flat rectangle in XY facing +Z: walls, floors, posters, rugs. */
export function panel(w: number, h: number): Float32Array {
  const out: number[] = [];
  quad(out, [-w / 2, -h / 2, 0], [w / 2, -h / 2, 0], [w / 2, h / 2, 0], [-w / 2, h / 2, 0]);
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
export function arc(r0: number, r1: number, from: number, to: number, segs: number): Float32Array {
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

/** A key in the round, standing along +Y: a square bow of four bars, a shaft, two teeth. About 1.35 tall. */
export function keyShape(): Float32Array {
  const bar = (w: number, h: number, x: number, y: number) => shift(prismSolid(w, 0.16, w, 0.16, h, 0.04), x, y, 0);
  return join(
    bar(0.16, 0.8, 0, 0),
    bar(0.3, 0.12, 0.15, 0.06),
    bar(0.3, 0.12, 0.15, 0.28),
    bar(0.15, 0.6, -0.22, 0.75),
    bar(0.15, 0.6, 0.22, 0.75),
    bar(0.6, 0.15, 0, 1.2),
    bar(0.6, 0.15, 0, 0.75),
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

