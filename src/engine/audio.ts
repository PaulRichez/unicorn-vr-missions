// Sound: a thin layer over ZzFX (src/vendor/zzfx.js, MIT, Frank Force).
// No hand-rolled synth here — sounds are dialled in by ear at https://zzfx.3d2k.com,
// which hands back the exact parameter array to paste in.

import { zzfx, zzfxInit } from '../vendor/zzfx.js';

/** A ZzFX parameter array. Holes (`[,,220]`) mean "use the default". */
export type Sound = (number | undefined)[];

let muted = false;

export const toggleMute = () => (muted = !muted);
export const isMuted = () => muted;

/**
 * Play a sound. The AudioContext is built on this first call rather than at load time:
 * browsers warn about a context created before any user gesture, and the first sound
 * always follows a click or a keypress. `resume` covers a context that was suspended
 * later, typically after the tab lost focus.
 */
export function sfx(sound: Sound) {
  if (muted) return;
  const ac = zzfxInit();
  if (ac.state === 'suspended') ac.resume();
  zzfx(...sound);
}
