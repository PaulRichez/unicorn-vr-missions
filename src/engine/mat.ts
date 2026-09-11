// 4x4 matrices, column-major like WebGL expects. Only the three operations a
// first-person camera needs — no general-purpose maths library.

export type M4 = Float32Array;

export const mat = (): M4 => new Float32Array(16);

/** Perspective projection. fovY in radians. */
export function perspective(o: M4, fovY: number, aspect: number, near: number, far: number): M4 {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  o.fill(0);
  o[0] = f / aspect;
  o[5] = f;
  o[10] = (far + near) * nf;
  o[11] = -1;
  o[14] = 2 * far * near * nf;
  return o;
}

/**
 * View matrix from a position and yaw/pitch angles, without going through a
 * lookAt: the camera basis is built straight from the two angles.
 * yaw = 0, pitch = 0 looks down -Z.
 */
export function view(o: M4, px: number, py: number, pz: number, yaw: number, pitch: number): M4 {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);

  // right, forward, then up = right x forward
  const rx = cy, ry = 0, rz = sy;
  const fx = sy * cp, fy = sp, fz = -cy * cp;
  const ux = ry * fz - rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy - ry * fx;

  o[0] = rx; o[4] = ry; o[8] = rz; o[12] = -(rx * px + ry * py + rz * pz);
  o[1] = ux; o[5] = uy; o[9] = uz; o[13] = -(ux * px + uy * py + uz * pz);
  o[2] = -fx; o[6] = -fy; o[10] = -fz; o[14] = fx * px + fy * py + fz * pz;
  o[3] = 0; o[7] = 0; o[11] = 0; o[15] = 1;
  return o;
}

/** o = a * b. Writes through a scratch buffer so o may alias a or b. */
const scratch = new Float32Array(16);
export function multiply(o: M4, a: M4, b: M4): M4 {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      scratch[c * 4 + r] = s;
    }
  }
  o.set(scratch);
  return o;
}

/**
 * Roll about Z, then pitch about X, then translate — the order the unicorn's part table
 * was authored in. No scale: each part's geometry is already built at its real size.
 */
export function partAt(o: M4, tx: number, ty: number, tz: number, rz: number, rx: number): M4 {
  const cz = Math.cos(rz), sz = Math.sin(rz);
  const ca = Math.cos(rx), sa = Math.sin(rx);
  o[0] = cz; o[1] = sz; o[2] = 0; o[3] = 0;
  o[4] = -sz * ca; o[5] = cz * ca; o[6] = sa; o[7] = 0;
  o[8] = sz * sa; o[9] = -cz * sa; o[10] = ca; o[11] = 0;
  o[12] = tx; o[13] = ty; o[14] = tz; o[15] = 1;
  return o;
}

/**
 * Scale, then pitch about X, then yaw about Y, then translate. Two axes are enough to
 * aim an object held in view: pitch raises the tip, yaw swings it across the screen.
 */
export function place(
  o: M4, tx: number, ty: number, tz: number, rx: number, ry: number, k = 1,
): M4 {
  const sa = Math.sin(rx), ca = Math.cos(rx);
  const sb = Math.sin(ry), cb = Math.cos(ry);
  o[0] = cb * k; o[1] = 0; o[2] = -sb * k; o[3] = 0;
  o[4] = sb * sa * k; o[5] = ca * k; o[6] = cb * sa * k; o[7] = 0;
  o[8] = sb * ca * k; o[9] = -sa * k; o[10] = cb * ca * k; o[11] = 0;
  o[12] = tx; o[13] = ty; o[14] = tz; o[15] = 1;
  return o;
}
