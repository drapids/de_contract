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
  nlerp(a, b, t) {
    const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3], s = d < 0 ? -1 : 1;
    const o = [0, 1, 2, 3].map(i => a[i] * (1 - t) + b[i] * s * t);
    const l = Math.hypot(...o);
    return o.map(v => v / l);
  },
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
uniform sampler2D uTex; uniform vec4 uTint; uniform float uUnlit; uniform float uShine; uniform float uHandOnly; uniform float uHole;
varying vec3 vN; varying vec2 vU; varying vec3 vW; varying float vHand;
void main() {
  vec4 t = texture2D(uTex, vU) * uTint;
  if (uHole > 0.5) { gl_FragColor = vec4(0.0); return; }
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

const pick = a => a[Math.random() * a.length | 0];
const GUN_OFF = new Float32Array([0, 0.115, 0, 0, 0, 0, 0.115, 0, 0.115, 0, 0, 0, 0, 0.156, -0.086, 1]);
const LINES = {
  poke: ['bro stop clicking me', 'i\'m working here', 'you got money for this?', 'ow', 'one more and i\'m sending it all to cases'],
  fail: ['bruh', 'thats not it chief', 'nah that one\'s cooked', 'steam tax got us'],
  phone: ['yeah my guy found a trade up... nah not guaranteed', 'hello? yeah im still waiting on prices', 'bro the float is 0.07 exactly. exactly.', 'ok bye. no YOU hang up', 'tell valve i said hi']
};
const CFG = {
  idle: { clip: 'Idle_Loop', look: 1 },
  loading: { clip: 'Fixing_Kneeling', look: 0.2, turn: -30 },
  phone: { clip: 'Idle_TalkingPhone_Loop', look: 0.3 },
  fold: { clip: 'Idle_FoldArms_Loop', look: 0.8 },
  no: { clip: 'Idle_No_Loop', look: 0.3 },
  push: { clip: 'Push_Loop', turn: -90, move: [0, 0.62] },
  walkin: { clip: 'Walk_Loop', turn: -90, move: [-2.6, 0.93] },
  sitdown: { clip: 'Sitting_Enter', once: true, next: 'sit' },
  sit: { clip: 'Sitting_Idle_Loop', look: 0.6 },
  standup: { clip: 'Sitting_Exit', once: true, next: 'idle' },
  hit: { clip: 'Hit_Head', once: true, next: 'back', again: true, hold: 0.2 },
  roll: { clip: 'Roll', once: true, next: 'idle', turn: -80 },
  pickup: { clip: 'PickUp_Table', once: true, next: 'hold' },
  dance: { clip: 'Dance_Loop', look: 0.2 },
  bounce: { clip: 'Billy_Bounce', look: 0, plant: true },
  yes: { clip: 'Yes', once: true, next: 'idle' },
  sprint: { clip: 'Sprint_Loop', look: 0 },
  walkhome: { clip: 'Walk_Loop', look: 0 },
  aim: { clip: 'Pistol_Aim_Neutral', look: 0 },
  shoot: { clip: 'Pistol_Shoot', once: true, next: 'aim', again: true },
  knock: { clip: 'Hit_Knockback', once: true, next: 'down' },
  down: { clip: 'Hit_Knockback', look: 0, freeze: true },
  getup: { clip: 'LayToIdle', once: true, next: 'idle' },
  shock: { clip: 'Idle_No_Loop', look: 0.2 },
  scared: { clip: 'Hit_Head', once: true, next: 'shock' },
  defuse: { clip: 'Fixing_Kneeling', look: 0, turn: 0 },
  rise: { clip: 'Sitting_Exit', once: true, next: 'yes', turn: 0 }
};

export class Guy {
  constructor(host, opts = {}) {
    this.host = host;
    this.base = opts.base || 'assets/';
    this.loader = opts.loader || null;
    this.emit = opts.onEvent || (() => {});
    this.scale = opts.pixel || 2;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'guy-gl';
    this.fx = document.createElement('canvas');
    this.fx.className = 'guy-fx';
    this.bubble = document.createElement('div');
    this.bubble.className = 'guy-bubble';
    this.card2d = document.createElement('div');
    this.card2d.className = 'guy-card';
    host.append(this.card2d, this.canvas, this.fx, this.bubble);
    this.gl = this.canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false });
    this.state = 'idle';
    this.fps = opts.fps ?? 15;
    this.pos = [0, 0, 0];
    this.damp = opts.damp ?? 0.65;
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
    document.addEventListener('click', e => {
      if (!this.hit || this.cineK > 0.1 || e.target.closest('button, a, input, select, textarea, label, .tu, .stone, .item, .dlg, .key')) return;
      const h = this.hit;
      if (e.clientX > h.x0 && e.clientX < h.x1 && e.clientY > h.y0 && e.clientY < h.y1) this.poke();
    });
    document.addEventListener('pointermove', e => {
      const h = this.hit; if (!h) return;
      document.body.classList.toggle('over-guy', e.clientX > h.x0 && e.clientX < h.x1 && e.clientY > h.y0 && e.clientY < h.y1 && !e.target.closest('button, a, input, select, .tu, .dlg'));
    });
    for (const ev of ['pointermove', 'keydown', 'scroll', 'pointerdown']) window.addEventListener(ev, () => this.wake(), { passive: true });
    new ResizeObserver(() => this.resize()).observe(host);
  }

  aim(e) {
    const hb = this.hit ? [(this.hit.x0 + this.hit.x1) / 2, this.hit.y0 + 30] : [innerWidth * 0.8, innerHeight * 0.3];
    const hx = hb[0], hy = hb[1];
    this.lookT = [Math.max(-1, Math.min(1, (e.clientX - hx) / 500)), Math.max(-1, Math.min(1, (e.clientY - hy) / 400))];
  }

  async load() {
    const gl = this.gl;
    const [data, clips] = await Promise.all([this.json(this.base + 'guy.json'), this.json(this.base + 'anims.json').catch(() => ({}))]);
    this.clips = clips;
    for (const c of Object.values(clips)) {
      c.mean = {};
      for (const k in c.b) {
        const v = c.b[k], m = [0, 0, 0, 0], ref = v.slice(0, 4);
        for (let f = 0; f < c.n; f++) { const q = v.slice(f * 4, f * 4 + 4), sg = q[0] * ref[0] + q[1] * ref[1] + q[2] * ref[2] + q[3] * ref[3] < 0 ? -1 : 1; for (let i = 0; i < 4; i++) m[i] += q[i] * sg; }
        const l = Math.hypot(...m); c.mean[k] = m.map(x => x / l);
      }
      c.rmean = [0, 1, 2].map(i => { let a = 0; for (let f = 0; f < c.n; f++) a += c.r[f * 3 + i]; return a / c.n; });
    }
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(o); return o; };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
    this.prog = p;
    this.loc = {};
    for (const n of ['aP', 'aN', 'aU', 'aB', 'aW', 'aH']) this.loc[n] = gl.getAttribLocation(p, n);
    for (const n of ['uBones', 'uVP', 'uModel', 'uSnap', 'uTex', 'uTint', 'uUnlit', 'uShine', 'uHandOnly', 'uHole']) this.loc[n] = gl.getUniformLocation(p, n);
    this.baseRig = await this.makeRig(data, this.base + 'guy.png');
    this.applyRig(this.baseRig);
    this.white = this.texFromCanvas(Object.assign(document.createElement('canvas'), { width: 2, height: 2 }), '#fff');

    const lens = (sx) => box(0.072, 0.036, 0.012, sx * 0.043, 0, 0);
    const shades = merge(lens(-1), lens(1), box(0.03, 0.01, 0.01, 0, 0.008, 0),
      box(0.008, 0.01, 0.12, -0.081, 0.006, -0.058), box(0.008, 0.01, 0.12, 0.081, 0.006, -0.058));
    this.shades = this.rigid(shades);
    
    this.pole = this.rigid(box(0.03, 0.95, 0.03, 0, 0.24, 0));
    this.board = this.rigid(merge(box(0.66, 0.34, 0.03, 0, 0.66, -0.02)));
    this.boardFace = this.rigid(quad(0.62, 0.30, 0.0));
    this.signCanvas = document.createElement('canvas');
    this.signCanvas.width = 256; this.signCanvas.height = 128;
    this.setDubs('');

    this.card = this.rigid(box(0.5, 0.26, 0.02));
    this.cardFace = this.rigid(quad(0.48, 0.24, 0));
    this.watch = this.rigid(box(0.04, 0.03, 0.035));
    
    this.phone = this.rigid(merge(box(0.055, 0.16, 0.035), box(0.01, 0.11, 0.01, 0.017, 0.13, -0.005), box(0.016, 0.016, 0.016, 0.017, 0.19, -0.005)));
    this.phoneFace = this.rigid(quad(0.048, 0.15, 0.0181));
    this.phoneTex = this.texFromCanvas(this.paint(64, 192, x => {
      x.fillStyle = '#2b2b29'; x.fillRect(0, 0, 64, 192);
      x.fillStyle = '#9fb46a'; x.fillRect(8, 12, 48, 34);
      x.fillStyle = '#2f3a1c'; x.font = 'bold 11px monospace'; x.fillText('DE_C', 14, 33);
      x.fillStyle = '#6d6d68';
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) x.fillRect(9 + c * 17, 62 + r * 24, 13, 15);
    }));
    this.crate = this.rigid(box(0.62, 0.5, 0.5));
    this.bigCrate = this.rigid(box(0.8, 1.15, 0.7));
    this.crateTex = this.texFromCanvas(this.paint(128, 128, x => {
      x.fillStyle = '#8a6a3c'; x.fillRect(0, 0, 128, 128);
      x.fillStyle = '#6f5430'; for (let i = 0; i < 128; i += 21) x.fillRect(0, i, 128, 3);
      x.strokeStyle = '#4e3a20'; x.lineWidth = 8; x.strokeRect(4, 4, 120, 120);
      x.fillStyle = 'rgba(30,22,10,.8)'; x.font = 'bold 17px Impact, sans-serif'; x.textAlign = 'center'; x.fillText('CONTRACT', 64, 70);
    }));
    this.machine = this.rigid(merge(box(0.34, 0.24, 0.26, 0, 0.12, 0), box(0.02, 0.18, 0.02, 0.12, 0.33, -0.08)));
    this.machineFace = this.rigid(quad(0.26, 0.15, 0.136));
    this.machineCanvas = this.paint(96, 64, () => {});
    this.machineTex = this.texFromCanvas(this.machineCanvas);
    try {
      const g = await fetch(this.base + 'revolver.json').then(r => r.json());
      this.gun = this.mesh(g.pos, g.nor, g.uv, g.idx);
      this.gunTex = await this.texFromUrl(this.base + 'revolver.png', false);
    } catch (e) { this.gun = null; }
    this.spookRig = { ...this.baseRig, tint: [0.75, 0.9, 1.0, 0.5], ghost: true };
    try {
      const sp = await this.json(this.base + 'specter.json');
      this.spookRig = { ...(await this.makeRig(sp, this.base + 'specter.png')), tint: [1, 1, 1, sp.alpha ?? 0.92], ghost: false };
    } catch (e) {}
    this.spook = { on: false, x: 1.6, z: -0.2, turn: -90, clip: 'Zombie_Idle_Loop', t0: 0, alpha: 1, flick: 0 };
    this.resize();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) requestAnimationFrame(this.loop); });
  }

  async json(url) {
    if (this.loader) return this.loader(url, 'json');
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + ' ' + r.status);
    return r.json();
  }

  async imgUrl(url) {
    return this.loader ? this.loader(url, 'img') : url;
  }

  async makeRig(data, texUrl) {
    const gl = this.gl;
    const bones = data.bones.map(b => ({ name: b.name, parent: b.parent, local: new Float32Array(b.local), inv: new Float32Array(b.invBind) }));
    const byName = {};
    bones.forEach((b, i) => byName[b.name] = i);
    const rest = [];
    bones.forEach((b, i) => { rest[i] = b.parent >= 0 ? M4.mul(rest[b.parent], b.local) : b.local; });
    const body = this.mesh(data.pos, data.nor, data.uv, data.idx, data.bi, data.bw);
    const hs = [byName['hand.l'], byName['hand.r']], hw = [];
    for (let v = 0; v < data.bi.length / 4; v++) { let w = 0; for (let j = 0; j < 4; j++) if (hs.includes(data.bi[v * 4 + j])) w += data.bw[v * 4 + j]; hw.push(w); }
    body.h = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, body.h); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(hw), gl.STATIC_DRAW);
    const tex = await this.texFull(await this.imgUrl(texUrl));
    const pos = n => M4.pos(rest[byName[n]]);
    return { bones, byName, rest, restQ: rest.map(m => Q.fromMat(m)), body, tex, hip: data.hip || pos('hip')[1], eyes: data.eyes || [0, 1.703, 0.106], pos };
  }

  applyRig(r) {
    this.rig = r;
    Object.assign(this, { bones: r.bones, byName: r.byName, rest: r.rest, restQ: r.restQ, body: r.body, skinTex: r.tex });
    this.shadesOff = this.phoneOff = this.watchOff = this.gunOff = null;
  }

  rebase(bone, worldOrange) {
    const b = this.baseRig, r = this.rig;
    const d = [0, 1, 2].map(i => r.pos(bone)[i] - b.pos(bone)[i]);
    return M4.mul(this.invRest(bone), M4.mul(M4.fromQT([0, 0, 0, 1], d), worldOrange));
  }

  async setSkin(name) {
    this.skins ||= {};
    if (name === 'orange' || !name) { this.applyRig(this.baseRig); return; }
    if (!this.skins[name]) {
      const data = await this.json(this.base + 'agents/' + name + '.json');
      this.skins[name] = await this.makeRig(data, this.base + 'agents/' + name + '.png');
    }
    this.applyRig(this.skins[name]);
  }

  async setGhost(name) {
    if (!name) return;
    this.skins ||= {};
    if (!this.skins[name]) {
      const data = await this.json(this.base + 'agents/' + name + '.json');
      this.skins[name] = await this.makeRig(data, this.base + 'agents/' + name + '.png');
    }
    const r = this.skins[name];
    this.spookRig = { ...r, tint: [0.8, 0.92, 1.0, 0.55], ghost: true };
  }

  texFull(url) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
        c.getContext('2d').drawImage(im, 0, 0);
        res(this.texFromCanvas(c));
      };
      im.onerror = rej;
      im.src = url;
    });
  }

  paint(w, h, f) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    f(c.getContext('2d'));
    return c;
  }

  invRestOf2(rig, name) {
    const m = rig.rest[rig.byName[name]];
    const q = Q.conj(Q.fromMat(m)), r = M4.fromQT(q, [0, 0, 0]), t = M4.pos(m);
    r[12] = -(r[0] * t[0] + r[4] * t[1] + r[8] * t[2]); r[13] = -(r[1] * t[0] + r[5] * t[1] + r[9] * t[2]); r[14] = -(r[2] * t[0] + r[6] * t[1] + r[10] * t[2]);
    return r;
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

  async hold(url, name, meta = {}) {
    this.card2d.innerHTML = url ? `<img src="${url.replace(/"/g, '')}" alt="">` : '';
    this.card2d.dataset.name = name || '';
    this.heldTex = this.white;
    this.holdMeta = meta;
    this.set('hold');
    this.verdictSaid = false;
  }

  terminal(on, title = '') {
    if (on) {
      this.cine = true; this.cineMode = 'term'; this.cineCam = null; this.termLines = [title || 'de_contract terminal']; this.termDirty = true;
      this.preCine = this.state === 'type' ? 'idle' : this.state;
      this.sceneTurn = 0;
      this.set('type');
      document.body.classList.add('cinema');
    } else {
      this.cine = false;
      document.body.classList.remove('cinema');
      this.sceneTurn = null;
    }
  }

  log(line) {
    if (!this.termLines) this.termLines = [];
    this.termLines.push(line);
    this.termLines = this.termLines.slice(-9);
    this.termDirty = true;
    window.dispatchEvent(new CustomEvent('dc:termlog', { detail: line }));
  }

  paintTerm(now) {
    const c = this.termCanvas || (this.termCanvas = this.paint(256, 192, () => {}));
    const x = c.getContext('2d');
    x.fillStyle = '#071107'; x.fillRect(0, 0, 256, 192);
    x.fillStyle = '#62e062'; x.font = 'bold 13px monospace';
    (this.termLines || []).forEach((l, i) => x.fillText(String(l).slice(0, 30), 8, 20 + i * 19));
    if (Math.floor(now * 2) % 2) x.fillRect(8 + Math.min(29, String(this.termLines?.at(-1) || '').length) * 7.8, 6 + ((this.termLines?.length || 1) - 1) * 19 + 4, 7, 13);
    x.fillStyle = 'rgba(0,0,0,.25)'; for (let y = 0; y < 192; y += 3) x.fillRect(0, y, 256, 1);
    if (!this.termTex) this.termTex = this.texFromCanvas(c);
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.termTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  }

  drawTerminal(now, bw) {
    if (!this.desk) {
      this.desk = this.rigid(merge(box(1.0, 0.05, 0.62, 0, 0, 0), box(0.05, 1.4, 0.05, -0.45, -0.7, -0.27), box(0.05, 1.4, 0.05, 0.45, -0.7, -0.27), box(0.05, 1.4, 0.05, -0.45, -0.7, 0.27), box(0.05, 1.4, 0.05, 0.45, -0.7, 0.27)));
      this.crt = this.rigid(merge(box(0.5, 0.42, 0.42, 0, 0.21, 0), box(0.38, 0.3, 0.2, 0, 0.21, -0.3)));
      this.crtFace = this.rigid(quad(0.42, 0.32, 0.228));
      this.keys = this.rigid(box(0.46, 0.03, 0.16));
    }
    const pl = M4.pos(bw('hand.l')), pr = M4.pos(bw('hand.r'));
    const ky = Math.min(pl[1], pr[1]) - 0.04, kz = (pl[2] + pr[2]) / 2 + 0.02;
    this.deskY ??= ky - 0.03; this.deskZ ??= kz + 0.12;
    const dy = this.deskY, dz = this.deskZ;
    this.drawRigid(this.desk, M4.fromQT([0, 0, 0, 1], [0, dy, dz]), this.crateTex, [0.8, 0.7, 0.6, 1]);
    this.drawRigid(this.keys, M4.fromQT([0, 0, 0, 1], [0, dy + 0.04, dz - 0.14]), this.white, [0.55, 0.53, 0.46, 1]);
    const cm = M4.mul(M4.fromQT([0, 0, 0, 1], [-0.28, dy + 0.03, dz + 0.36]), M4.rotY(Math.PI - 0.75));
    this.drawRigid(this.crt, cm, this.white, [0.62, 0.6, 0.52, 1]);
    if (this.termDirty || !this.tt || now - this.tt > 0.5) { this.tt = now; this.termDirty = false; this.paintTerm(now); }
    this.drawRigid(this.crtFace, M4.mul(cm, M4.fromQT([0, 0, 0, 1], [0, 0.21, 0])), this.termTex, [1, 1, 1, 1], 1);
  }

  defuse(on) {
    if (on) {
      this.cine = true; this.cineMode = 'defuse';
      this.cineCam = { eye: [1.35, 0.42, 1.75], tgt: [0.05, 0.55, 0.35], shift: 0.32 };
      this.locked = true; this.sceneTurn = 0; this.pos = [0, 0, 0];
      this.c4 = { text: '', on: true, t0: this.now || 0 };
      this.set('defuse');
      document.body.classList.add('cinema');
    } else {
      this.c4 = null;
      this.cine = false; this.cineMode = null; this.cineCam = null;
      this.locked = false; this.sceneTurn = null;
      document.body.classList.remove('cinema');
      this.set('idle');
    }
  }

  flinch() { this.flinchT = this.now; }

  drawC4(now) {
    if (!this.c4mesh) {
      this.c4mesh = this.rigid(merge(box(0.08, 0.05, 0.22, -0.1, 0.025, -0.02), box(0.08, 0.05, 0.22, 0, 0.025, -0.02), box(0.08, 0.05, 0.22, 0.1, 0.025, -0.02), box(0.32, 0.012, 0.02, 0, 0.03, 0.04), box(0.32, 0.012, 0.02, 0, 0.03, -0.08)));
      this.c4panel = this.rigid(box(0.22, 0.13, 0.025));
      this.c4face = this.rigid(quad(0.2, 0.11, 0));
      this.c4canvas = this.paint(128, 72, () => {});
      this.c4tex = this.texFromCanvas(this.c4canvas);
    }
    const C = this.c4, el = now - C.t0;
    const period = Math.max(0.22, 1.1 - el / 90);
    const led = (el % period) < 0.08;
    if (led && !this.ledOn) this.emit('beep');
    this.ledOn = led;
    const x = this.c4canvas.getContext('2d');
    x.fillStyle = '#26301f'; x.fillRect(0, 0, 128, 72);
    x.fillStyle = C.bad ? '#5a1d16' : '#7c9a52'; x.fillRect(6, 6, 116, 26);
    x.fillStyle = '#10180a'; x.font = 'bold 16px monospace';
    x.fillText((C.text ? '*'.repeat(Math.min(10, C.text.length)) : '_______').padEnd(10, ' '), 12, 25);
    x.fillStyle = '#555'; for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) x.fillRect(8 + c * 19, 40 + r * 15, 14, 11);
    x.fillStyle = led ? '#ff3b2b' : '#4a120d'; x.beginPath(); x.arc(116, 46, 6, 0, 7); x.fill();
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.c4tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.c4canvas);
    const m = M4.mul(M4.fromQT([0, 0, 0, 1], [0.05, 0.0, 0.62], 1.5), M4.rotY(0.5));
    this.drawRigid(this.c4mesh, m, this.white, [0.72, 0.62, 0.42, 1]);
    const pm = M4.mul(m, M4.fromQT(Q.euler([-55, 0, 0]), [0, 0.085, 0.03]));
    this.drawRigid(this.c4panel, pm, this.white, [0.2, 0.21, 0.18, 1], 0, 0.4);
    this.drawRigid(this.c4face, M4.mul(pm, M4.fromQT([0, 0, 0, 1], [0, 0, 0.0135])), this.c4tex, [1, 1, 1, 1], 0.9);
  }

  verdict() {
    const m = this.holdMeta || {}, n = (this.card2d.dataset.name || '').toLowerCase();
    if (n.includes('★')) return pick(['oh thats a KNIFE knife', 'imagine pulling this', 'yeah i want this one']);
    if (m.profit > 0) return pick(['clean. and it prints', 'this ones free money', 'look at it. LOOK at it']);
    if (m.profit < 0) return pick(['kinda mid ngl', 'not worth it bro', 'ehh. pass']);
    if (m.tier >= 5) return pick(['red skin red skin', 'thats a nice one', 'ok this is fire']);
    return pick(['solid', 'its a skin i guess', 'clean', 'id run it']);
  }

  set(state, hold) {
    if (state === this.state && !CFG[state]?.again) return;
    this.prev = this.state;
    this.state = state;
    this.blend = 0;
    this.stateStart = performance.now() / 1000;
    this.active = performance.now();
    if (state === 'dubs') { this.burst(); this.emit('dubs'); }
    if (state === 'fail') this.emit('fail');
    if (state === 'hit') this.emit('poke');
    if (state === 'push') this.emit('push');
    if (['fold', 'phone', 'watch', 'no'].includes(state)) this.emit('idle');
    if (state === 'fail') this.say(pick(LINES.fail), 2400);
    if (state === 'phone') this.say(pick(LINES.phone), 3200);
    clearTimeout(this.holdTimer);
    if (hold) this.holdTimer = setTimeout(() => this.set('idle'), hold);
  }

  busy() { return this.locked || ['push', 'walkin', 'sitdown', 'standup', 'roll', 'pickup'].includes(this.state); }

  poke() {
    if (this.busy()) return;
    const now = performance.now();
    this.pokeLog = (this.pokeLog || []).filter(t => now - t < 3500).concat(now);
    if (this.state === 'sit') return this.set('standup');
    if (this.pokeLog.length >= 5) { this.pokeLog = []; this.say('ight im out', 1500); return this.set('roll'); }
    this.say(LINES.poke[(this.pokes = (this.pokes || 0) + 1) % LINES.poke.length], 1800);
    this.back = CFG[this.state]?.once ? this.back : this.state;
    this.set('hit');
  }

  push() { if (!this.busy()) this.set('push'); }

  tick(now, st) {
    const c = CFG[this.state];
    if (c?.once && this.clips[c.clip] && st > this.clips[c.clip].d + (c.hold || 0)) {
      const next = c.next === 'back' ? (this.back || 'idle') : c.next;
      this.set(next || 'idle');
    }
    if (this.state === 'push' && st > 5.5) this.set('walkin');
    if (this.state === 'walkin' && st > 2.8) this.set('idle');
    const quiet = performance.now() - (this.active || 0);
    if (this.state === 'hold' && st > 1.6 && !this.verdictSaid) { this.verdictSaid = true; this.say(this.verdict(), 2600); }
    if (this.state === 'hold' && st > 9 && !this.snatched) { this.snatched = true; if (Math.random() < 0.35) this.snatch(); }
    if (this.state !== 'hold') this.snatched = false;
    if (this.state === 'idle' && !this.locked) {
      if (quiet > 120000) this.set('sitdown');
      else if (st > (this.nextFidget ??= 14 + Math.random() * 14)) {
        this.nextFidget = 14 + Math.random() * 16;
        this.set(pick(['fold', 'phone', 'watch', 'no']), 0);
      }
    }
    if (['fold', 'phone', 'watch', 'no'].includes(this.state) && st > (this.state === 'phone' ? 11 : 6)) this.set('idle');
  }

  spookDo(clip, opts = {}) {
    Object.assign(this.spook, { clip, t0: this.now || 0, once: false, ...opts });
  }

  scene(variant, onDone) {
    const S = this.spook;
    this.locked = true;
    this.sceneT0 = this.now;
    this.sceneVariant = variant;
    this.sceneDone = onDone;
    Object.assign(S, { on: true, x: 1.75, z: -0.15, turn: -90, alpha: 1, vx: 0, gun: false, fade: 0, plant: false, stopAt: null });
    this.haunting = false; this.homeX = 0; this.homing = false;
    clearTimeout(this.peekTimer);
    this.spookDo('Zombie_Idle_Loop');
    this.pos = [0, 0, 0];
    this.vx = 0;
    this.set('idle');
    const T = [];
    const at = (t, f) => T.push({ t, f });
    at(0.1, () => { S.vx = -0.55; });
    at(0.9, () => { S.vx = 0; this.lookT = [1, -0.1]; this.lookLock = true; });
    at(1.7, () => { this.sceneTurn = 60; this.set('scared'); this.say('uh. hello?', 1500); });
    at(2.5, () => { this.spookDo('Zombie_Walk_Fwd_Loop'); S.vx = -0.32; });
    at(3.0, () => { this.sceneTurn = -90; this.set('sprint'); this.vx = -0.4; this.say('NOPE', 1200); });
    at(4.3, () => { this.vx = 0; this.sceneTurn = 90; this.set('aim'); this.armed = true; this.say('stay back im warning you', 1600); });
    if (variant === 'flip') {
      at(5.1, () => { S.vx = 0; this.spookDo('Zombie_Scratch', { once: true }); });
      at(5.6, () => { this.armed = false; S.gun = true; this.set('shock'); this.say('hey thats mine', 1400); });
      at(6.3, () => { this.spookDo('Pistol_Aim_Neutral'); });
      at(6.9, () => { this.spookDo('Pistol_Shoot', { once: true }); this.shot('spook'); this.set('knock'); });
      at(8.0, () => { S.gun = false; this.spookDo('Billy_Bounce', { plant: true }); });
    } else {
      for (const t of [5.0, 5.6, 6.2]) at(t, () => { this.set('shoot'); this.shot('guy'); });
      at(6.9, () => { S.vx = 0; this.spookDo('Billy_Bounce', { plant: true }); });
      at(7.4, () => { this.armed = false; this.set('shock'); this.say('bro its a ghost', 2200); });
      at(10.5, () => this.say('...is that billy bounce', 2200));
    }
    this.timeline = T.sort((a, b) => a.t - b.t);
  }

  endScene() {
    if (!this.spook.on) return;
    const S = this.spook;
    this.timeline = [];
    this.spookDo('Spell_Simple_Shoot', { once: true });
    S.vx = 0; S.fade = this.now;
    const down = this.state === 'down';
    this.set(down ? 'getup' : 'idle');
    this.armed = false;
    setTimeout(() => {
      S.on = false; this.locked = false; this.lookLock = false; this.sceneTurn = null;
      this.homing = true;
      this.sceneDone?.();
    }, down ? 2600 : 900);
  }

  shot(who) {
    this.emit('shot');
    this.shots = (this.shots || []).concat({ who, t: this.now });
    if (who === 'guy') this.spook.flick = this.now;
  }

  runScene(dt) {
    if (!this.spook.on && !this.homing) return;
    const S = this.spook;
    if (S.on && !this.locked) {
      S.x += (S.vx || 0) * dt;
      if (S.stopAt != null && S.vx < 0 && S.x < S.stopAt) { S.x = S.stopAt; S.vx = 0; }
    }
    if (S.on && this.locked) {
      const st = this.now - this.sceneT0;
      while (this.timeline?.length && this.timeline[0].t <= st) this.timeline.shift().f();
      S.x += (S.vx || 0) * dt;
      if (S.x < this.pos[0] + 0.55 && S.vx < 0 && this.sceneVariant !== 'flip') S.vx = 0;
      if (S.x < this.pos[0] + 0.85 && S.vx < 0 && this.sceneVariant === 'flip') S.vx = 0;
      this.pos[0] += (this.vx || 0) * dt;
    }
    if (this.homing) {
      const d = (this.homeX || 0) - this.pos[0];
      if (Math.abs(d) < 0.02) { this.pos[0] = this.homeX || 0; this.homing = false; if (this.state === 'walkhome') this.set('idle'); this.sceneTurn = null; }
      else {
        if (this.state !== 'walkhome' && this.state !== 'getup') { this.set('walkhome'); }
        if (this.state === 'walkhome') { this.sceneTurn = d > 0 ? 90 : -90; this.pos[0] += Math.sign(d) * Math.min(Math.abs(d), 0.9 * dt); }
      }
    }
  }

  peek() {
    const S = this.spook;
    if (S.on || this.locked || this.haunting) return;
    Object.assign(S, { on: true, x: 1.7, z: -0.3, turn: -90, vx: -0.4, fade: 0, gun: false, plant: false });
    this.spookDo('Zombie_Idle_Loop');
    this.peekT = this.now;
    clearTimeout(this.peekTimer);
    this.peekTimer = setTimeout(() => { if (this.haunting) return; S.vx = 0.5; setTimeout(() => { if (!this.locked && !this.haunting) S.on = false; }, 1600); }, 3200);
  }

  haunt(on) {
    const S = this.spook;
    if (this.locked) return;
    if (on) {
      clearTimeout(this.peekTimer);
      Object.assign(S, { on: true, x: 1.6, z: -0.4, turn: -70, vx: -0.6, fade: 0, gun: false, plant: false, stopAt: 0.55 });
      this.spookDo('Spell_Simple_Idle_Loop');
      this.haunting = true;
      this.homeX = -0.3;
      this.homing = true;
      setTimeout(() => { if (this.haunting) this.say(pick(['oh its HIS house', 'i dont like it here', 'why is it cold']), 2000); }, 1500);
    } else if (this.haunting) {
      this.haunting = false;
      S.fade = this.now;
      setTimeout(() => { if (!this.haunting && !this.locked) S.on = false; }, 800);
      this.homeX = 0;
      this.homing = true;
    }
  }

  cast(text) {
    if (!this.haunting) return;
    this.spookDo('Spell_Simple_Shoot', { once: true });
    clearTimeout(this.castTimer);
    this.castTimer = setTimeout(() => { if (this.haunting) this.spookDo('Spell_Simple_Idle_Loop'); }, 1100);
    if (text) this.say(text, 3200);
  }

  snatch() {
    const S = this.spook;
    if (S.on || this.locked || this.state !== 'hold') return;
    Object.assign(S, { on: true, x: 1.5, z: 0.05, turn: -90, vx: -0.9, fade: 0, gun: false, plant: false, stopAt: 0.75 });
    this.spookDo('Zombie_Walk_Fwd_Loop');
    setTimeout(() => { if (!S.on) return; S.vx = 0; this.spookDo('Zombie_Scratch', { once: true }); }, 850);
    setTimeout(() => { if (this.state === 'hold') this.say(pick(['HANDS OFF', 'get your own', 'nah this ones mine']), 1600); }, 1500);
    setTimeout(() => { S.turn = 90; S.vx = 1.2; this.spookDo('Zombie_Walk_Fwd_Loop'); }, 2400);
    setTimeout(() => { if (!this.locked && !this.haunting) S.on = false; }, 3800);
  }

  wake() {
    this.active = performance.now();
    if (this.state === 'sit') this.set('standup');
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
    for (let i = 0; i < 160; i++) {
      const side = i % 2 ? 1 : -1;
      this.confetti.push({ x: side > 0 ? w : 0, y: h * (0.75 + Math.random() * 0.2), vx: -side * (0.25 + Math.random() * 0.75) * w, vy: -(0.9 + Math.random() * 0.9) * h, r: Math.random() * 6, c: cols[i % cols.length], life: 2.6 + Math.random() * 1.4 });
    }
    for (let i = 0; i < 60; i++) this.confetti.push({ x: Math.random() * w, y: -10 - Math.random() * h * 0.3, vx: (Math.random() - 0.5) * 60, vy: Math.random() * 40, r: Math.random() * 6, c: cols[i % cols.length], life: 3 + Math.random() * 2 });
  }

  camera(asp) {
    const z = ease(this.zoom), w = ease(this.wide), k = ease(this.cineK || 0);
    const narrow = this.host.clientWidth < 900;
    const anchor = this.anchor ?? (narrow ? 0.62 : 0.66);
    const dist = (narrow ? 7.2 : 5.4) + w * 1.2 - z * 1.9;
    let eye = [this.pos[0] * 0, lerp(1.3, 1.45, z) + w * 0.25, dist];
    let tgt = [0, lerp(1.24, 1.3, z) + w * 0.25, 0];
    let shift = anchor;
    if (k > 0) {
      const c = this.cineCam || { eye: [1.55, 0.5, 0.8], tgt: [-0.05, 1.3, 0.3] };
      eye = eye.map((v, i) => lerp(v, c.eye[i], k));
      tgt = tgt.map((v, i) => lerp(v, c.tgt[i], k));
      shift = lerp(anchor, c.shift || 0, k);
    }
    const P = M4.persp(lerp(0.5, 0.95, k), asp, 0.05, 30);
    P[8] = -shift;
    return M4.mul(P, M4.look(eye, tgt, [0, 1, 0]));
  }

  screen(p) {
    const v = this.VP, x = v[0] * p[0] + v[4] * p[1] + v[8] * p[2] + v[12], y = v[1] * p[0] + v[5] * p[1] + v[9] * p[2] + v[13], w = v[3] * p[0] + v[7] * p[1] + v[11] * p[2] + v[15];
    const r = this.host.getBoundingClientRect();
    return [(x / w * 0.5 + 0.5) * r.width, (0.5 - y / w * 0.5) * r.height];
  }

  resize() {
    const r = this.host.getBoundingClientRect();
    if (!r.width) return;
    this.canvas.width = Math.max(1, Math.round(r.width / this.scale));
    this.canvas.height = Math.max(1, Math.round(r.height / this.scale));
    this.fx.width = Math.round(r.width / 2); this.fx.height = Math.round(r.height / 2);
  }

  clip(name, t, loop = true) {
    const c = this.clips[name];
    if (!c) return { p: {}, root: [0, 0, 0] };
    let f = t * 30;
    f = loop ? f % (c.n - 1) : Math.min(f, c.n - 1);
    const a = Math.floor(f), b = Math.min(a + 1, c.n - 1), u = f - a;
    const damp = loop ? this.damp : 1;
    const p = {};
    for (const k in c.b) {
      const v = c.b[k];
      const q = Q.nlerp(v.slice(a * 4, a * 4 + 4), v.slice(b * 4, b * 4 + 4), u);
      p[k] = damp < 1 ? Q.nlerp(c.mean[k], q, damp) : q;
    }
    const r = c.r, H = this.rig?.hip || 0.85;
    const root = [0, 1, 2].map(i => { const v = r[a * 3 + i] * (1 - u) + r[b * 3 + i] * u; return (c.rmean[i] + (v - c.rmean[i]) * damp) * H; });
    return { p, root, len: c.d };
  }

  look2(p, k = 1) {
    const lk = this.look;
    if (p.head) p.head = Q.mul(Q.euler([lk[1] * 14 * k, lk[0] * 30 * k, 0]), p.head.length === 4 ? p.head : Q.euler(p.head));
    return p;
  }

  pose(state, t) {
    if (state.startsWith('clip:')) {
      const c = this.clip(state.slice(5), t, !this.once);
      return { p: this.look2(c.p, 0.5), root: c.root, turn: -18, plant: state === 'clip:Billy_Bounce' };
    }
    const cf = CFG[state];
    if (cf && this.clips[cf.clip]) {
      const c = this.clip(cf.clip, cf.freeze ? 99 : t, !cf.once && !cf.freeze);
      const root = c.root.slice();
      if (cf.move) root[2] += cf.move[0] + cf.move[1] * t;
      if (state === 'defuse') {
        const cyc = t % 13;
        const sc = cyc > 3 && cyc < 5 ? Math.sin((cyc - 3) / 2 * Math.PI) : 0;
        const look = cyc > 7 && cyc < 10 ? Math.sin((cyc - 7) / 3 * Math.PI) : 0;
        const wipe = cyc > 10.5 && cyc < 12.3 ? Math.sin((cyc - 10.5) / 1.8 * Math.PI) : 0;
        if (sc > 0.05) {
          c.p['upperArm.r'] = Q.nlerp(c.p['upperArm.r'], Q.euler([-60, 50, 30]), sc);
          c.p['lowerArm.r'] = Q.nlerp(c.p['lowerArm.r'], Q.euler([0, 140 + wave(t, 3) * 12, -10]), sc);
          c.p.head = Q.mul(Q.euler([-8 * sc, 12 * sc, 6 * sc]), c.p.head || [0, 0, 0, 1]);
        }
        if (wipe > 0.05) {
          c.p['upperArm.l'] = Q.nlerp(c.p['upperArm.l'], Q.euler([-60, -50, -30]), wipe);
          c.p['lowerArm.l'] = Q.nlerp(c.p['lowerArm.l'], Q.euler([0, -130, 10 + wave(t, 1.5) * 15]), wipe);
        }
        if (look > 0.05) c.p.head = Q.mul(Q.euler([-10 * look, wave(t, 0.33) * 50 * look, 0]), c.p.head || [0, 0, 0, 1]);
        const fl = this.flinchT ? Math.max(0, 1 - (this.now - this.flinchT) / 0.6) : 0;
        if (fl > 0) { c.p.head = Q.mul(Q.euler([-30 * fl, 0, 0]), c.p.head || [0, 0, 0, 1]); c.p.chest = Q.mul(Q.euler([-14 * fl, 0, 0]), c.p.chest || [0, 0, 0, 1]); root[2] -= 0.05 * fl; }
      }
      return { p: this.look2(c.p, cf.look ?? 0), root, turn: cf.turn ?? -18, plant: cf.plant };
    }
    if (state === 'watch') state = 'loading_proc';
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
    } else if (state === 'loading_proc') {
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
      const lookCard = seg(0, 3.4), around = seg(3.2, 6.6), bop = seg(6.4, 10.6), sigh = seg(10.4, 14);
      const nod = cy > 1 && cy < 3 ? Math.sin((cy - 1) * Math.PI * 3) * 7 : 0;
      const beat = wave(t, 1.9);
      p = mirror({ ...arms, 'upperArm.l': [H[0][0] - sigh * 4, H[0][1], H[0][2]], 'lowerArm.l': H[1], 'hand.l': H[2] });
      p.chest = [2 + breathe + bop * Math.abs(beat) * 2 - sigh * 5, wave(t, 0.13) * 3, 0];
      p.head = [
        lk[1] * 8 + lookCard * 30 + nod + around * wave(cy, 0.45) * 14 - sigh * 22 + bop * beat * 9,
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
    } else if (state === 'type') {
      const T = window.__T || [[-10, -22, -82], [0, -62, 22], [0, 0, 0]];
      const tapL = Math.max(0, wave(t, 3.1)) * 9, tapR = Math.max(0, wave(t, 3.1, 1.7)) * 9;
      const lean = (t % 7) > 4.5 && (t % 7) < 6.2 ? Math.sin(((t % 7) - 4.5) / 1.7 * Math.PI) : 0;
      p = mirror({ ...arms, 'upperArm.l': T[0], 'lowerArm.l': T[1], 'hand.l': T[2] });
      p['hand.l'] = [tapL, 0, -6]; p['hand.r'] = [tapR, 0, 6];
      p['upperArm.l'] = [T[0][0] - tapL * 0.3, T[0][1], T[0][2]];
      p['upperArm.r'] = [T[0][0] - tapR * 0.3, -T[0][1], -T[0][2]];
      p.chest = [6 + lean * 10 + breathe, 0, 0];
      p.head = [6 + lean * 6 + wave(t, 0.4) * 3, wave(t, 0.23) * 6, 0];
      root = [0, -lean * 0.01, 0];
      turn = 0;
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
    }
    return { p, root, turn };
  }

  loop(now) {
    if (document.hidden) return;
    requestAnimationFrame(this.loop);
    now /= 1000;
    const dt = Math.min(0.05, now - (this.last || now));
    this.last = now;
    const real = now;
    if (this.fps) now = Math.floor(now * this.fps) / this.fps;
    if (this.lookLock) this.lookT = [1, -0.1];
    this.look[0] += (this.lookT[0] - this.look[0]) * Math.min(1, dt * 6);
    this.look[1] += (this.lookT[1] - this.look[1]) * Math.min(1, dt * 6);
    this.blend = Math.min(1, this.blend + dt / 0.3);
    const st = Math.max(0, now - (this.stateStart || this.t0));
    const timeFor = s => (s === 'watch' || s === 'hold') ? now - this.t0 : st;
    let cur = this.pose(this.state, timeFor(this.state));
    const toQ = o => { const p = {}; for (const n in o.p) p[n] = o.p[n].length === 4 ? o.p[n] : Q.euler(o.p[n]); return { ...o, p }; };
    cur = toQ(cur);
    if (this.blend < 1 && this.prev) {
      const old = toQ(this.pose(this.prev, this.prev === this.state ? st : (now - this.t0)));
      const k = ease(this.blend), p = {};
      for (const n of new Set([...Object.keys(old.p), ...Object.keys(cur.p)])) {
        p[n] = Q.nlerp(old.p[n] || [0, 0, 0, 1], cur.p[n] || [0, 0, 0, 1], k);
      }
      cur = { p, root: cur.root.map((v, i) => lerp(old.root[i], v, k)), turn: lerp(old.turn, cur.turn, k), plant: cur.plant && k > 0.5 };
    }
    if (this.state === 'dubs') this.glasses = Math.min(1, st / 0.7);
    else if (this.glasses > 0) this.glasses = Math.max(0, this.glasses - dt * 2.5);
    this.zoom = Math.max(0, Math.min(1, (this.zoom || 0) + (this.state === 'hold' ? dt : -dt) * 2.2));
    this.cineK = Math.max(0, Math.min(1, (this.cineK || 0) + (this.cine ? dt : -dt) * 1.6));
    this.wide = Math.max(0, Math.min(1, (this.wide || 0) + (this.state === 'dubs' ? dt : -dt) * 2.5));
    this.now = now;
    if (this.state === 'type' && real - (this.lastKey || 0) > 0.07 + Math.random() * 0.12) { this.lastKey = real; this.emit('key'); }
    this.runScene(dt);
    this.tick(now, st);
    this.draw(cur, now, st);
    this.drawFx(dt);
  }

  skeleton(cur, rig = this) {
    const W = [];
    rig.bones.forEach((b, i) => {
      let L = b.local;
      const e = cur.p[b.name];
      if (e) {
        const q = e.length === 4 ? e : Q.euler(e);
        const rq = rig.restQ[i];
        const lq = Q.mul(Q.conj(rq), Q.mul(q, rq));
        L = M4.mul(L, M4.fromQT(lq, [0, 0, 0]));
      }
      if (b.parent < 0) L = M4.mul(M4.fromQT([0, 0, 0, 1], cur.root), L);
      W[i] = b.parent >= 0 ? M4.mul(W[b.parent], L) : L;
    });
    if (cur.plant) {
      const fy = Math.min(W[rig.byName['foot.l']][13], W[rig.byName['foot.r']][13]);
      const dy = rig.rest[rig.byName['foot.l']][13] - fy;
      for (const w of W) w[13] += dy;
    }
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
    const VP = this.camera(c.width / c.height);
    this.VP = VP;
    if (this.sceneTurn != null) cur.turn = this.sceneTurn;
    const pos = this.pos || [0, 0, 0];
    const model = M4.mul(M4.fromQT([0, 0, 0, 1], pos), M4.rotY(cur.turn * Math.PI / 180));
    gl.uniformMatrix4fv(L.uVP, false, VP);
    gl.uniform1f(L.uSnap, Math.min(c.width, c.height) * 0.35);
    gl.uniform1i(L.uTex, 0);
    gl.uniform1f(L.uHandOnly, 0);
    gl.uniform1f(L.uHole, 0);
    gl.activeTexture(gl.TEXTURE0);
    const W = this.skeleton(cur);
    const skin = new Float32Array(16 * 24);
    W.forEach((w, i) => skin.set(M4.mul(w, this.bones[i].inv), i * 16));
    this.lastModel = model;
    gl.uniformMatrix4fv(L.uModel, false, model);
    this.drawShadow(VP, cur, pos);
    gl.uniformMatrix4fv(L.uModel, false, model);
    this.bind(this.body);
    gl.uniformMatrix4fv(L.uBones, false, skin);
    gl.bindTexture(gl.TEXTURE_2D, this.skinTex);
    gl.uniform4fv(L.uTint, [1, 1, 1, 1]);
    gl.uniform1f(L.uUnlit, 0);
    gl.uniform1f(L.uShine, 0);
    gl.drawElements(gl.TRIANGLES, this.body.count, gl.UNSIGNED_SHORT, 0);

    const bw = n => W[this.byName[n]];
    {
      const toW = p => { const v = [p[12], p[13], p[14]]; return [model[0] * v[0] + model[4] * v[1] + model[8] * v[2] + model[12], model[1] * v[0] + model[5] * v[1] + model[9] * v[2] + model[13], model[2] * v[0] + model[6] * v[1] + model[10] * v[2] + model[14]]; };
      const hd = this.screen(toW(bw('head'))), ft = this.screen(toW(bw('foot.l'))), hp = this.screen(toW(bw('hip')));
      const top = hd[1] - (ft[1] - hd[1]) * 0.12, half = (ft[1] - top) * 0.22;
      this.hit = { x0: hp[0] - half, x1: hp[0] + half, y0: top, y1: ft[1] + 10 };
      this.bubble.style.left = Math.round(hd[0]) + 'px';
      this.bubble.style.top = Math.round(top - 8) + 'px';
    }
    if (this.glasses > 0) {
      const drop = this.state === 'dubs' ? (1 - back(this.glasses)) * 0.9 : 0;
      const fade = this.state === 'dubs' ? 1 : this.glasses;
      this.shadesOff ||= M4.mul(this.invRest('head'), M4.fromQT([0, 0, 0, 1], [0, this.rig.eyes[1], this.rig.eyes[2] + 0.012]));
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
      const fm = M4.mul(m, M4.fromQT([0, 0, 0, 1], [0, 0, 0.0115]));
      gl.uniform1f(L.uHole, 1);
      this.drawRigid(this.cardFace, fm, this.white);
      gl.uniform1f(L.uHole, 0);
      const corner = (x, y) => { const p = [fm[0] * x + fm[4] * y + fm[12], fm[1] * x + fm[5] * y + fm[13], fm[2] * x + fm[6] * y + fm[14]]; return this.screen([model[0] * p[0] + model[4] * p[1] + model[8] * p[2] + model[12], model[1] * p[0] + model[5] * p[1] + model[9] * p[2] + model[13], model[2] * p[0] + model[6] * p[1] + model[10] * p[2] + model[14]]); };
      const tl = corner(-0.24, 0.12), tr2 = corner(0.24, 0.12), bl = corner(-0.24, -0.12);
      this.card2d.style.transform = `matrix(${(tr2[0] - tl[0]) / 240},${(tr2[1] - tl[1]) / 240},${(bl[0] - tl[0]) / 120},${(bl[1] - tl[1]) / 120},${tl[0]},${tl[1]})`;
      this.card2d.style.opacity = 1;
      this.cardShown = true;
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
    const handMat = (n, off) => M4.mul(bw('hand.' + n), off);
    if (!this.phoneOff) {
      const R = (cols, t) => new Float32Array([...cols[0], 0, ...cols[1], 0, ...cols[2], 0, ...t, 1]);
      this.phoneOff = this.rebase('hand.r', R([[0, 0, 1], [-1, 0, 0], [0, -1, 0]], [-0.875, 1.37, 0.03]));
    }
    const phoneK = this.state === 'phone' ? Math.min(1, st / 0.4) : this.prev === 'phone' ? 1 - this.blend : 0;
    if (phoneK > 0.01) {
      const m = M4.mul(handMat('r', this.phoneOff), M4.fromQT([0, 0, 0, 1], [0, 0, 0], phoneK));
      this.drawRigid(this.phone, m, this.white, [0.2, 0.2, 0.19, 1], 0, 0.6);
      this.drawRigid(this.phoneFace, m, this.phoneTex, [1, 1, 1, 1], 0.4);
    }
    if (['sitdown', 'sit', 'standup'].includes(this.state)) this.drawRigid(this.crate, M4.fromQT([0, 0, 0, 1], [0, 0.25, -0.34]), this.crateTex);
    if (this.state === 'push') this.drawRigid(this.bigCrate, M4.fromQT([0, 0, 0, 1], [0, 0.575, cur.root[2] + 0.98]), this.crateTex);
    const loadingK = this.state === 'loading' ? Math.min(1, st / 0.5) : this.prev === 'loading' ? 1 - this.blend : 0;
    if (loadingK > 0.01) {
      if (!this.mt || now - this.mt > 0.25) { this.mt = now; this.paintMachine(now); }
      const m = M4.fromQT(Q.euler([0, -20, 0]), [0.05, 0, 0.62], loadingK);
      this.drawRigid(this.machine, m, this.white, [0.4, 0.42, 0.36, 1], 0, 0.3);
      this.drawRigid(this.machineFace, M4.mul(m, M4.fromQT([0, 0, 0, 1], [0, 0.13, 0])), this.machineTex, [1, 1, 1, 1], 0.8);
      if (Math.random() < 0.04) this.spark(VP, model, [0.05, 0.3, 0.6]);
    }
    if (this.gun && this.armed) {
      if (!this.gunOff) this.gunOff = this.rebase('hand.r', M4.mul(this.baseRig.rest[this.baseRig.byName['hand.r']], GUN_OFF));
      const gm = M4.mul(bw('hand.r'), this.gunOff);
      this.drawRigid(this.gun, gm, this.gunTex, [1, 1, 1, 1], 0.15, 0.8);
      this.muzzle = M4.mul(model, M4.mul(gm, M4.fromQT([0, 0, 0, 1], [2.05, 1.38, 0])));
    }
    if (this.cineK > 0.02 && this.cineMode !== 'defuse') this.drawTerminal(now, bw);
    if (this.c4) this.drawC4(now);
    if (this.spook.on) this.drawSpook(VP, now);
    this.drawShots(VP, now);
    if (holdK <= 0.01 && this.cardShown) { this.card2d.style.opacity = 0; this.cardShown = false; }
    const loadK = this.state === 'watch' ? 1 : this.prev === 'watch' ? 1 - this.blend : 0;
    this.watchOff ||= this.rebase('lowerArm.l', M4.fromQT([0, 0, 0, 1], [0.76, 1.425, 0.035]));
    if (loadK > 0.01) this.drawRigid(this.watch, M4.mul(bw('lowerArm.l'), this.watchOff), this.white, [0.75, 0.68, 0.3, 1], 0, 1);
  }

  drawSpook(VP, now) {
    const gl = this.gl, L = this.loc, S = this.spook, rig = this.spookRig;
    const c = this.clips[S.clip];
    const t = now - S.t0;
    let pc = this.clip(S.clip, S.once ? Math.min(t, c ? c.d : 0) : t, !S.once);
    const cur = { p: pc.p, root: pc.root, plant: S.plant };
    const W = this.skeleton(cur, rig);
    const skin = new Float32Array(16 * 24);
    W.forEach((w, i) => skin.set(M4.mul(w, rig.bones[i].inv), i * 16));
    const bob = rig.ghost ? 0.06 + wave(now, 0.6) * 0.03 : 0.03 + wave(now, 0.6) * 0.02;
    const fade = S.fade ? Math.max(0, 1 - (now - S.fade) / 0.8) : 1;
    const flick = S.flick && now - S.flick < 0.35 ? (Math.floor(now * 20) % 2 ? 0.15 : 0.8) : 1;
    const m = M4.mul(M4.fromQT([0, 0, 0, 1], [S.x, bob, S.z]), M4.rotY(S.turn * Math.PI / 180));
    gl.uniformMatrix4fv(L.uModel, false, m);
    this.bind(rig.body);
    gl.uniformMatrix4fv(L.uBones, false, skin);
    gl.bindTexture(gl.TEXTURE_2D, rig.tex);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform4fv(L.uTint, [rig.tint[0], rig.tint[1], rig.tint[2], rig.tint[3] * fade * flick]);
    gl.uniform1f(L.uUnlit, rig.ghost ? 0.35 : 0);
    gl.uniform1f(L.uShine, 0);
    gl.drawElements(gl.TRIANGLES, rig.body.count, gl.UNSIGNED_SHORT, 0);
    gl.disable(gl.BLEND);
    if (S.gun && this.gun) {
      const off = M4.mul(this.invRestOf2(rig, 'hand.r'), M4.mul(M4.fromQT([0, 0, 0, 1], [0, 1, 2].map(i => rig.pos('hand.r')[i] - this.baseRig.pos('hand.r')[i])), M4.mul(this.baseRig.rest[this.baseRig.byName['hand.r']], GUN_OFF)));
      const gm = M4.mul(W[rig.byName['hand.r']], off);
      this.drawRigid(this.gun, gm, this.gunTex, [1, 1, 1, 1], 0.15, 0.8);
      this.spookMuzzle = M4.mul(m, M4.mul(gm, M4.fromQT([0, 0, 0, 1], [2.05, 1.38, 0])));
    }
    gl.uniformMatrix4fv(L.uModel, false, this.lastModel || M4.id());
  }

  drawShots(VP, now) {
    if (!this.shots?.length) return;
    this.shots = this.shots.filter(s => now - s.t < 0.25);
    const x = this.fx.getContext('2d');
    for (const s of this.shots) {
      const mz = s.who === 'guy' ? this.muzzle : this.spookMuzzle;
      if (!mz) continue;
      const a = this.project(VP, M4.id(), M4.pos(mz));
      const tgt = s.who === 'guy' ? [this.spook.x - 0.4, 1.3, this.spook.z] : [this.pos[0], 1.25, 0];
      const b = this.project(VP, M4.id(), tgt);
      this.flashes = (this.flashes || []).concat({ a, b, life: 0.12 });
      s.t = -99;
    }
  }

  paintMachine(now) {
    const x = this.machineCanvas.getContext('2d');
    x.fillStyle = '#0d1a0d'; x.fillRect(0, 0, 96, 64);
    x.fillStyle = '#5fdc5f'; x.font = 'bold 12px monospace';
    x.fillText(['SCAN.', 'SCAN..', 'SCAN...'][Math.floor(now * 2) % 3], 6, 18);
    const p = (now * 0.35) % 1;
    x.strokeStyle = '#5fdc5f'; x.strokeRect(6, 30, 84, 12); x.fillRect(8, 32, 80 * p, 8);
    x.fillStyle = Math.floor(now * 3) % 2 ? '#e8c547' : '#5a4a10'; x.fillRect(80, 6, 8, 8);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.machineTex);
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.machineCanvas);
  }

  project(VP, model, p) {
    const w = M4.mul(VP, model), v = [p[0], p[1], p[2], 1];
    const o = [0, 1, 2, 3].map(r => w[r] * v[0] + w[4 + r] * v[1] + w[8 + r] * v[2] + w[12 + r] * v[3]);
    return [(o[0] / o[3] * 0.5 + 0.5) * this.fx.width, (0.5 - o[1] / o[3] * 0.5) * this.fx.height];
  }

  spark(VP, model, p) {
    const [x, y] = this.project(VP, model, p);
    for (let i = 0; i < 8; i++) this.confetti.push({ x, y, vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 160, r: 0, c: i % 2 ? '#ffd35a' : '#fff4c0', life: 0.35 + Math.random() * 0.3 });
  }

  drawShadow(VP, cur, pos = [0, 0, 0]) {
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
    gl.uniformMatrix4fv(this.loc.uBones, false, M4.fromQT([0, 0, 0, 1], [pos[0], 0.002, pos[2]], 0.42 * k));
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.uniform4fv(prog, [1, 1, 1, 1]); gl.uniform1f(this.loc.uUnlit, 1); gl.uniform1f(this.loc.uShine, 0);
    this.fs || (this.fs = true);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    gl.depthMask(true); gl.disable(gl.BLEND);
  }

  drawFx(dt) {
    const x = this.fx.getContext('2d'), w = this.fx.width, h = this.fx.height;
    x.clearRect(0, 0, w, h);
    if (this.flashes?.length) {
      this.flashes = this.flashes.filter(f => (f.life -= dt) > 0);
      for (const f of this.flashes) {
        x.strokeStyle = '#fff3b0'; x.lineWidth = 2; x.beginPath(); x.moveTo(f.a[0], f.a[1]); x.lineTo(f.b[0], f.b[1]); x.stroke();
        x.fillStyle = '#ffd35a'; x.beginPath(); x.arc(f.a[0], f.a[1], 7, 0, 7); x.fill();
        x.fillStyle = '#fff'; x.beginPath(); x.arc(f.a[0], f.a[1], 3, 0, 7); x.fill();
      }
    }
    if (!this.confetti.length) return;
    this.confetti = this.confetti.filter(p => (p.life -= dt) > 0);
    for (const p of this.confetti) {
      p.vy += h * 0.9 * dt; p.vx *= 0.99; p.vy = Math.min(p.vy, h * 0.35);
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 8;
      x.save(); x.translate(p.x | 0, p.y | 0); x.rotate(p.r);
      x.fillStyle = p.c; x.fillRect(-4, -2, 8, 4);
      x.restore();
    }
  }
}
