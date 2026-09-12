// Fixed-timestep loop: the simulation always advances in 1/60 s increments, whatever the
// display refresh rate. Without this, a 144 Hz screen plays a different game than a 60 Hz
// one.

import { xr } from './xr';

const STEP = 1 / 60;
/** Past this, drop the lost time rather than catching up in a hundred iterations. */
const MAX_CATCHUP = 0.25;

/**
 * `draw` receives `stepped`: whether this frame ran at least one simulation step.
 * Above 60 Hz many frames run none, and anything that consumes per-frame state must
 * wait for a step rather than run on every repaint.
 */
export function loop(update: (dt: number) => void, draw: (alpha: number, stepped: boolean) => void) {
  let last = performance.now() / 1000;
  let acc = 0;

  const frame = (ms: number, xf?: any) => {
    // A headset frame arriving after its session ended: the window loop has taken over.
    if (xf && !xr.session) return;
    (xr.session || window).requestAnimationFrame(frame);
    xr.frame = xf || null;
    const now = ms / 1000;
    acc = Math.min(acc + now - last, MAX_CATCHUP);
    last = now;
    let stepped = false;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
      stepped = true;
    }
    // alpha = position between the last two steps, for interpolated rendering.
    draw(acc / STEP, stepped);
  };

  requestAnimationFrame(frame);
  return () => requestAnimationFrame(frame);
}
