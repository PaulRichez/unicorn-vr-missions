// Fixed-timestep loop: the simulation always advances in 1/60 s increments, whatever the
// display refresh rate. Without this, a 144 Hz screen plays a different game than a 60 Hz
// one.

import { xr } from './xr';

const STEP = 1 / 60;
/** Past this, drop the lost time rather than catching up in a hundred iterations. */
const MAX_CATCHUP = 0.25;

/**
 * Frames come from the window, or from the headset session while one runs. The two never
 * mix: a frame from the wrong source is dropped, and `kick` (returned) starts the chain
 * on whichever source is current — called when a session begins and when it ends, since
 * a page in a headset may never get another window frame to hand over from.
 */
export function loop(update: (dt: number) => void, draw: () => void) {
  let last = performance.now() / 1000;
  let acc = 0;

  const frame = (ms: number, xf?: any) => {
    if (!!xf !== !!xr.session) return;
    (xr.session || window).requestAnimationFrame(frame);
    xr.frame = xf || null;
    const now = ms / 1000;
    acc = Math.min(acc + now - last, MAX_CATCHUP);
    last = now;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
    draw();
  };

  const kick = () => (xr.session || window).requestAnimationFrame(frame);
  kick();
  return kick;
}
