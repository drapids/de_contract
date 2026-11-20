import { M4, Q } from '../guy.js';

let clipsP = null;

export class Avatar {
  constructor(eng) {
    this.e = eng;
    this.pos = [0, 0, 0];
    this.yaw = 0;
    this.cur = 'Idle_Loop';
    this.prev = null;
    this.t = 0;
    this.pt = 0;
    this.blend = 1;
    this.once = null;
    this.rigs = {};
  }

  async load(skin) {
    const e = this.e;
    clipsP ||= e.json('assets/anims.json');
    this.clips = await clipsP;
    for (const c of Object.values(this.clips)) {
      if (c.rmean) continue;
      c.rmean = [0, 1, 2].map(i => { let a = 0; for (let f = 0; f < c.n; f++) a += c.r[f * 3 + i]; return a / c.n; });
    }
    await this.setSkin(skin);
  }

  async setSkin(skin) {
    const e = this.e;
    if (!this.rigs[skin]) {
      const base = skin.includes('/') ? skin : skin === 'orange' ? 'assets/guy' : 'assets/agents/' + skin;
      const d = await e.json(base + '.json');
      const bones = d.bones.map(b => ({ name: b.name, parent: b.parent, local: new Float32Array(b.local), inv: new Float32Array(b.invBind) }));
      const byName = {}; bones.forEach((b, i) => byName[b.name] = i);
      const rest = []; bones.forEach((b, i) => { rest[i] = b.parent >= 0 ? M4.mul(rest[b.parent], b.local) : b.local; });
      const mesh = e.mesh({ P: d.pos, N: d.nor, U: d.uv, I: d.idx }, { B: d.bi, W: d.bw });
      const tex = await e.texUrl(base + '.png', false, true);
      this.rigs[skin] = { bones, byName, rest, restQ: rest.map(m => Q.fromMat(m)), hip: d.hip || M4.pos(rest[byName.hip])[1], obj: { mesh, groups: [{ start: 0, count: d.idx.length, tex, tint: [1, 1, 1, 1] }] } };
    }
    this.rig = this.rigs[skin];
  }

  play(name, once = false) {
    if (name === this.cur && !once) return;
    this.prev = this.cur; this.pt = this.t; this.t = 0; this.blend = 0;
    this.cur = name; this.once = once;
  }

  sample(name, t, loop) {
    const c = this.clips[name];
    if (!c) return { p: {}, root: [0, 0, 0] };
    let f = t * 30;
    f = loop ? f % (c.n - 1) : Math.min(f, c.n - 1);
    const a = Math.floor(f), b = Math.min(a + 1, c.n - 1), u = f - a, p = {};
    for (const k in c.b) { const v = c.b[k]; p[k] = Q.nlerp(v.slice(a * 4, a * 4 + 4), v.slice(b * 4, b * 4 + 4), u); }
    const H = this.rig.hip, r = c.r;
    const ry = (r[a * 3 + 1] * (1 - u) + r[b * 3 + 1] * u) * H;
    return { p, root: [c.rmean[0] * H, ry, c.rmean[2] * H], done: !loop && f >= c.n - 1 };
  }

  update(dt) {
    this.t += dt; this.pt += dt;
    this.blend = Math.min(1, this.blend + dt / 0.22);
    const q = 1 / 15, T = Math.floor(this.t / q) * q;
    let s = this.sample(this.cur, T, !this.once);
    if (this.once && s.done && this.onDone) { const f = this.onDone; this.onDone = null; f(); }
    if (this.blend < 1 && this.prev) {
      const o = this.sample(this.prev, Math.floor(this.pt / q) * q, true), k = this.blend * this.blend * (3 - 2 * this.blend), p = {};
      for (const n of new Set([...Object.keys(o.p), ...Object.keys(s.p)])) p[n] = Q.nlerp(o.p[n] || [0, 0, 0, 1], s.p[n] || [0, 0, 0, 1], k);
      s = { p, root: s.root.map((v, i) => o.root[i] + (v - o.root[i]) * k) };
    }
    this.pose = s;
  }

  bones() {
    const R = this.rig, W = [], s = this.pose;
    R.bones.forEach((b, i) => {
      let L = b.local;
      const q = s.p[b.name];
      if (q) { const rq = R.restQ[i]; L = M4.mul(L, M4.fromQT(Q.mul(Q.conj(rq), Q.mul(q, rq)), [0, 0, 0])); }
      if (b.parent < 0) L = M4.mul(M4.fromQT([0, 0, 0, 1], s.root), L);
      W[i] = b.parent >= 0 ? M4.mul(W[b.parent], L) : L;
    });
    const out = new Float32Array(16 * 24);
    W.forEach((w, i) => out.set(M4.mul(w, R.bones[i].inv), i * 16));
    this.W = W;
    return out;
  }

  model() {
    if (this.modelOverride) return this.modelOverride;
    return M4.mul(M4.fromQT([0, 0, 0, 1], this.pos), M4.rotY(this.yaw));
  }

  draw(opts = {}) {
    if (!this.rig || !this.pose) return;
    this.e.draw(this.rig.obj, this.model(), { ...opts, bones: this.bones() });
  }

  head() {
    const R = this.rig, w = this.W?.[R.byName.head];
    if (!w) return [this.pos[0], this.pos[1] + 1.6, this.pos[2]];
    const m = this.model(), x = w[12], y = w[13], z = w[14];
    return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
  }
}
