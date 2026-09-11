// Minimal WebGL2 layer: one program, one vertex format, flat-shaded triangles.
// Meshes are non-indexed with a per-face normal repeated on its three vertices —
// that is what gives the faceted look, and it removes the need for index buffers.

import { canvas } from './view';
import type { M4 } from './mat';

export const gl = canvas.getContext('webgl2', { antialias: true, alpha: false })!;

const VERT = `#version 300 es
in vec3 p;
in vec3 n;
uniform mat4 uVP;
uniform mat4 uM;
out vec3 vN;
out vec3 vP;
out float vL;
void main(){
  vec4 w = uM * vec4(p, 1.);
  vP = w.xyz;
  vN = mat3(uM) * n;
  vL = p.y;
  gl_Position = uVP * w;
}`;

// Fragment stage, explained here rather than inside the string: terser never touches the
// contents of a string literal, so a comment written in GLSL ships in the zip.
//
//   uBand  x = how many colour bands the horn carries, y = 1 / its length
//   uDark  xy = where the dark stands, z = how far its reach extends
//   uAt    the world position to test for the viewmodel, which has none of its own
//   uGrey  permanent desaturation: what every past failure has cost for good
//
// The banded branch stacks discrete colours along the horn, base to tip, never a
// gradient. Its hue ramp stops short of a full turn so the last band lands on violet
// instead of wrapping back round to red. The sheen term moves brightness only — moving
// the hue with the viewing angle would smear the bands into each other.
//
// Lighting is a hemisphere under one key. The ambient term blends a warm sky tint above
// into a pink bounce below by the normal's height, so a face the key never reaches still
// reads as one side of a volume rather than a flat cut-out; the key stays overhead so the
// top faces remain the brightest thing on the platform.
//
// Below the floor line there is only the void, so anything there — the sides of the slabs —
// fogs toward the sky colour with depth. The platform then floats in the sky instead of
// ending on a hard dark edge. The fog colour is the clear colour before the drain, which
// is applied after it, so a fogged side greys out with the rest.
//
// The dark itself is never drawn. It is only the last three lines: colour leaving the
// world around a point, which is what tells the player where it stands without a single
// marker on screen.
const FRAG = `#version 300 es
precision highp float;
in vec3 vN;
in vec3 vP;
in float vL;
uniform vec3 uEye;
uniform vec3 uCol;
uniform float uIrid;
uniform vec2 uBand;
uniform vec3 uDark;
uniform vec2 uAt;
uniform float uGrey;
uniform float uAlpha;
uniform vec3 uSky2;
uniform float uSkyMode;
out vec4 o;

vec3 hsv(float h, float s, float v){
  vec3 k = abs(fract(vec3(h) + vec3(1., 2./3., 1./3.)) * 6. - 3.);
  return v * mix(vec3(1.), clamp(k - 1., 0., 1.), s);
}

void main(){
  if (uSkyMode > .5) {
    vec3 d = normalize(vP - vec3(uEye.x, 0., uEye.z));
    vec3 s = mix(uCol, uSky2, clamp(d.y * 1.2 + .44, 0., 1.));
    // The arch is centred on a raised axis and only drawn well above the horizon: the
    // platform floats, so anything near eye level shows up in the gap around it and
    // reads as passing in front of the level.
    float a = acos(clamp(dot(d, normalize(vec3(0., .62, -1.))), -1., 1.));
    float band = (a - .46) / .3;
    if (band > 0. && band < 1.) {
      s = mix(s, hsv(band * .82, .8, 1.), .7 * smoothstep(.16, .34, d.y));
    }
    o = vec4(mix(s, vec3(dot(s, vec3(.3, .59, .11))), uGrey), 1.);
    return;
  }
  vec3 n = normalize(vN);
  vec3 v = normalize(uEye - vP);
  float d = max(dot(n, normalize(vec3(.35, .9, .25))), 0.);
  vec3 c = uCol * (mix(vec3(.5, .3, .45), vec3(.62, .58, .52), n.y * .5 + .5) + .5 * d);

  if (uIrid > .5) {
    float t = clamp(vL * uBand.y, 0., .999);
    float hue = floor(t * uBand.x) / uBand.x * .82;
    float sheen = 1. - abs(dot(n, v));
    c = hsv(hue, .95, .5 + .3 * d + .25 * sheen);
  }

  c = mix(c, vec3(.42, .2, .5), clamp(-vP.y * 1.2, 0., 1.) * .7);

  vec2 wp = uIrid > .5 ? uAt : vP.xz;
  float g = max(uGrey, 1. - smoothstep(uDark.z * .3, uDark.z, distance(wp, uDark.xy)));
  c = mix(c, vec3(dot(c, vec3(.3, .59, .11))), g);

  o = vec4(c, uAlpha);
}`;

function shader(type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

const program = gl.createProgram()!;
gl.attachShader(program, shader(gl.VERTEX_SHADER, VERT));
gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAG));
gl.linkProgram(program);
gl.useProgram(program);

const uVP = gl.getUniformLocation(program, 'uVP');
const uM = gl.getUniformLocation(program, 'uM');
const uEye = gl.getUniformLocation(program, 'uEye');
const uCol = gl.getUniformLocation(program, 'uCol');
const uIrid = gl.getUniformLocation(program, 'uIrid');
const uBand = gl.getUniformLocation(program, 'uBand');
const uDark = gl.getUniformLocation(program, 'uDark');
const uAt = gl.getUniformLocation(program, 'uAt');
const uGrey = gl.getUniformLocation(program, 'uGrey');
const uAlpha = gl.getUniformLocation(program, 'uAlpha');
const uSky2 = gl.getUniformLocation(program, 'uSky2');
const uSkyMode = gl.getUniformLocation(program, 'uSkyMode');

/** Switch to the flat gradient used by the dome; the colour passed to draw is the low end. */
export function setSky(on: boolean, r = 0, g = 0, b = 0) {
  gl.uniform1f(uSkyMode, on ? 1 : 0);
  if (on) gl.uniform3f(uSky2, r, g, b);
}

gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

/** Translucent passes — the seen-tile overlay — draw without writing depth. */
export function setBlend(on: boolean) {
  if (on) { gl.enable(gl.BLEND); gl.depthMask(false); }
  else { gl.disable(gl.BLEND); gl.depthMask(true); }
}

/** How many colour bands the horn carries, and how long it is. */
export function setBands(count: number, length: number) {
  gl.uniform2f(uBand, count, 1 / length);
}

/** Where the dark stands and how far it reaches, plus the colour it has taken for good. */
export function setDark(x: number, z: number, reach: number, grey: number, atX: number, atZ: number) {
  gl.uniform3f(uDark, x, z, reach);
  gl.uniform2f(uAt, atX, atZ);
  gl.uniform1f(uGrey, grey);
}

gl.enable(gl.DEPTH_TEST);
gl.enable(gl.CULL_FACE);

export interface Mesh {
  vao: WebGLVertexArrayObject;
  buf: WebGLBuffer;
  count: number;
}

/** Upload interleaved [x,y,z, nx,ny,nz] triangles. */
export function mesh(data: Float32Array): Mesh {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  for (let i = 0; i < 2; i++) {
    gl.enableVertexAttribArray(i);
    gl.vertexAttribPointer(i, 3, gl.FLOAT, false, 24, i * 12);
  }
  return { vao, buf, count: data.length / 6 };
}

/** Spike-only: rebuilding a mesh while tuning would otherwise leak GPU objects. */
export function dispose(m: Mesh) {
  gl.deleteVertexArray(m.vao);
  gl.deleteBuffer(m.buf);
}

/**
 * The camera transform in use. The horn is drawn as a viewmodel — fixed to the head —
 * by setting this to the projection alone, so its model matrix lives in view space.
 */
export function setVP(vp: M4, ex: number, ey: number, ez: number) {
  gl.uniformMatrix4fv(uVP, false, vp);
  gl.uniform3f(uEye, ex, ey, ez);
}

/**
 * The sky is the clear colour: outdoors it fills half the screen, so it is set from the
 * game rather than fixed here — it has to drain along with everything else.
 */
export function frame(vp: M4, ex: number, ey: number, ez: number, r: number, g: number, b: number) {
  gl.clearColor(r, g, b, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  setVP(vp, ex, ey, ez);
}

export function draw(m: Mesh, model: M4, r: number, g: number, b: number, irid = 0, alpha = 1) {
  gl.uniformMatrix4fv(uM, false, model);
  gl.uniform3f(uCol, r, g, b);
  gl.uniform1f(uIrid, irid);
  gl.uniform1f(uAlpha, alpha);
  gl.bindVertexArray(m.vao);
  gl.drawArrays(gl.TRIANGLES, 0, m.count);
}
