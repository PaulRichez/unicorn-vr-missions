// Sound: a thin layer over ZzFX (src/vendor/zzfx.js, MIT, Frank Force).
// No hand-rolled synth here — sounds are dialled in by ear at https://zzfx.3d2k.com,
// which hands back the exact parameter array to paste in.

import { zzfx, zzfxX } from '../vendor/zzfx.js';

/** A ZzFX parameter array. Holes (`[,,220]`) mean "use the default". */
export type Sound = (number | undefined)[];

/**
 * Play a sound. ZzFX creates its AudioContext when the module loads, before any user
 * gesture, so the browser leaves it suspended. We wake it on the first call, which in
 * practice comes from a click or a keypress.
 */
export function sfx(sound: Sound) {
  if (zzfxX.state === 'suspended') zzfxX.resume();
  zzfx(...sound);
}
