// Entry point: wires the engine to the game, nothing more.

import { onResized } from './engine/view';
import { flush } from './engine/input';
import { loop } from './engine/loop';
import { update, draw, resize } from './game';

onResized(resize);

loop(update, () => {
  draw();
  // Clear the "this frame only" state here rather than in update: one frame can consume
  // several simulation steps, and a click has to stay visible to all of them.
  flush();
});
