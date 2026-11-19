import { M4, Q, box, merge, quad } from '../guy.js';

const VS = `
attribute vec3 aP; attribute vec3 aN; attribute vec2 aU; attribute vec4 aB; attribute vec4 aW;
uniform mat4 uBones[20]; uniform mat4 uVP; uniform mat4 uModel; uniform float uSnap; uniform float uSkinned;
varying vec3 vN; varying vec2 vU; varying vec3 vW; varying float vD;
void main() {
  mat4 s = uSkinned > 0.5 ? uBones[int(aB.x)] * aW.x + uBones[int(aB.y)] * aW.y + uBones[int(aB.z)] * aW.z + uBones[int(aB.w)] * aW.w : mat4(1.0);
  vec4 w = uModel * s * vec4(aP, 1.0);
  vN = normalize(mat3(uModel) * mat3(s) * aN);
  vU = aU; vW = w.xyz;
  vec4 c = uVP * w;
  vD = c.w;
  if (uSnap > 0.0) c.xy = floor(c.xy / c.w * uSnap + 0.5) / uSnap * c.w;
  gl_Position = c;
}`;

const FS = `
precision mediump float;
uniform sampler2D uTex; uniform vec4 uTint; uniform float uUnlit;
uniform vec3 uAmb; uniform vec3 uLP[6]; uniform vec3 uLC[6]; uniform float uLR[6];
uniform vec3 uFog; uniform vec2 uFogR; uniform float uEmit;
varying vec3 vN; varying vec2 vU; varying vec3 vW; varying float vD;
float bayer(vec2 p) { vec2 q = mod(floor(p), 4.0); return mod(q.x * 4.0 + q.y * 7.0, 16.0) / 16.0 - 0.5; }
void main() {
  vec4 t = texture2D(uTex, vU) * uTint;
  if (t.a < 0.4) discard;
  vec3 n = normalize(vN);
  vec3 l = uAmb;
  for (int i = 0; i < 6; i++) {
    vec3 d = uLP[i] - vW;
    float dist = length(d);
    float a = max(0.0, 1.0 - dist / max(uLR[i], 0.001));
    l += uLC[i] * a * a * (0.35 + 0.65 * max(dot(n, d / max(dist, 0.001)), 0.0));
  }
  l = mix(l, vec3(1.0), uUnlit);
  vec3 c = t.rgb * l + t.rgb * uEmit;
  c += bayer(gl_FragCoord.xy) * 0.035;
  c = floor(c * 24.0) / 24.0;
  float f = clamp((vD - uFogR.x) / (uFogR.y - uFogR.x), 0.0, 1.0);
  gl_FragColor = vec4(mix(c, uFog, f), t.a);
}`;

export class Engine {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.scale = opts.pixel || 3;
    const gl = this.gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    gl.getExtension('OES_element_index_uint');
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(o); return o; };
    const p = this.prog = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
    gl.useProgram(p);
    this.loc = {};
    for (const n of ['aP', 'aN', 'aU', 'aB', 'aW']) this.loc[n] = gl.getAttribLocation(p, n);
    for (const n of ['uBones', 'uVP', 'uModel', 'uSnap', 'uSkinned', 'uTex', 'uTint', 'uUnlit', 'uAmb', 'uLP', 'uLC', 'uLR', 'uFog', 'uFogR', 'uEmit']) this.loc[n] = gl.getUniformLocation(p, n);
    this.white = this.texCanvas(Object.assign(document.createElement('canvas'), { width: 2, height: 2 }), '#fff');
    this.props = {};
    this.texCache = {};
    this.lights = [];
    this.amb = [0.25, 0.25, 0.27];
    this.fog = [0.05, 0.06, 0.05];
    this.fogR = [6, 22];
    this.loader = opts.loader || null;
    this.base = opts.base || 'assets/world/';
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(r.width / this.scale));
    this.canvas.height = Math.max(1, Math.round(r.height / this.scale));
  }

  buf(data, T = Float32Array, k = this.gl.ARRAY_BUFFER) {
    const gl = this.gl, b = gl.createBuffer();
    gl.bindBuffer(k, b); gl.bufferData(k, new T(data), gl.STATIC_DRAW);
    return b;
  }

  mesh(g, extra = {}) {
    const big = g.P.length / 3 > 65535;
    return { p: this.buf(g.P), n: this.buf(g.N), u: this.buf(g.U), b: extra.B ? this.buf(extra.B) : null, w: extra.W ? this.buf(extra.W) : null, i: this.buf(g.I, big ? Uint32Array : Uint16Array, this.gl.ELEMENT_ARRAY_BUFFER), count: g.I.length, big };
  }

  texCanvas(c, fill, repeat) {
    const gl = this.gl;
    if (fill) { const x = c.getContext('2d'); x.fillStyle = fill; x.fillRect(0, 0, c.width, c.height); }
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const pot = (c.width & (c.width - 1)) === 0 && (c.height & (c.height - 1)) === 0;
    const wrap = repeat && pot ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    return t;
  }

  async img(url) {
    const src = this.loader ? await this.loader(url, 'img') : url;
    return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
  }

  async texUrl(url, repeat = true) {
    if (this.texCache[url]) return this.texCache[url];
    const im = await this.img(url);
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    c.getContext('2d').drawImage(im, 0, 0);
    return (this.texCache[url] = this.texCanvas(c, null, repeat));
  }

  async json(url) {
    if (this.loader) return this.loader(url, 'json');
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + ' ' + r.status);
    return r.json();
  }

  async prop(name) {
    if (this.props[name]) return this.props[name];
    const d = await this.json(this.base + name + '.json');
    const m = this.mesh({ P: d.pos, N: d.nor, U: d.uv, I: d.idx });
    const groups = [];
    for (const g of d.groups) groups.push({ start: g.start, count: g.count, tex: g.tex ? await this.texUrl(this.base + g.tex) : this.white, tint: g.color ? [...g.color, 1] : [1, 1, 1, 1] });
    return (this.props[name] = { mesh: m, groups, size: d.size });
  }

  shape(g, tex, tint = [1, 1, 1, 1]) {
    return { mesh: this.mesh(g), groups: [{ start: 0, count: g.I.length, tex: tex || this.white, tint }], size: [0, 0, 0] };
  }

  bind(m) {
    const gl = this.gl, L = this.loc;
    const at = (loc, buf, n) => { if (loc < 0) return; if (buf) { gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0); } else gl.disableVertexAttribArray(loc); };
    at(L.aP, m.p, 3); at(L.aN, m.n, 3); at(L.aU, m.u, 2); at(L.aB, m.b, 4); at(L.aW, m.w, 4);
    if (!m.b) { gl.vertexAttrib4f(L.aB, 0, 0, 0, 0); gl.vertexAttrib4f(L.aW, 1, 0, 0, 0); }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.i);
  }

  begin(VP, clear = this.fog) {
    const gl = this.gl, L = this.loc, c = this.canvas;
    gl.viewport(0, 0, c.width, c.height);
    gl.clearColor(clear[0], clear[1], clear[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(L.uVP, false, VP);
    gl.uniform1f(L.uSnap, Math.min(c.width, c.height) * 0.5);
    gl.uniform3fv(L.uAmb, this.amb);
    gl.uniform3fv(L.uFog, this.fog);
    gl.uniform2fv(L.uFogR, this.fogR);
    const lp = new Float32Array(18), lc = new Float32Array(18), lr = new Float32Array(6);
    this.lights.slice(0, 6).forEach((l, i) => { lp.set(l.pos, i * 3); lc.set(l.color.map(v => v * (l.k ?? 1)), i * 3); lr[i] = l.r; });
    gl.uniform3fv(L.uLP, lp); gl.uniform3fv(L.uLC, lc); gl.uniform1fv(L.uLR, lr);
    gl.uniform1i(L.uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1f(L.uSkinned, 0);
    gl.uniform1f(L.uEmit, 0);
    this.VP = VP;
  }

  draw(obj, model, opts = {}) {
    const gl = this.gl, L = this.loc;
    this.bind(obj.mesh);
    gl.uniformMatrix4fv(L.uModel, false, model);
    gl.uniform1f(L.uUnlit, opts.unlit || 0);
    gl.uniform1f(L.uEmit, opts.emit || 0);
    gl.uniform1f(L.uSkinned, opts.bones ? 1 : 0);
    if (opts.bones) gl.uniformMatrix4fv(L.uBones, false, opts.bones);
    const type = obj.mesh.big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, sz = obj.mesh.big ? 4 : 2;
    for (const g of obj.groups) {
      gl.bindTexture(gl.TEXTURE_2D, opts.tex || g.tex);
      gl.uniform4fv(L.uTint, opts.tint ? g.tint.map((v, i) => v * opts.tint[i]) : g.tint);
      gl.drawElements(gl.TRIANGLES, g.count, type, g.start * sz);
    }
  }

  project(p) {
    const v = this.VP, x = v[0] * p[0] + v[4] * p[1] + v[8] * p[2] + v[12], y = v[1] * p[0] + v[5] * p[1] + v[9] * p[2] + v[13], w = v[3] * p[0] + v[7] * p[1] + v[11] * p[2] + v[15];
    if (w <= 0) return null;
    const r = this.canvas.getBoundingClientRect();
    return [(x / w * 0.5 + 0.5) * r.width + r.left, (0.5 - y / w * 0.5) * r.height + r.top];
  }
}

export function place(pos, rotY = 0, s = 1) {
  return M4.mul(M4.fromQT([0, 0, 0, 1], pos), M4.mul(M4.rotY(rotY), M4.fromQT([0, 0, 0, 1], [0, 0, 0], s)));
}

export function boxG(w, h, d, cx = 0, cy = 0, cz = 0, tile = 0) {
  const b = box(w, h, d, cx, cy, cz);
  if (tile) {
    for (let f = 0; f < 6; f++) {
      const dims = [[w, h], [w, h], [d, h], [d, h], [w, d], [w, d]][f];
      for (let v = 0; v < 4; v++) { b.U[(f * 4 + v) * 2] *= dims[0] / tile; b.U[(f * 4 + v) * 2 + 1] *= dims[1] / tile; }
    }
  }
  return b;
}

export { M4, Q, merge, quad };
