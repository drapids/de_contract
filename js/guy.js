const M4 = {
  id() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  },
  persp(fov, asp, n, f) {
    const t = 1 / Math.tan(fov / 2), m = new Float32Array(16);
    m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f);
    return m;
  },
  look(e, c, u) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
    let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx;
    l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
  },
  fromQT(q, t, s = 1) {
    const [x, y, z, w] = q, m = new Float32Array(16);
    m[0] = (1 - 2 * (y * y + z * z)) * s; m[1] = 2 * (x * y + z * w) * s; m[2] = 2 * (x * z - y * w) * s;
    m[4] = 2 * (x * y - z * w) * s; m[5] = (1 - 2 * (x * x + z * z)) * s; m[6] = 2 * (y * z + x * w) * s;
    m[8] = 2 * (x * z + y * w) * s; m[9] = 2 * (y * z - x * w) * s; m[10] = (1 - 2 * (x * x + y * y)) * s;
    m[12] = t[0]; m[13] = t[1]; m[14] = t[2]; m[15] = 1;
    return m;
  },
  rotY(a) { const m = M4.id(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; },
  pos(m) { return [m[12], m[13], m[14]]; }
};

const Q = {
  axis(ax, a) { const s = Math.sin(a / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(a / 2)]; },
  mul(a, b) {
    return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
      a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  },
  conj(q) { return [-q[0], -q[1], -q[2], q[3]]; },
  euler(d) {
    const r = Math.PI / 180;
    return Q.mul(Q.axis([0, 1, 0], d[1] * r), Q.mul(Q.axis([1, 0, 0], d[0] * r), Q.axis([0, 0, 1], d[2] * r)));
  },
  fromMat(m) {
    const t = m[0] + m[5] + m[10];
    let x, y, z, w;
    if (t > 0) { const s = Math.sqrt(t + 1) * 2; w = s / 4; x = (m[6] - m[9]) / s; y = (m[8] - m[2]) / s; z = (m[1] - m[4]) / s; }
    else if (m[0] > m[5] && m[0] > m[10]) { const s = Math.sqrt(1 + m[0] - m[5] - m[10]) * 2; w = (m[6] - m[9]) / s; x = s / 4; y = (m[4] + m[1]) / s; z = (m[8] + m[2]) / s; }
    else if (m[5] > m[10]) { const s = Math.sqrt(1 + m[5] - m[0] - m[10]) * 2; w = (m[8] - m[2]) / s; x = (m[4] + m[1]) / s; y = s / 4; z = (m[9] + m[6]) / s; }
    else { const s = Math.sqrt(1 + m[10] - m[0] - m[5]) * 2; w = (m[1] - m[4]) / s; x = (m[8] + m[2]) / s; y = (m[9] + m[6]) / s; z = s / 4; }
    const l = Math.hypot(x, y, z, w);
    return [x / l, y / l, z / l, w / l];
  }
};

const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
const back = t => { t = Math.min(Math.max(t, 0), 1); const c = 2.2; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const wave = (t, f, p = 0) => Math.sin(t * f * Math.PI * 2 + p);
const lerp = (a, b, t) => a + (b - a) * t;

function mirror(pose) {
  const o = {};
  for (const k in pose) {
    o[k] = pose[k];
    if (k.endsWith('.l')) {
      const r = k.slice(0, -2) + '.r';
      if (!(r in pose)) { const v = pose[k]; o[r] = [v[0], -v[1], -v[2]]; }
    }
  }
  return o;
}

function box(w, h, d, cx = 0, cy = 0, cz = 0) {
  const x = w / 2, y = h / 2, z = d / 2, P = [], N = [], U = [], I = [];
  const faces = [
    [[0, 0, 1], [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]]],
    [[0, 0, -1], [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]]],
    [[1, 0, 0], [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]]],
    [[-1, 0, 0], [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]]],
    [[0, 1, 0], [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]]],
    [[0, -1, 0], [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]]]
  ];
  for (const [n, vs] of faces) {
    const b = P.length / 3;
    vs.forEach((v, i) => { P.push(v[0] + cx, v[1] + cy, v[2] + cz); N.push(...n); U.push(i === 1 || i === 2 ? 1 : 0, i >= 2 ? 1 : 0); });
    I.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  return { P, N, U, I };
}

function merge(...parts) {
  const o = { P: [], N: [], U: [], I: [] };
  for (const p of parts) {
    const b = o.P.length / 3;
    o.P.push(...p.P); o.N.push(...p.N); o.U.push(...p.U); o.I.push(...p.I.map(i => i + b));
  }
  return o;
}

function quad(w, h, cz = 0) {
  return { P: [-w / 2, -h / 2, cz, w / 2, -h / 2, cz, w / 2, h / 2, cz, -w / 2, h / 2, cz], N: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], U: [0, 0, 1, 0, 1, 1, 0, 1], I: [0, 1, 2, 0, 2, 3] };
}

const VS = `
attribute vec3 aP; attribute vec3 aN; attribute vec2 aU; attribute vec4 aB; attribute vec4 aW; attribute float aH;
uniform mat4 uBones[24]; uniform mat4 uVP; uniform mat4 uModel; uniform float uSnap;
varying vec3 vN; varying vec2 vU; varying vec3 vW; varying float vHand;
void main() {
  mat4 s = uBones[int(aB.x)] * aW.x + uBones[int(aB.y)] * aW.y + uBones[int(aB.z)] * aW.z + uBones[int(aB.w)] * aW.w;
  vec4 w = uModel * s * vec4(aP, 1.0);
  vN = normalize(mat3(uModel) * mat3(s) * aN);
  vU = aU; vW = w.xyz;
  vHand = aH;
  vec4 c = uVP * w;
  if (uSnap > 0.0) { c.xy = floor(c.xy / c.w * uSnap + 0.5) / uSnap * c.w; }
  gl_Position = c;
}`;

const FS = `
precision mediump float;
uniform sampler2D uTex; uniform vec4 uTint; uniform float uUnlit; uniform float uShine; uniform float uHandOnly;
varying vec3 vN; varying vec2 vU; varying vec3 vW; varying float vHand;
void main() {
  vec4 t = texture2D(uTex, vU) * uTint;
  if (t.a < 0.4 || (uHandOnly > 0.5 && vHand < 0.5)) discard;
  vec3 n = normalize(vN);
  float key = max(dot(n, normalize(vec3(-0.5, 0.8, 0.9))), 0.0);
  float fill = max(dot(n, normalize(vec3(0.8, 0.2, 0.4))), 0.0) * 0.25;
  float rim = pow(1.0 - max(dot(n, vec3(0.0, 0.0, 1.0)), 0.0), 3.0) * 0.35;
  float l = 0.42 + floor((key * 0.75 + fill) * 4.0) / 4.0;
  vec3 c = t.rgb * mix(l, 1.0, uUnlit) + vec3(1.0, 0.85, 0.55) * rim * (1.0 - uUnlit);
  float sp = pow(max(dot(reflect(-normalize(vec3(-0.5, 0.8, 0.9)), n), vec3(0.0, 0.0, 1.0)), 0.0), 24.0) * uShine;
  gl_FragColor = vec4(c + sp, t.a);
}`;

export class Guy {
  constructor(host, opts = {}) {
    this.host = host;
    this.base = opts.base || 'assets/';
    this.scale = opts.pixel || 2;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'guy-gl';
    this.fx = document.createElement('canvas');
    this.fx.className = 'guy-fx';
    this.bubble = document.createElement('div');
    this.bubble.className = 'guy-bubble';
    host.append(this.canvas, this.fx, this.bubble);
    this.gl = this.canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false });
    this.state = 'idle';
    this.prev = null;
    this.blend = 1;
    this.t0 = performance.now() / 1000;
    this.stateT = 0;
    this.look = [0, 0];
    this.lookT = [0, 0];
    this.parts = [];
    this.confetti = [];
    this.glasses = 0;
    this.heldTex = null;
    this.ready = this.load();
    host.addEventListener('pointermove', e => this.aim(e));
    window.addEventListener('pointermove', e => this.aim(e));
    this.canvas.addEventListener('click', () => this.poke());
    new ResizeObserver(() => this.resize()).observe(host);
  }

  aim(e) {
    const r = this.canvas.getBoundingClientRect();
    const hx = r.left + r.width * 0.5, hy = r.top + r.height * 0.22;
    this.lookT = [Math.max(-1, Math.min(1, (e.clientX - hx) / 500)), Math.max(-1, Math.min(1, (e.clientY - hy) / 400))];
  }

  async load() {
    const gl = this.gl;
    const data = await (await fetch(this.base + 'guy.json')).json();
    this.bones = data.bones.map(b => ({ name: b.name, parent: b.parent, local: new Float32Array(b.local), inv: new Float32Array(b.invBind) }));
    this.byName = {};
    this.bones.forEach((b, i) => this.byName[b.name] = i);
    this.rest = [];
    this.bones.forEach((b, i) => { this.rest[i] = b.parent >= 0 ? M4.mul(this.rest[b.parent], b.local) : b.local; });
    this.restQ = this.rest.map(m => Q.fromMat(m));
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(o); return o; };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
    this.prog = p;
    this.loc = {};
    for (const n of ['aP', 'aN', 'aU', 'aB', 'aW', 'aH']) this.loc[n] = gl.getAttribLocation(p, n);
    for (const n of ['uBones', 'uVP', 'uModel', 'uSnap', 'uTex', 'uTint', 'uUnlit', 'uShine', 'uHandOnly']) this.loc[n] = gl.getUniformLocation(p, n);
    this.body = this.mesh(data.pos, data.nor, data.uv, data.idx, data.bi, data.bw);
    const hs = [this.byName['hand.l'], this.byName['hand.r']], hw = [];
    for (let v = 0; v < data.bi.length / 4; v++) { let w = 0; for (let j = 0; j < 4; j++) if (hs.includes(data.bi[v * 4 + j])) w += data.bw[v * 4 + j]; hw.push(w); }
    this.body.h = this.gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.body.h); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(hw), gl.STATIC_DRAW);
    this.skinTex = await this.texFromUrl(this.base + 'guy.png', false);
    this.white = this.texFromCanvas(Object.assign(document.createElement('canvas'), { width: 2, height: 2 }), '#fff');

    const lens = (sx) => box(0.072, 0.036, 0.012, sx * 0.043, 0, 0);
    const shades = merge(lens(-1), lens(1), box(0.03, 0.01, 0.01, 0, 0.008, 0),
      box(0.008, 0.01, 0.12, -0.081, 0.006, -0.058), box(0.008, 0.01, 0.12, 0.081, 0.006, -0.058));
    this.shades = this.rigid(shades);
    this.shadesOff = M4.mul(this.invRest('head'), M4.fromQT([0, 0, 0, 1], [0, 1.703, 0.118]));

    this.pole = this.rigid(box(0.03, 0.95, 0.03, 0, 0.24, 0));
    this.board = this.rigid(merge(box(0.66, 0.34, 0.03, 0, 0.66, -0.02)));
    this.boardFace = this.rigid(quad(0.62, 0.30, 0.0));
    this.signCanvas = document.createElement('canvas');
    this.signCanvas.width = 256; this.signCanvas.height = 128;
    this.setDubs('');

    this.card = this.rigid(box(0.5, 0.26, 0.02));
    this.cardFace = this.rigid(quad(0.48, 0.24, 0));
    this.watch = this.rigid(box(0.04, 0.03, 0.035));
    this.watchOff = M4.mul(this.invRest('lowerArm.l'), M4.fromQT([0, 0, 0, 1], [0.76, 1.425, 0.035]));

    this.resize();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) requestAnimationFrame(this.loop); });
  }

  invRest(name) {
    const m = this.rest[this.byName[name]];
    const q = Q.conj(Q.fromMat(m));
    const r = M4.fromQT(q, [0, 0, 0]);
    const t = M4.pos(m);
    const it = [-(r[0] * t[0] + r[4] * t[1] + r[8] * t[2]), -(r[1] * t[0] + r[5] * t[1] + r[9] * t[2]), -(r[2] * t[0] + r[6] * t[1] + r[10] * t[2])];
    r[12] = it[0]; r[13] = it[1]; r[14] = it[2];
    return r;
  }

  mesh(P, N, U, I, B, W) {
    const gl = this.gl, buf = (d, T = Float32Array, k = gl.ARRAY_BUFFER) => { const b = gl.createBuffer(); gl.bindBuffer(k, b); gl.bufferData(k, new T(d), gl.STATIC_DRAW); return b; };
    return { p: buf(P), n: buf(N), u: buf(U), b: B ? buf(B) : null, w: W ? buf(W) : null, i: buf(I, Uint16Array, gl.ELEMENT_ARRAY_BUFFER), count: I.length };
  }

  rigid(g) { return this.mesh(g.P, g.N, g.U, g.I); }

  texFromCanvas(c, fill) {
    const gl = this.gl;
    if (fill) { const x = c.getContext('2d'); x.fillStyle = fill; x.fillRect(0, 0, c.width, c.height); }
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  texFromUrl(url, cors = true) {
    return new Promise((res, rej) => {
      const im = new Image();
      if (cors) im.crossOrigin = 'anonymous';
      im.onload = () => {
        const c = document.createElement('canvas');
        c.width = 256; c.height = 128;
        const x = c.getContext('2d');
        if (url.endsWith('guy.png')) { c.width = im.width; c.height = im.height; x.drawImage(im, 0, 0); }
        else {
          x.fillStyle = '#23261d'; x.fillRect(0, 0, 256, 128);
          const k = Math.min(240 / im.width, 116 / im.height);
          x.drawImage(im, 128 - im.width * k / 2, 64 - im.height * k / 2, im.width * k, im.height * k);
        }
        res(this.texFromCanvas(c));
      };
      im.onerror = rej;
      im.src = url;
    });
  }

  setDubs(text) {
    const c = this.signCanvas, x = c.getContext('2d');
    x.fillStyle = '#f2ead3'; x.fillRect(0, 0, 256, 128);
    x.strokeStyle = '#3a3a2a'; x.lineWidth = 6; x.strokeRect(3, 3, 250, 122);
    x.save(); x.translate(128, 58); x.rotate(-0.06);
    x.font = 'bold 64px Impact, "Arial Black", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 8; x.strokeStyle = '#1b1b12'; x.strokeText('DUBS', 0, 0);
    x.fillStyle = '#4fb33a'; x.fillText('DUBS', 0, 0);
    x.restore();
    if (text) {
      x.font = 'bold 26px Tahoma, Verdana, sans-serif'; x.textAlign = 'center'; x.fillStyle = '#2a6e1f';
      x.fillText(text, 128, 108);
    }
    if (this.signTex) this.gl.deleteTexture(this.signTex);
    this.signTex = this.texFromCanvas(c);
  }

  async hold(url, name) {
    let tex = null;
    if (url) { try { tex = await this.texFromUrl(url); } catch (e) { tex = null; } }
    if (!tex) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 128;
      const x = c.getContext('2d');
      x.fillStyle = '#2b2f24'; x.fillRect(0, 0, 256, 128);
      x.fillStyle = '#c7b98b'; x.font = 'bold 20px Tahoma, sans-serif'; x.textAlign = 'center';
      x.fillText((name || '???').slice(0, 24), 128, 70);
      tex = this.texFromCanvas(c);
    }
    if (this.heldTex) this.gl.deleteTexture(this.heldTex);
    this.heldTex = tex;
    this.set('hold');
  }

  set(state, hold) {
    if (state === this.state && state !== 'poke') return;
    if (this.state === 'dubs' && state !== 'dubs') this.glassesOff = performance.now() / 1000;
    this.prev = this.state;
    this.prevT = this.stateT;
    this.state = state;
    this.blend = 0;
    this.stateStart = performance.now() / 1000;
    if (state === 'dubs') this.burst();
    if (state === 'fail') this.say(['bruh', 'thats not it chief', 'nah that one\'s cooked', 'steam tax got us'][Math.random() * 4 | 0], 2400);
    clearTimeout(this.holdTimer);
    if (hold) this.holdTimer = setTimeout(() => this.set('idle'), hold);
  }

  poke() {
    const lines = ['bro stop clicking me', 'i\'m working here', 'you got money for this?', 'ow', 'one more and i\'m sending it all to cases'];
    this.say(lines[(this.pokes = (this.pokes || 0) + 1) % lines.length], 1800);
    const back = this.state === 'poke' ? this.prev : this.state;
    this.set('poke');
    this.prev = back;
    clearTimeout(this.pokeTimer);
    this.pokeTimer = setTimeout(() => this.set(back === 'poke' ? 'idle' : back), 1300);
  }

  say(text, ms = 2200) {
    this.bubble.textContent = text;
    this.bubble.classList.add('on');
    clearTimeout(this.sayTimer);
    this.sayTimer = setTimeout(() => this.bubble.classList.remove('on'), ms);
  }

  burst() {
    const w = this.fx.width, h = this.fx.height;
    const cols = ['#4fb33a', '#e8c547', '#d9d2b8', '#c9472b', '#7aa0c4'];
    for (let i = 0; i < 90; i++) this.confetti.push({ x: w * 0.5, y: h * 0.18, vx: (Math.random() - 0.5) * w * 1.6, vy: -Math.random() * h * 1.2, r: Math.random() * 6, c: cols[i % cols.length], life: 2 + Math.random() });
  }

  resize() {
    const r = this.host.getBoundingClientRect();
    if (!r.width) return;
    this.canvas.width = Math.max(1, Math.round(r.width / this.scale));
    this.canvas.height = Math.max(1, Math.round(r.height / this.scale));
    this.fx.width = Math.round(r.width / 2); this.fx.height = Math.round(r.height / 2);
  }

  pose(state, t) {
    const lk = this.look;
    const breathe = wave(t, 0.28) * 1.6;
    const sway = wave(t, 0.11) * 2;
    const arms = {
      'upperArm.l': [4 + breathe * 0.3, -8, -72 - breathe * 0.4], 'lowerArm.l': [0, -14, 0], 'hand.l': [0, 0, -4],
      chest: [2 + breathe, 0, sway * 0.4], hip: [0, 0, -sway * 0.5], neck: [0, 0, 0],
      head: [lk[1] * 18 - 2, lk[0] * 35, -sway * 0.6],
      'upperLeg.l': [0, 0, 1 + sway * 0.3], 'upperLeg.r': [0, 0, -1 + sway * 0.3], 'lowerLeg.l': [0, 0, 0], 'lowerLeg.r': [0, 0, 0]
    };
    let p, root = [0, 0, 0], turn = -18;
    if (state === 'idle') {
      p = mirror(arms);
      const blink = (t % 7) < 0.9 ? Math.sin((t % 7) / 0.9 * Math.PI) : 0;
      p.head = [p.head[0] - blink * 6, p.head[1] + blink * 10, p.head[2] + blink * 6];
      root = [sway * 0.004, 0, 0];
    } else if (state === 'loading') {
      const cyc = t % 6;
      const peek = cyc < 3.8 ? 1 : 0;
      const k = cyc < 0.5 ? ease(cyc / 0.5) : cyc < 3.8 ? 1 : cyc < 4.3 ? 1 - ease((cyc - 3.8) / 0.5) : 0;
      const tap = Math.max(0, wave(t, 2.2)) ;
      p = mirror(arms);
      const A = [[-35, -55, -78], [0, -85, 55], [0, 0, 0]];
      p['upperArm.l'] = [lerp(4, A[0][0], k), lerp(-8, A[0][1], k), lerp(-72, A[0][2], k)];
      p['lowerArm.l'] = [lerp(0, A[1][0], k), lerp(-14, A[1][1], k), lerp(0, A[1][2], k)];
      p['hand.l'] = [lerp(0, A[2][0], k), lerp(0, A[2][1], k), lerp(-4, A[2][2], k)];
      const shrug = cyc > 4.3 ? Math.sin((cyc - 4.3) / 1.7 * Math.PI) : 0;
      p['upperArm.r'] = [shrug * 10, shrug * 25, 72 - shrug * 30];
      p['lowerArm.r'] = [0, shrug * 70 + 14, 0];
      p.head = [lerp(lk[1] * 12, 28, k), lerp(lk[0] * 30, 18, k) + (1 - k) * wave(t, 0.5) * 10, lerp(0, 8, k) + shrug * 10];
      p.chest = [3 + breathe + k * 4, k * 6, shrug * 3];
      p['upperLeg.r'] = [-tap * 10, 0, -2];
      p['lowerLeg.r'] = [tap * 6, 0, 0];
      p['foot.r'] = [-tap * 18, 0, 0];
      root = [0, peek * wave(t, 2.2) * 0.003, 0];
      turn = -14;
    } else if (state === 'hold') {
      const H = [[-12, -26, -80], [0, -73, 26], [0, 0, 0]];
      const cy = t % 14;
      const seg = (a, b) => cy < a || cy > b ? 0 : Math.sin((cy - a) / (b - a) * Math.PI);
      const lookCard = seg(0, 3.2), around = seg(3, 6.6), bop = seg(6.4, 10.6), sigh = seg(10.4, 14);
      const beat = wave(t, 1.9);
      p = mirror({ ...arms, 'upperArm.l': [H[0][0] - sigh * 4, H[0][1], H[0][2]], 'lowerArm.l': H[1], 'hand.l': H[2] });
      p.chest = [2 + breathe + bop * Math.abs(beat) * 2 - sigh * 5, wave(t, 0.13) * 3, 0];
      p.head = [
        lk[1] * 8 + lookCard * 26 + around * wave(cy, 0.45) * 14 - sigh * 22 + bop * beat * 9,
        lk[0] * 18 + around * wave(cy, 0.3) * 50,
        bop * wave(t, 0.95) * 6 + around * 4
      ];
      const tap = bop * Math.max(0, beat);
      p['upperLeg.r'] = [-tap * 8, 0, -1];
      p['lowerLeg.r'] = [tap * 5, 0, 0];
      p['foot.r'] = [-tap * 20, 0, 0];
      p.hip = [0, 0, bop * wave(t, 0.95) * 2];
      root = [0, bop * Math.abs(beat) * 0.006 - sigh * 0.008, 0];
      turn = -14;
    } else if (state === 'dubs') {
      const s = t;
      const up = back(s / 0.55);
      const bob = Math.abs(wave(s, 1.6)) * (s > 0.5 ? 1 : 0);
      p = mirror(arms);
      p['upperArm.l'] = [-8, -14, lerp(-72, 18, up)];
      p['lowerArm.l'] = [0, lerp(-14, -10, up), lerp(0, 55, up)];
      p['hand.l'] = [0, 0, 0];
      const pt = back((s - 0.25) / 0.5);
      p['upperArm.r'] = [lerp(4, -70, pt), lerp(8, 20, pt), lerp(72, -20, pt) + wave(s, 3.2) * 6 * pt];
      p['lowerArm.r'] = [0, lerp(14, 10, pt), lerp(0, -12, pt)];
      p['hand.r'] = [0, 0, 0];
      p.chest = [lerp(2, -6, up) + bob * 3, 8, -4];
      p.head = [-8 + bob * 10, 16 + lk[0] * 10, -10 + wave(s, 1.6) * 4];
      p['upperLeg.l'] = [-bob * 6, 0, 3];
      p['upperLeg.r'] = [-bob * 6, 0, -3];
      p['lowerLeg.l'] = [bob * 12, 0, 0];
      p['lowerLeg.r'] = [bob * 12, 0, 0];
      root = [0, s < 0.6 ? Math.sin(Math.min(1, s / 0.6) * Math.PI) * 0.06 : -bob * 0.012, 0];
      turn = -10;
    } else if (state === 'fail') {
      const s = t;
      const f = ease(s / 0.5);
      p = mirror(arms);
      p['upperArm.r'] = [lerp(4, -60, f), lerp(8, 50, f), lerp(72, 30, f)];
      p['lowerArm.r'] = [0, lerp(14, 140, f), lerp(0, -10, f)];
      p['hand.r'] = [0, 0, lerp(0, -20, f)];
      p.chest = [lerp(2, 16, f) + breathe, 0, 0];
      p.neck = [lerp(0, 10, f), 0, 0];
      p.head = [lerp(0, 22, f), wave(s, 0.9) * 14 * f, 0];
      p['upperArm.l'] = [4, -8, -80];
      root = [0, -f * 0.01, 0];
    } else if (state === 'poke') {
      const s = t;
      const j = Math.sin(Math.min(1, s / 0.45) * Math.PI);
      const fl = s < 1.1 ? 1 : 0;
      p = mirror(arms);
      p['upperArm.l'] = [0, 0, -72 + j * 110 + wave(s, 4) * 20 * fl];
      p['upperArm.r'] = [0, 0, 72 - j * 110 - wave(s, 4, 1) * 20 * fl];
      p['lowerArm.l'] = [0, -30 * j, 0];
      p['lowerArm.r'] = [0, 30 * j, 0];
      p.head = [-10 * j, wave(s, 2.5) * 20, 0];
      p.chest = [-6 * j, 0, wave(s, 3) * 5];
      p['upperLeg.l'] = [-j * 30, 0, 6 * j];
      p['lowerLeg.l'] = [j * 50, 0, 0];
      root = [0, j * 0.12, 0];
      turn = -18 + wave(s, 1.2) * 25 * fl;
    }
    return { p, root, turn };
  }

  loop(now) {
    if (document.hidden) return;
    requestAnimationFrame(this.loop);
    now /= 1000;
    const dt = Math.min(0.05, now - (this.last || now));
    this.last = now;
    this.look[0] += (this.lookT[0] - this.look[0]) * Math.min(1, dt * 6);
    this.look[1] += (this.lookT[1] - this.look[1]) * Math.min(1, dt * 6);
    this.blend = Math.min(1, this.blend + dt / 0.3);
    const st = now - (this.stateStart || this.t0);
    const timeFor = s => (s === 'idle' || s === 'loading' || s === 'hold') ? now - this.t0 : st;
    let cur = this.pose(this.state, timeFor(this.state));
    if (this.blend < 1 && this.prev) {
      const old = this.pose(this.prev, this.prev === this.state ? st : (now - this.t0));
      const k = ease(this.blend), p = {};
      for (const n of new Set([...Object.keys(old.p), ...Object.keys(cur.p)])) {
        const a = old.p[n] || [0, 0, 0], b = cur.p[n] || [0, 0, 0];
        p[n] = [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
      }
      cur = { p, root: cur.root.map((v, i) => lerp(old.root[i], v, k)), turn: lerp(old.turn, cur.turn, k) };
    }
    if (this.state === 'dubs') this.glasses = Math.min(1, st / 0.7);
    else if (this.glasses > 0) this.glasses = Math.max(0, this.glasses - dt * 2.5);
    this.zoom = Math.max(0, Math.min(1, (this.zoom || 0) + (this.state === 'hold' ? dt : -dt) * 2.2));
    this.wide = Math.max(0, Math.min(1, (this.wide || 0) + (this.state === 'dubs' ? dt : -dt) * 2.5));
    this.draw(cur, now, st);
    this.drawFx(dt);
  }

  skeleton(cur) {
    const W = [];
    this.bones.forEach((b, i) => {
      let L = b.local;
      const e = cur.p[b.name];
      if (e) {
        const q = Q.euler(e);
        const rq = this.restQ[i];
        const lq = Q.mul(Q.conj(rq), Q.mul(q, rq));
        L = M4.mul(L, M4.fromQT(lq, [0, 0, 0]));
      }
      if (b.parent < 0) L = M4.mul(M4.fromQT([0, 0, 0, 1], cur.root), L);
      W[i] = b.parent >= 0 ? M4.mul(W[b.parent], L) : L;
    });
    return W;
  }

  bind(m) {
    const gl = this.gl, L = this.loc;
    const at = (loc, buf, n) => { if (loc < 0) return; if (buf) { gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0); } else gl.disableVertexAttribArray(loc); };
    at(L.aP, m.p, 3); at(L.aN, m.n, 3); at(L.aU, m.u, 2); at(L.aB, m.b, 4); at(L.aW, m.w, 4); at(L.aH, m.h, 1);
    if (!m.h && L.aH >= 0) gl.vertexAttrib1f(L.aH, 0);
    if (!m.b) { gl.vertexAttrib4f(L.aB, 0, 0, 0, 0); gl.vertexAttrib4f(L.aW, 1, 0, 0, 0); }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.i);
  }

  drawRigid(m, mat, tex, tint = [1, 1, 1, 1], unlit = 0, shine = 0) {
    const gl = this.gl, L = this.loc;
    this.bind(m);
    gl.uniformMatrix4fv(L.uBones, false, mat);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform4fv(L.uTint, tint);
    gl.uniform1f(L.uUnlit, unlit);
    gl.uniform1f(L.uShine, shine);
    gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
  }

  draw(cur, now, st) {
    const gl = this.gl, L = this.loc, c = this.canvas;
    gl.viewport(0, 0, c.width, c.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(this.prog);
    const asp = c.width / c.height;
    const fov = asp < 0.75 ? 0.5 / Math.max(0.55, asp / 0.75) : 0.5;
    const z = ease(this.zoom);
    const w = ease(this.wide);
    const VP = M4.mul(M4.persp(fov, asp, 0.1, 20), M4.look([lerp(0, 0.1, z), lerp(1.12, 1.38, z) + w * 0.3, lerp(5.2, 2.8, z) + w * 1.3], [lerp(0, 0.08, z), lerp(1.0, 1.2, z) + w * 0.3, 0], [0, 1, 0]));
    const model = M4.rotY(cur.turn * Math.PI / 180);
    gl.uniformMatrix4fv(L.uVP, false, VP);
    gl.uniform1f(L.uSnap, Math.min(c.width, c.height) * 0.35);
    gl.uniform1i(L.uTex, 0);
    gl.uniform1f(L.uHandOnly, 0);
    gl.activeTexture(gl.TEXTURE0);
    const W = this.skeleton(cur);
    const skin = new Float32Array(16 * 24);
    W.forEach((w, i) => skin.set(M4.mul(w, this.bones[i].inv), i * 16));
    gl.uniformMatrix4fv(L.uModel, false, model);
    this.drawShadow(VP, cur);
    gl.uniformMatrix4fv(L.uModel, false, model);
    this.bind(this.body);
    gl.uniformMatrix4fv(L.uBones, false, skin);
    gl.bindTexture(gl.TEXTURE_2D, this.skinTex);
    gl.uniform4fv(L.uTint, [1, 1, 1, 1]);
    gl.uniform1f(L.uUnlit, 0);
    gl.uniform1f(L.uShine, 0);
    gl.drawElements(gl.TRIANGLES, this.body.count, gl.UNSIGNED_SHORT, 0);

    const bw = n => W[this.byName[n]];
    if (this.glasses > 0) {
      const drop = this.state === 'dubs' ? (1 - back(this.glasses)) * 0.9 : 0;
      const fade = this.state === 'dubs' ? 1 : this.glasses;
      let m = M4.mul(bw('head'), this.shadesOff);
      if (drop) m = M4.mul(M4.fromQT(Q.euler([0, 0, drop * 40]), [0, drop, 0]), m);
      if (this.state !== 'dubs') m = M4.mul(M4.fromQT([0, 0, 0, 1], [0, (1 - fade) * -0.3, 0]), m);
      this.drawRigid(this.shades, m, this.white, [0.05, 0.05, 0.06, 1], 0, 1.4);
    }
    const dubsK = this.state === 'dubs' ? Math.min(1, st / 0.3) : this.prev === 'dubs' ? 1 - this.blend : 0;
    if (dubsK > 0.01) {
      const hp = M4.pos(bw('hand.l')), ep = M4.pos(bw('lowerArm.l'));
      const fl = Math.hypot(hp[0] - ep[0], hp[1] - ep[1], hp[2] - ep[2]);
      const palm = [0, 1, 2].map(i => hp[i] + (hp[i] - ep[i]) / fl * 0.055);
      const wob = wave(now, 1.6) * 4;
      const m = M4.fromQT(Q.euler([0, 8, wob - 4]), palm, dubsK);
      this.drawRigid(this.pole, m, this.white, [0.42, 0.3, 0.18, 1]);
      this.drawRigid(this.board, m, this.white, [0.25, 0.22, 0.16, 1]);
      const f = M4.mul(m, M4.fromQT([0, 0, 0, 1], [0, 0.66, 0.0]));
      this.drawRigid(this.boardFace, f, this.signTex, [1, 1, 1, 1], 0.55);
    }
    const holdK = this.state === 'hold' ? Math.min(1, st / 0.25) : this.prev === 'hold' ? 1 - this.blend : 0;
    if (holdK > 0.01 && this.heldTex) {
      const palm = n => {
        const hp = M4.pos(bw('hand.' + n)), ep = M4.pos(bw('lowerArm.' + n));
        const l = Math.hypot(hp[0] - ep[0], hp[1] - ep[1], hp[2] - ep[2]);
        return [0, 1, 2].map(i => hp[i] + (hp[i] - ep[i]) / l * 0.05);
      };
      const PL = palm('l'), PR = palm('r');
      let rt = [PL[0] - PR[0], PL[1] - PR[1], PL[2] - PR[2]];
      const span = Math.hypot(...rt); rt = rt.map(v => v / span);
      const tr = -cur.turn * Math.PI / 180;
      let fw = [Math.sin(tr) * 0.5, 0.15, Math.cos(tr)];
      const d = fw[0] * rt[0] + fw[1] * rt[1] + fw[2] * rt[2];
      fw = fw.map((v, i) => v - rt[i] * d);
      const fl = Math.hypot(...fw); fw = fw.map(v => v / fl);
      const up = [fw[1] * rt[2] - fw[2] * rt[1], fw[2] * rt[0] - fw[0] * rt[2], fw[0] * rt[1] - fw[1] * rt[0]];
      const c = [0, 1, 2].map(i => (PL[i] + PR[i]) / 2 + up[i] * 0.01 + fw[i] * 0.035);
      const sx = (span + 0.03) / 0.5 * holdK, k = holdK;
      const m = new Float32Array([rt[0] * sx, rt[1] * sx, rt[2] * sx, 0, up[0] * k, up[1] * k, up[2] * k, 0, fw[0] * k, fw[1] * k, fw[2] * k, 0, c[0], c[1], c[2], 1]);
      this.drawRigid(this.card, m, this.white, [0.16, 0.17, 0.13, 1]);
      this.drawRigid(this.cardFace, M4.mul(m, M4.fromQT([0, 0, 0, 1], [0, 0, 0.0115])), this.heldTex, [1, 1, 1, 1], 0.7);
      if (this.state === 'hold' && this.blend > 0.6) {
        gl.clear(gl.DEPTH_BUFFER_BIT);
        this.bind(this.body);
        gl.uniformMatrix4fv(L.uBones, false, skin);
        gl.bindTexture(gl.TEXTURE_2D, this.skinTex);
        gl.uniform4fv(L.uTint, [1, 1, 1, 1]);
        gl.uniform1f(L.uUnlit, 0);
        gl.uniform1f(L.uShine, 0);
        gl.uniform1f(L.uHandOnly, 1);
        gl.drawElements(gl.TRIANGLES, this.body.count, gl.UNSIGNED_SHORT, 0);
        gl.uniform1f(L.uHandOnly, 0);
      }
    }
    const loadK = this.state === 'loading' ? 1 : this.prev === 'loading' ? 1 - this.blend : 0;
    if (loadK > 0.01) this.drawRigid(this.watch, M4.mul(bw('lowerArm.l'), this.watchOff), this.white, [0.75, 0.68, 0.3, 1], 0, 1);
  }

  drawShadow(VP, cur) {
    if (!this.shadow) this.shadow = this.rigid({ P: [-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1], N: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], U: [0, 0, 1, 0, 1, 1, 0, 1], I: [0, 2, 1, 0, 3, 2] });
    if (!this.shadowTex) {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
      g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      this.shadowTex = this.texFromCanvas(c);
    }
    const gl = this.gl;
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    const k = 1 - Math.min(0.6, cur.root[1] * 5);
    this.gl.uniformMatrix4fv(this.loc.uModel, false, M4.id());
    const prog = this.gl.getUniformLocation(this.prog, 'uTint');
    this.bind(this.shadow);
    gl.uniformMatrix4fv(this.loc.uBones, false, M4.fromQT([0, 0, 0, 1], [0, 0.002, 0], 0.42 * k));
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.uniform4fv(prog, [1, 1, 1, 1]); gl.uniform1f(this.loc.uUnlit, 1); gl.uniform1f(this.loc.uShine, 0);
    this.fs || (this.fs = true);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    gl.depthMask(true); gl.disable(gl.BLEND);
  }

  drawFx(dt) {
    const x = this.fx.getContext('2d'), w = this.fx.width, h = this.fx.height;
    x.clearRect(0, 0, w, h);
    if (!this.confetti.length) return;
    this.confetti = this.confetti.filter(p => (p.life -= dt) > 0);
    for (const p of this.confetti) {
      p.vy += h * 1.4 * dt; p.vx *= 0.985;
      p.x += p.vx * dt * 0.5; p.y += p.vy * dt * 0.5; p.r += dt * 8;
      x.save(); x.translate(p.x | 0, p.y | 0); x.rotate(p.r);
      x.fillStyle = p.c; x.fillRect(-3, -1.5, 6, 3);
      x.restore();
    }
  }
}
