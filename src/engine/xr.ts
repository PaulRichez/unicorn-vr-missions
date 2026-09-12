// WebXR: the platform becomes a diorama on a table in front of the player. The head is the
// camera, the thumbstick walks the unicorn, the trigger farts. Everything the game draws is
// scaled down to toy size and set in front of the floor-level reference space; the game
// itself keeps thinking in tiles. The player never moves, so nothing can make them sick.

import { gl } from './gl';
import { pressed } from './input';

export const xr = {
  session: null as any,
  frame: null as any,
  space: null as any,
  /** Room from world: a tile is fifteen centimetres, the table stands 0.9 m high, and the
   * platform's centre is always at the same spot, 1.2 m ahead: the largest one ends a
   * hand's reach from the player, a small one a little further, and nothing ever moves
   * when the list changes the platform under the words. */
  k: 0.05,
  z: -1.2,
  /** Set by main: called when a session begins and when it ends (see loop.ts). */
  onFlip: () => {},
};

/** Whether a headset can be entered from this page. Asked once the boot log is over, not
 * at load, and navigator.xr read fresh then: an emulator extension installs its runtime
 * a moment after the page's own script ran, replacing the browser's object. */
export let xrOK = false;
export const xrCheck = () => (navigator as any).xr?.isSessionSupported('immersive-vr').then((ok: boolean) => { xrOK = ok; }, () => {});

/** Must be called from a click: a session needs a gesture the way sound does. */
export function enterVR() {
  (navigator as any).xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] }).then(async (s: any) => {
    await (gl as any).makeXRCompatible();
    s.updateRenderState({ baseLayer: new (self as any).XRWebGLLayer(s, gl) });
    xr.space = await s.requestReferenceSpace('local-floor');
    s.onend = () => { xr.session = xr.frame = null; xr.onFlip(); };
    // A select with no gamepad behind it — a tap on a phone in a Cardboard, a pinch of a
    // tracked hand — is the trigger too.
    s.onselect = (e: any) => { if (!e.inputSource.gamepad) pressed.add('Space'); };
    xr.session = s;
    xr.onFlip();
  }).catch(() => {}); // refused (runtime asleep, a second click): the button simply stays
}
