// Unified keyboard and pointer input. Pointer Events cover mouse, touch and pen with a
// single set of handlers, so there is nothing mobile-specific to write.

import { canvas, ROT } from './view';

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

/**
 * `pointer` describes ONE pointer. Secondary touches are ignored rather than allowed to
 * overwrite it: without this, a second finger raises a phantom `hit`, moves `x`/`y`, and
 * lifting the first finger reports a release while the second is still on screen.
 * Index this state by pointerId if the game ever needs real multi-touch.
 */
let activeId: number | null = null;

const move = (e: PointerEvent) => {
  // Undo the quarter turn of a phone held upright (see view.ts): what the page has for
  // rotate(90deg) translateY(-100%) is X = width - y, Y = x.
  if (ROT) { pointer.x = e.clientY; pointer.y = innerWidth - e.clientX; return; }
  const r = canvas.getBoundingClientRect();
  pointer.x = e.clientX - r.left;
  pointer.y = e.clientY - r.top;
};

const release = () => {
  activeId = null;
  pointer.down = false;
  pointer.up = true;
};

canvas.addEventListener('pointerdown', (e) => {
  if (activeId !== null) return;
  activeId = e.pointerId;
  move(e);
  pointer.down = pointer.hit = true;
  // Keep tracking when a drag leaves the canvas.
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId === activeId) move(e);
});
canvas.addEventListener('pointerup', (e) => {
  if (e.pointerId !== activeId) return;
  move(e);
  release();
});
canvas.addEventListener('pointercancel', (e) => {
  if (e.pointerId === activeId) release();
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
// Alt-Tab while a key or button is held would otherwise leave it stuck down forever:
// the matching keyup/pointerup lands on whatever took the focus, never on us.
addEventListener('blur', () => {
  keys.clear();
  if (activeId !== null) release();
});

/** Call once per frame, after update: clears the "this frame only" state. */
export function flush() {
  pointer.hit = pointer.up = false;
  pressed.clear();
}
