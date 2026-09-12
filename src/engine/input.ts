// Unified keyboard and pointer input. Pointer Events cover mouse, touch and pen with a
// single set of handlers, so there is nothing mobile-specific to write.

import { canvas } from './view';

/** Physical codes currently held down (KeyW, ArrowLeft, Space...). */
export const keys = new Set<string>();

/** The one thing the game asks of a finger on the floor: whether it lifted this frame. */
export const pointer = { up: false };

/** Keys pressed during this frame only. */
export const pressed = new Set<string>();

/**
 * `pointer` describes ONE pointer. Secondary touches are ignored rather than allowed to
 * overwrite it: without this, a second finger raises a phantom `hit`, moves `x`/`y`, and
 * lifting the first finger reports a release while the second is still on screen.
 * Index this state by pointerId if the game ever needs real multi-touch.
 */
let activeId: number | null = null;

const release = () => {
  activeId = null;
  pointer.up = true;
};

canvas.addEventListener('pointerdown', (e) => {
  // A mouse does nothing in this game: the keyboard plays it. Fingers and pens do.
  if (activeId !== null || e.pointerType === 'mouse') return;
  activeId = e.pointerId;
});
canvas.addEventListener('pointerup', (e) => {
  if (e.pointerId === activeId) release();
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

