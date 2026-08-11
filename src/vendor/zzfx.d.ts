// Types for src/vendor/zzfx.js — ZzFXMicro is untyped JS with no exports of its own.
// The parameter order is the one used by https://zzfx.3d2k.com: paste the array the
// editor gives you as-is, holes meaning "default value".

/**
 * volume, randomness, frequency, attack, sustain, release, shape, shapeCurve,
 * slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation,
 * bitCrush, delay, sustainVolume, decay, tremolo, filter
 */
export declare const zzfx: (...params: (number | undefined)[]) => AudioBufferSourceNode;

/**
 * Builds the AudioContext on first call and returns it; subsequent calls return the same
 * one. Must run before any zzfx() call — see the local additions in zzfx.js.
 */
export declare const zzfxInit: () => AudioContext;

/** Global volume applied by ZzFX (a constant inside the library). */
export declare const zzfxV: number;
