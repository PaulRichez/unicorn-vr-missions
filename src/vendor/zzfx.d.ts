// Types for src/vendor/zzfx.js — ZzFXMicro is untyped JS with no exports of its own.
// The parameter order is the one used by https://zzfx.3d2k.com: paste the array the
// editor gives you as-is, holes meaning "default value".

/**
 * volume, randomness, frequency, attack, sustain, release, shape, shapeCurve,
 * slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation,
 * bitCrush, delay, sustainVolume, decay, tremolo, filter
 */
export declare const zzfx: (...params: (number | undefined)[]) => AudioBufferSourceNode;

/** The AudioContext ZzFX creates when the module loads. */
export declare const zzfxX: AudioContext;

/** Global volume applied by ZzFX (a constant inside the library). */
export declare const zzfxV: number;
