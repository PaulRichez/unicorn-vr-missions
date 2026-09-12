// WebXR: the platform becomes a diorama on a table in front of the player. The head is the
// camera, the thumbstick walks the unicorn, the trigger farts. Everything the game draws is
// scaled down to toy size and set in front of the floor-level reference space; the game
// itself keeps thinking in tiles. The player never moves, so nothing can make them sick.

export const xr = {
  session: null as any,
  frame: null as any,
  space: null as any,
  /** Room from world: one tile edge is twelve centimetres; the platform's centre stands here. */
  k: 0.04,
  x: 0,
  y: 0.95,
  z: -0.85,
  /** Set by main: the window loop and the viewport take over when the session ends. */
  onEnd: () => {},
};

const sys = (navigator as any).xr;
/** Resolves to whether a headset can be entered from this page. */
export const xrOK: Promise<boolean> = sys ? sys.isSessionSupported('immersive-vr') : Promise.resolve(false);

/** Must be called from a click: a session needs a gesture the way sound does. */
export function enterVR(gl: WebGL2RenderingContext) {
  sys.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] }).then(async (s: any) => {
    await (gl as any).makeXRCompatible();
    s.updateRenderState({ baseLayer: new (self as any).XRWebGLLayer(s, gl) });
    // Without a floor the origin is the head itself: the table drops to hip height below it.
    xr.space = await s.requestReferenceSpace('local-floor').catch(() => { xr.y = -0.65; return s.requestReferenceSpace('local'); });
    s.onend = () => { xr.session = xr.frame = null; xr.onEnd(); };
    xr.session = s;
  });
}
