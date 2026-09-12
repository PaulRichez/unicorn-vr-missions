// Minimal WebGL2 layer: one program, one vertex format, flat-shaded triangles.
// Meshes are non-indexed with a per-face normal repeated on its three vertices —
// that is what gives the faceted look, and it removes the need for index buffers.

import { canvas } from './view';
import type { M4 } from './mat';

export const gl = canvas.getContext('webgl2', { alpha: false })!;

const VERT = `#version 300 es
in vec3 p;
in vec3 n;
uniform mat4 uV;
uniform mat4 uM;
out vec3 vN;
out vec3 vP;
out vec2 vU;
void main(){
  vec4 w = uM * vec4(p, 1.);
  vP = w.xyz;
  vU = p.xy;
  vN = mat3(uM) * n;
  gl_Position = uV * w;
}`;

// Fragment stage, explained here rather than inside the string: terser never touches the
// contents of a string literal, so a comment written in GLSL ships in the zip.
//
//   uB  x = how many colour bands the horn carries, y = 1 / its length
//   uG  permanent desaturation: what every past failure has cost for good
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
const FRAG = `#version 300 es
precision highp float;
in vec3 vN;
in vec3 vP;
in vec2 vU;
uniform sampler2D uX;
uniform vec3 uE;
uniform vec3 uC;
uniform float uI;
uniform vec2 uB;
uniform float uG;
uniform float uA;
uniform float uF;
uniform vec3 uS;
uniform float uK;
out vec4 o;

vec3 hsv(float h, float s, float v){
  vec3 k = abs(fract(vec3(h) + vec3(1., 2./3., 1./3.)) * 6. - 3.);
  return v * mix(vec3(1.), clamp(k - 1., 0., 1.), s);
}

void main(){
  if (uK > 1.5) {
    vec4 t = texture(uX, vec2(vU.x + .5, .5 - vU.y * 1.6));
    o = vec4(mix(t.rgb, vec3(dot(t.rgb, vec3(.3, .59, .11))), uG), t.a);
    return;
  }
  if (uK > .5) {
    vec3 d = normalize(vP - vec3(uE.x, 0., uE.z));
    vec3 s = mix(uC, uS, clamp(d.y * 1.2 + .44, 0., 1.));
    o = vec4(mix(s, vec3(dot(s, vec3(.3, .59, .11))), uG), 1.);
    return;
  }
  vec3 n = normalize(vN);
  vec3 v = normalize(uE - vP);
  float d = max(dot(n, normalize(vec3(.35, .9, .25))), 0.);
  vec3 c = uC * (mix(vec3(.5, .3, .45), vec3(.62, .58, .52), n.y * .5 + .5) + .5 * d);

  if (uI > .5) {
    float t = clamp(vU.y * uB.y, 0., .999);
    float hue = floor(t * uB.x) / uB.x * .82;
    float sheen = 1. - abs(dot(n, v));
    c = hsv(hue, .95, .5 + .3 * d + .25 * sheen);
  }

  c = mix(c, vec3(.42, .2, .5), clamp(-vP.y * 1.2, 0., 1.) * .7);

  c = mix(c, vec3(dot(c, vec3(.3, .59, .11))), uG);

  o = vec4(c, uA * (uF > 0. ? clamp(vU.y / uF, 0., 1.) : 1.));
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

const uV = gl.getUniformLocation(program, 'uV');
const uM = gl.getUniformLocation(program, 'uM');
const uE = gl.getUniformLocation(program, 'uE');
const uC = gl.getUniformLocation(program, 'uC');
const uI = gl.getUniformLocation(program, 'uI');
const uB = gl.getUniformLocation(program, 'uB');
const uG = gl.getUniformLocation(program, 'uG');
const uA = gl.getUniformLocation(program, 'uA');
const uF = gl.getUniformLocation(program, 'uF');
const uS = gl.getUniformLocation(program, 'uS');
const uK = gl.getUniformLocation(program, 'uK');

/** Switch to the flat gradient used by the dome; the colour passed to draw is the low end. */
export function setSky(on: boolean, r = 0, g = 0, b = 0) {
  gl.uniform1f(uK, on ? 1 : 0);
  if (on) gl.uniform3f(uS, r, g, b);
}

// The one texture: the page's text, drawn into a canvas, for the headset where the page
// itself cannot be seen. A panel of 1 by 0.625 maps it edge to edge (see the shader).
gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
// One transparent texel from the start, with real data: a sampler bound to an empty
// texture makes Firefox warn on every draw, and a null upload makes it warn once about
// "lazy initialization" instead.
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
export function text(c: HTMLCanvasElement) {
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
}
export function setText(on: boolean) {
  gl.uniform1f(uK, on ? 2 : 0);
}

gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

/** Translucent passes — the seen-tile overlay — draw without writing depth. */
export function setBlend(on: boolean) {
  if (on) { gl.enable(gl.BLEND); gl.depthMask(false); }
  else { gl.disable(gl.BLEND); gl.depthMask(true); }
}

/** How many colour bands the horn carries, and how long it is. */
/**
 * A vertical fade: below local y = 0 a mesh is invisible, at y = f fully there. Zero turns
 * it off. Only the rainbow uses it — its feet dissolve into the air the way real ones do,
 * instead of ending on two hard stumps in the sky.
 */
export function setFade(f: number) {
  gl.uniform1f(uF, f);
}
export function setBands(count: number, length: number) {
  gl.uniform2f(uB, count, 1 / length);
}

/** The colour the world has lost for good. */
export function setGrey(grey: number) {
  gl.uniform1f(uG, grey);
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
  gl.uniformMatrix4fv(uV, false, vp);
  gl.uniform3f(uE, ex, ey, ez);
}

/**
 * The sky is the clear colour: outdoors it fills half the screen, so it is set from the
 * game rather than fixed here — it has to drain along with everything else.
 */
// The sky dome covers every pixel in every phase, so the clear colour is never seen; it
// is set once, to the sky's own purple, as a fallback that nobody should ever meet.
gl.clearColor(0.42, 0.2, 0.5, 1);
export function clear() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

export function draw(m: Mesh, model: M4, r: number, g: number, b: number, irid = 0, alpha = 1) {
  gl.uniformMatrix4fv(uM, false, model);
  gl.uniform3f(uC, r, g, b);
  gl.uniform1f(uI, irid);
  gl.uniform1f(uA, alpha);
  gl.bindVertexArray(m.vao);
  gl.drawArrays(gl.TRIANGLES, 0, m.count);
}
