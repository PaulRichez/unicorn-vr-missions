// Unified keyboard and pointer input. Pointer Events cover mouse, touch and pen with a
// single set of handlers, so there is nothing mobile-specific to write.

import { canvas } from './view';

/** Physical codes currently held down (KeyW, ArrowLeft, Space...). */
export const keys = new Set<string>();

export const pointer = {
  /** Position in CSS pixels, relative to the canvas. */
  x: 0,
  y: 0,
  /** Held down. */
  down: false,
  /** Pressed during this frame only — cleared by flush(). */
  hit: false,
  /** Released during this frame only. */
  up: false,
};

/** Keys pressed during this frame only. */
export const pressed = new Set<string>();

const move = (e: PointerEvent) => {
  const r = canvas.getBoundingClientRect();
  pointer.x = e.clientX - r.left;
  pointer.y = e.clientY - r.top;
};

canvas.addEventListener('pointerdown', (e) => {
  move(e);
  pointer.down = pointer.hit = true;
  // Keep tracking when a drag leaves the canvas.
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', move);
canvas.addEventListener('pointerup', (e) => {
  move(e);
  pointer.down = false;
  pointer.up = true;
});
canvas.addEventListener('pointercancel', () => {
  pointer.down = false;
  pointer.up = true;
});
// No context menu on long press or right click mid-game.
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

addEventListener('keydown', (e) => {
  if (!e.repeat) pressed.add(e.code);
  keys.add(e.code);
  // Stop arrows and space from scrolling the page.
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
// Alt-Tab while a key is held would otherwise leave it stuck down forever.
addEventListener('blur', () => keys.clear());

/** Call once per frame, after update: clears the "this frame only" state. */
export function flush() {
  pointer.hit = pointer.up = false;
  pressed.clear();
}
