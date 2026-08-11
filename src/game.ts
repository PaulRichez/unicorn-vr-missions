// ─────────────────────────────────────────────────────────────────────────────
//  PLACEHOLDER — gut this on August 13th, once the theme is announced.
//  This is the only file that knows the rendering technology: the Canvas 2D choice
//  below commits to nothing, view.ts only hands out a sized <canvas>.
//  To move to WebGL2: swap getContext('2d') for getContext('webgl2').
// ─────────────────────────────────────────────────────────────────────────────

import { canvas, W, H, DPR } from './engine/view';
import { pointer, pressed } from './engine/input';
import { sfx } from './engine/audio';

const ctx = canvas.getContext('2d')!;

let t = 0;
let clicks = 0;

export function resize() {
  // The backing store is in physical pixels; scale once here so every draw call below
  // can work in the game's own units.
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
}

export function update(dt: number) {
  t += dt;
  if (pointer.hit || pressed.has('Space')) {
    clicks++;
    // Pasted from the ZzFX editor; replace with the game's real sounds.
    sfx([, , 220 * (1 + (clicks % 5)), , 0.02, 0.12, 1, 1.8, , , , , , , , , 0.04]);
  }
}

export function draw() {
  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, 0, W, H);

  const pulse = 1 + Math.sin(t * 2) * 0.04;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = '#e84a5f';
  ctx.font = `700 ${Math.min(W, H) * 0.28}px system-ui,sans-serif`;
  ctx.fillText('13', 0, 0);
  ctx.restore();

  ctx.fillStyle = '#6b7280';
  ctx.font = '500 14px system-ui,sans-serif';
  ctx.fillText('boilerplate — click or space', W / 2, H / 2 + Math.min(W, H) * 0.2);
  ctx.fillText(`${clicks}`, W / 2, H / 2 + Math.min(W, H) * 0.2 + 22);
}
