// Owns the canvas element and its size. Deliberately rendering-agnostic: game.ts is
// what decides whether to pull a 2d or a webgl2 context out of it.

export const canvas = document.getElementById('c') as HTMLCanvasElement;

/** Logical size in CSS pixels. This is the unit the game thinks in. */
export let W = 0;
export let H = 0;

/** Backing-store density, capped: 3x on mobile costs a lot for very little. */
export let DPR = 1;

const listeners: (() => void)[] = [];

function apply() {
  DPR = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth;
  H = innerHeight;
  canvas.width = (W * DPR) | 0;
  canvas.height = (H * DPR) | 0;
  for (const f of listeners) f();
}

/** Register a resize callback, invoked immediately for the initial state. */
export function onResized(f: () => void) {
  listeners.push(f);
  apply();
}

addEventListener('resize', apply);
// On iOS, orientationchange fires before innerWidth/innerHeight are updated.
addEventListener('orientationchange', () => setTimeout(apply, 100));
