// Entry point: wires the engine to the game, nothing more.

import { onResized } from './engine/view';
import { loop } from './engine/loop';
import { stick } from './engine/camera';
import { update, draw, resize } from './game';
import { xr } from './engine/xr';

onResized(resize);

const kick = loop(update, draw);
// A session begins or ends: the loop moves to the other frame source, the page gets its
// viewport back, and a thumbstick left pushed in the headset does not walk the flat game.
xr.onFlip = () => { stick.x = stick.y = 0; resize(); kick(); };
