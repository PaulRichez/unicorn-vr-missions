// Fixed-timestep loop: the simulation always advances in 1/60 s increments, whatever the
// display refresh rate. Without this, a 144 Hz screen plays a different game than a 60 Hz
// one.

const STEP = 1 / 60;
/** Past this, drop the lost time rather than catching up in a hundred iterations. */
const MAX_CATCHUP = 0.25;

export function loop(update: (dt: number) => void, draw: (alpha: number) => void) {
  let last = performance.now() / 1000;
  let acc = 0;

  const frame = (ms: number) => {
    requestAnimationFrame(frame);
    const now = ms / 1000;
    acc = Math.min(acc + now - last, MAX_CATCHUP);
    last = now;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
    // alpha = position between the last two steps, for interpolated rendering.
    draw(acc / STEP);
  };

  requestAnimationFrame(frame);
}
