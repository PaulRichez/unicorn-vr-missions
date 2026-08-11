// Entry point: wires the engine to the game, nothing more.

import { onResized } from './engine/view';
import { flush } from './engine/input';
import { loop } from './engine/loop';
import { update, draw, resize } from './game';

onResized(resize);

loop(update, (_alpha, stepped) => {
  draw();
  // Clear the "this frame only" state after the steps, not inside update: one frame can
  // consume several steps and a click has to stay visible to all of them. Only clear it
  // when a step actually ran — above 60 Hz many frames run none, and flushing there would
  // drop clicks that no update ever saw.
  if (stepped) flush();
});
