import { M4, Q, boxG } from './engine.js';
import { TIER_COLORS } from '../tradeup.js';
import { CS2, weaponKey, mulM } from './cs2.js';
import { set, vfov } from './settings.js';

export const MAPS = [
  { id: 'surf_kitsune', name: 'surf_kitsune', tier: 1 },
  { id: 'surf_mesa', name: 'surf_mesa', tier: 1 },
  { id: 'surf_phantasia', name: 'surf_phantasia', tier: 2 },
  { id: 'surf_unrequited', name: 'surf_unrequited', tier: 2 },
  { id: 'surf_demise', name: 'surf_demise', tier: 3 },
  { id: 'surf_surreal', name: 'surf_surreal', tier: 3 },
  { id: 'surf_eternity', name: 'surf_eternity', tier: 4 }
];

const S = 0.025;
const G = 800, ACC = 5, AIRACC = 150, FRIC = 4, STOP = 75, MAXS = 250, JUMP = 301.993, STEP = 18, MAXV = 3500;
const MINS = [-16, -16, 0], MAXS_B = [16, 16, 72], EPS = 0.03125;
const TICK = 1 / 100;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const D = Math.PI / 180;
export const lockMouse = c => { try { const p = c.requestPointerLock?.({ unadjustedMovement: true }); p?.catch?.(() => { try { c.requestPointerLock(); } catch (e) {} }); } catch (e) { try { c.requestPointerLock(); } catch (e2) {} } };

export class Col {
  constructor(buf) {
    const f = new Float32Array(buf, 4), n = new Uint32Array(buf, 0, 1)[0];
    this.b = [];
    let k = 0;
    for (let i = 0; i < n; i++) {
      const c = f[k++], pl = f.subarray(k, k + c * 4); k += c * 4;
      const bb = [-1e9, -1e9, -1e9, 1e9, 1e9, 1e9];
      for (let j = 0; j < c; j++) {
        const nx = pl[j * 4], ny = pl[j * 4 + 1], nz = pl[j * 4 + 2], d = pl[j * 4 + 3];
        if (nx > 0.999) bb[3] = Math.min(bb[3], d); else if (nx < -0.999) bb[0] = Math.max(bb[0], -d);
        else if (ny > 0.999) bb[4] = Math.min(bb[4], d); else if (ny < -0.999) bb[1] = Math.max(bb[1], -d);
        else if (nz > 0.999) bb[5] = Math.min(bb[5], d); else if (nz < -0.999) bb[2] = Math.max(bb[2], -d);
      }
      this.b.push({ pl, bb, m: 0 });
    }
    this.C = 512;
    this.grid = new Map();
    this.big = [];
    for (const b of this.b) {
      const [x0, y0, z0, x1, y1, z1] = b.bb;
      if (x0 < -1e8 || x1 > 1e8 || y0 < -1e8 || y1 > 1e8 || z0 < -1e8 || z1 > 1e8 || (x1 - x0) * (y1 - y0) > 4096 * 4096 * 4) { this.big.push(b); continue; }
      for (let x = Math.floor(x0 / this.C); x <= Math.floor(x1 / this.C); x++)
        for (let y = Math.floor(y0 / this.C); y <= Math.floor(y1 / this.C); y++)
          for (let z = Math.floor(z0 / this.C); z <= Math.floor(z1 / this.C); z++) {
            const key = x * 73856093 ^ y * 19349663 ^ z * 83492791;
            let l = this.grid.get(key); if (!l) this.grid.set(key, l = []); l.push(b);
          }
    }
    this.stamp = 0;
  }

  near(lo, hi) {
    const out = [], st = ++this.stamp, C = this.C;
    for (let x = Math.floor(lo[0] / C); x <= Math.floor(hi[0] / C); x++)
      for (let y = Math.floor(lo[1] / C); y <= Math.floor(hi[1] / C); y++)
        for (let z = Math.floor(lo[2] / C); z <= Math.floor(hi[2] / C); z++) {
          const l = this.grid.get(x * 73856093 ^ y * 19349663 ^ z * 83492791);
          if (l) for (const b of l) if (b.m !== st) { b.m = st; out.push(b); }
        }
    for (const b of this.big) out.push(b);
    return out;
  }

  trace(s, e, mins = MINS, maxs = MAXS_B) {
    const tr = { f: 1, n: null, ss: false, as: false, e: null };
    const lo = [Math.min(s[0], e[0]) + mins[0] - 1, Math.min(s[1], e[1]) + mins[1] - 1, Math.min(s[2], e[2]) + mins[2] - 1];
    const hi = [Math.max(s[0], e[0]) + maxs[0] + 1, Math.max(s[1], e[1]) + maxs[1] + 1, Math.max(s[2], e[2]) + maxs[2] + 1];
    for (const b of this.near(lo, hi)) {
      const bb = b.bb;
      if (bb[0] > hi[0] || bb[3] < lo[0] || bb[1] > hi[1] || bb[4] < lo[1] || bb[2] > hi[2] || bb[5] < lo[2]) continue;
      const pl = b.pl, np = pl.length / 4;
      let enter = -1, leave = 1, cp = -1, getout = false, startout = false, skip = false;
      for (let j = 0; j < np; j++) {
        const nx = pl[j * 4], ny = pl[j * 4 + 1], nz = pl[j * 4 + 2];
        const dist = pl[j * 4 + 3] - ((nx < 0 ? maxs[0] : mins[0]) * nx + (ny < 0 ? maxs[1] : mins[1]) * ny + (nz < 0 ? maxs[2] : mins[2]) * nz);
        const d1 = s[0] * nx + s[1] * ny + s[2] * nz - dist, d2 = e[0] * nx + e[1] * ny + e[2] * nz - dist;
        if (d2 > 0) getout = true;
        if (d1 > 0) startout = true;
        if (d1 > 0 && d2 >= d1) { skip = true; break; }
        if (d1 <= 0 && d2 <= 0) continue;
        if (d1 > d2) { const f = (d1 - EPS) / (d1 - d2); if (f > enter) { enter = f; cp = j; } }
        else { const f = (d1 + EPS) / (d1 - d2); if (f < leave) leave = f; }
      }
      if (skip) continue;
      if (!startout) { tr.ss = true; if (!getout) { tr.as = true; tr.f = 0; } continue; }
      if (enter < leave && enter > -1 && enter < tr.f && cp >= 0) { tr.f = Math.max(0, enter); tr.n = [pl[cp * 4], pl[cp * 4 + 1], pl[cp * 4 + 2]]; }
    }
    tr.e = [s[0] + (e[0] - s[0]) * tr.f, s[1] + (e[1] - s[1]) * tr.f, s[2] + (e[2] - s[2]) * tr.f];
    return tr;
  }
}

function inside(pl, c, h) {
  for (let j = 0; j < pl.length; j++) {
    const p = pl[j];
    if (c[0] * p[0] + c[1] * p[1] + c[2] * p[2] - (Math.abs(p[0]) * h[0] + Math.abs(p[1]) * h[1] + Math.abs(p[2]) * h[2]) > p[3]) return false;
  }
  return true;
}

function clipVel(v, n, ob) {
  const back = dot(v, n) * ob, o = [v[0] - n[0] * back, v[1] - n[1] * back, v[2] - n[2] * back];
  const adj = dot(o, n);
  if (adj < 0) { o[0] -= n[0] * adj; o[1] -= n[1] * adj; o[2] -= n[2] * adj; }
  return o;
}

export class Surf {
  constructor(w) {
    this.w = w;
    this.e = w.e;
    this.on = false;
    this.keys = new Set();
    this.view = 'third';
    this.yaw = 0; this.pitch = 0;
    const el = this.el = document.createElement('div');
    el.className = 'surf';
    el.hidden = true;
    el.innerHTML = `<div class="sf-pick win"><div class="dlg-t"><span>surf servers</span><button class="x" data-x>x</button></div>
      <p class="dim" style="padding:6px 8px 0">real cs surf maps. every new stage you reach pays scrap, finishing pays a lot more. hold a skin from your inventory while you surf.</p>
      <div class="sf-maps"></div><div class="sf-hold"><span>holding:</span><select class="sel"></select><button class="btn" data-set>settings</button></div></div>
      <div class="sf-hud" hidden><div class="sf-speed"></div><div class="sf-fps"></div><div class="sf-info"></div><div class="sf-keys">wasd strafe · space jump (hold to bhop) · mouse look · f inspect · v first/third person · b switch skin · q last skin · o settings · r restart · esc leave</div><div class="sf-msg"></div><div class="sf-load" hidden></div><div class="sf-click">click to grab the mouse</div></div><div class="sf-buy win" hidden><div class="dlg-t"><span>pick what you hold</span><button class="x" data-bx>x</button></div><input class="inp sf-bq" placeholder="search your skins"><div class="sf-bl"></div></div>`;
    w.ui.append(el);
    this.$ = s => el.querySelector(s);
    this.$('[data-x]').onclick = () => this.close();
    this.$('[data-set]').onclick = () => w.settings?.open();
    this.$('[data-bx]').onclick = () => this.closeBuy();
    this.$('.sf-bq').oninput = () => this.renderBuy();
    addEventListener('keydown', e => {
      if (!this.on || !this.map) return;
      const k = e.key.toLowerCase();
      if (this.buyOn) { if (e.key === 'Escape' || (k === 'b' && e.target === document.body)) { e.preventDefault(); this.closeBuy(); } return; }
      if (e.target.closest?.('input, textarea, select')) return;
      if ([' ', 'w', 'a', 's', 'd'].includes(k)) e.preventDefault();
      if (e.key === 'Escape') { this.exit(); return; }
      if (k === 'b' && !e.repeat) { this.openBuy(); return; }
      if (k === 'q' && !e.repeat && this.lastIdx >= 0 && this.w.bank.s.inv[this.lastIdx]) { this.equip(this.lastIdx); this.msg(this.held.hash, 1200); return; }
      if (k === 'v' && !e.repeat) this.view = this.view === 'first' ? 'third' : 'first';
      if (k === 'r' && !e.repeat) this.respawn(true);
      if (k === 'o' && !e.repeat) { this.keys.clear(); w.settings?.open(); return; }
      if (k === 'f' && !e.repeat) this.inspect();
      this.keys.add(k);
    });
    addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());
    w.canvas.addEventListener('click', () => { if (this.on && this.map && document.pointerLockElement !== w.canvas) lockMouse(w.canvas); });
    addEventListener('mousemove', e => {
      if (!this.on || !this.map || document.pointerLockElement !== w.canvas) return;
      if (Math.abs(e.movementX) > 2500 || Math.abs(e.movementY) > 2500) return;
      const k = set.sens * 0.022;
      this.yaw -= e.movementX * k;
      this.yaw = ((this.yaw % 360) + 360) % 360;
      this.pitch = Math.max(-89, Math.min(89, this.pitch + e.movementY * k * (set.invert ? -1 : 1)));
    });
    document.addEventListener('pointerlockchange', () => { this.$('.sf-click').hidden = document.pointerLockElement === w.canvas; });
  }

  best() { try { return JSON.parse(localStorage.getItem('dc.surf')) || {}; } catch { return {}; } }

  open() {
    this.on = true;
    this.w.busy = true;
    this.el.hidden = false;
    this.$('.sf-pick').hidden = false;
    this.$('.sf-hud').hidden = true;
    const b = this.best();
    this.$('.sf-maps').innerHTML = MAPS.map((m, i) => `<button class="arm-foe" data-i="${i}"><b>${m.name}</b><span class="elo">tier ${m.tier}</span><em>${b[m.id] ? `best ${b[m.id].stages} stages${b[m.id].time ? ' · finished in ' + this.fmt(b[m.id].time) : ''}` : 'never played'}</em></button>`).join('');
    this.$('.sf-maps').querySelectorAll('[data-i]').forEach(el => el.onclick = () => this.start(MAPS[+el.dataset.i]));
    const inv = this.w.bank.s.inv;
    const sel = this.$('.sf-hold select');
    sel.innerHTML = '<option value="-1">nothing</option>' + inv.map((it, i) => `<option value="${i}">${esc(it.hash)}</option>`).join('');
    const top = inv.reduce((bi, it, i) => (bi < 0 || this.w.loot.value(it) > this.w.loot.value(inv[bi])) ? i : bi, -1);
    const h = this.w.bank.s.hold;
    sel.value = String(inv[h] ? h : top);
  }

  close() {
    this.on = false;
    this.el.hidden = true;
    this.w.busy = false;
  }

  fmt(ms) { const s = ms / 1000; return Math.floor(s / 60) + ':' + (s % 60).toFixed(2).padStart(5, '0'); }

  async start(m) {
    const w = this.w, e = this.e;
    this.holdIdx = -2;
    this.pickIdx = +this.$('.sf-hold select').value;
    this.$('.sf-pick').hidden = true;
    this.$('.sf-hud').hidden = false;
    const ld = this.$('.sf-load');
    ld.hidden = false; ld.textContent = 'connecting to ' + m.name + '...';
    const base = 'assets/maps/' + m.id + '/';
    try {
      const [meta, geo, col] = await Promise.all([fetch(base + 'map.json').then(r => r.json()), fetch(base + 'geo.bin').then(r => r.arrayBuffer()), fetch(base + 'col.bin').then(r => r.arrayBuffer())]);
      ld.textContent = 'loading textures...';
      const hd = new Uint32Array(geo, 0, 4), nv = hd[0], ni = hd[1];
      const src = new Float32Array(geo, 16, nv * 8);
      const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = src.slice(nv * 6, nv * 8);
      for (let i = 0; i < nv; i++) {
        P[i * 3] = src[i * 3] * S; P[i * 3 + 1] = src[i * 3 + 2] * S; P[i * 3 + 2] = -src[i * 3 + 1] * S;
        N[i * 3] = src[nv * 3 + i * 3]; N[i * 3 + 1] = src[nv * 3 + i * 3 + 2]; N[i * 3 + 2] = -src[nv * 3 + i * 3 + 1];
      }
      const I = new Uint32Array(geo, 16 + nv * 32, ni);
      const mesh = e.mesh({ P, N, U, I });
      const groups = [];
      for (const g of meta.groups) groups.push({ start: g.start, count: g.count, tex: await e.texUrl(base + g.tex, true, false, true), tint: [1, 1, 1, 1] });
      this.map = { meta, obj: { mesh, groups }, col: new Col(col), id: m.id, name: m.name };
      const dests = new Set();
      for (const t of meta.triggers) if (t.dest) dests.add(t.dest.o.join(','));
      this.map.total = dests.size;
      this.map.trig = meta.triggers.map(t => ({ ...t, b: t.b.map(pl => pl.map(p => [p[0], p[1], p[2], p[3]])) }));
    } catch (err) {
      ld.textContent = 'couldnt load ' + m.name + ' (' + err.message + ')';
      setTimeout(() => this.open(), 2500);
      return;
    }
    if (!this.arms) {
      try { const d = await e.json('assets/fp/fparms.json'); this.arms = e.shape({ P: d.pos, N: d.nor, U: d.uv, I: d.idx }, await e.texUrl('assets/fp/fparms.png', false, false, true)); } catch (err) {}
    }
    ld.hidden = true;
    this.reached = new Set();
    this.t0 = performance.now();
    this.finished = false;
    this.acc = 0;
    this.respawn(true);
    this.held = null;
    this.equip(this.pickIdx);
    w.av.play('Idle_Loop');
    e.setMode(true);
    this.fps = { n: 0, t: performance.now(), lo: 1e9, show: 0 };
    this.hudT = 0;
    w.surfOn = this;
    lockMouse(w.canvas);
    this.msg(m.name + ' · good luck', 2500);
  }

  exit() {
    document.exitPointerLock?.();
    this.w.surfOn = null;
    this.e.setMode(false);
    this.map = null;
    this.keys.clear();
    this.w.av.pose = null;
    this.open();
  }

  msg(t, ms = 2000) {
    const m = this.$('.sf-msg');
    m.textContent = t; m.classList.remove('go'); void m.offsetWidth; m.classList.add('go');
    clearTimeout(this.mt); this.mt = setTimeout(() => m.textContent = '', ms);
  }

  respawn(hard) {
    const sp = hard || !this.check ? this.map.meta.spawn : this.check;
    this.pos = [sp.o[0], sp.o[1], sp.o[2] + 2];
    this.vel = [0, 0, 0];
    this.yaw = sp.yaw; this.pitch = 0;
    if (hard) { this.check = null; this.reached = new Set(); this.t0 = performance.now(); this.finished = false; }
    const tr = this.map.col.trace(this.pos, this.pos);
    if (tr.ss) for (let k = 0; k < 40; k++) { this.pos[2] += 4; if (!this.map.col.trace(this.pos, this.pos).ss) break; }
    this.ground = null;
    this.snap();
  }

  snap() { this.prev = this.pos.slice(); }

  makeCard(it) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 96;
    const x = c.getContext('2d'), col = TIER_COLORS[it.r] || '#888';
    const draw = img => {
      x.fillStyle = '#1b1e17'; x.fillRect(0, 0, 128, 96);
      x.fillStyle = col; x.fillRect(0, 88, 128, 8);
      if (img) x.drawImage(img, 8, 4, 112, 80);
      else { x.fillStyle = '#e8e2c8'; x.font = 'bold 11px Verdana'; x.textAlign = 'center'; const [a, b] = it.hash.split(' | '); x.fillText(a || '', 64, 36); x.fillText((b || '').slice(0, 20), 64, 54); }
      if (this.cardTex) { const gl = this.e.gl; gl.bindTexture(gl.TEXTURE_2D, this.cardTex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); }
    };
    draw(null);
    this.cardTex = this.e.texCanvas(c, null, false, false, true);
    this.card = this.e.shape({ P: [-0.11, -0.08, 0, 0.11, -0.08, 0, 0.11, 0.08, 0, -0.11, 0.08, 0], N: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], U: [0, 1, 1, 1, 1, 0, 0, 0], I: [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2] }, this.cardTex);
    const proxy = this.w.opts.imgProxy?.(it.img);
    if (proxy) { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => { try { draw(im); } catch (e) {} }; im.src = proxy; }
  }

  async loadGun(it) {
    const key = weaponKey(it.hash);
    if (!key) return;
    try {
      this.cs2 ||= new CS2(this.e);
      const [arms, wpn, skin] = await Promise.all([this.cs2.load('arms'), this.cs2.load(key), this.cs2.skin(it.hash)]);
      if (this.held !== it) return;
      this.gun = { key, arms, wpn, skin, clip: 'idle', t0: performance.now() / 1000 };
    } catch (err) { this.gun = null; }
  }

  equip(i) {
    const inv = this.w.bank.s.inv, it = inv[i] || null;
    if (it === this.held && (this.gun || this.card || !it)) return;
    if (this.holdIdx !== i && this.holdIdx >= 0) this.lastIdx = this.holdIdx;
    this.holdIdx = it ? i : -1;
    this.w.bank.s.hold = this.holdIdx;
    this.w.bank.save();
    this.held = it;
    this.card = null;
    this.gun = null;
    if (!it) return;
    if (this.map) this.makeCard(it);
    this.loadGun(it);
  }

  heldNow() {
    const inv = this.w.bank.s.inv, i = this.w.bank.s.hold ?? -1;
    if (this.held && inv.includes(this.held)) return this.held;
    if (inv[i]) { this.equip(i); return this.held; }
    return null;
  }

  openBuy() {
    this.buyOn = true;
    this.keys.clear();
    document.exitPointerLock?.();
    const b = this.$('.sf-buy');
    b.hidden = false;
    const q = this.$('.sf-bq');
    q.value = '';
    this.renderBuy();
    setTimeout(() => q.focus(), 0);
  }

  closeBuy() {
    this.buyOn = false;
    this.$('.sf-buy').hidden = true;
    if (this.map) lockMouse(this.w.canvas);
  }

  renderBuy() {
    const inv = this.w.bank.s.inv, q = this.$('.sf-bq').value.trim().toLowerCase();
    const rows = inv.map((it, i) => [it, i]).filter(([it]) => !q || it.hash.toLowerCase().includes(q)).reverse();
    rows.sort((a, b) => (b[0].r === 6) - (a[0].r === 6));
    this.$('.sf-bl').innerHTML = rows.length ? rows.map(([it, i]) => `<button class="sf-bi${i === this.holdIdx ? ' on' : ''}" data-i="${i}" style="--c:${TIER_COLORS[it.r]}">${it.img ? `<img src="${esc(it.img)}" alt="" loading="lazy">` : ''}<span>${esc(it.hash)}</span><em>${(it.f ?? 0).toFixed(4)}</em></button>`).join('') : '<p class="dim">nothing here. open cases or use the console</p>';
    this.$('.sf-bl').querySelectorAll('[data-i]').forEach(el => el.onclick = () => { this.equip(+el.dataset.i); this.closeBuy(); this.msg(this.held ? this.held.hash : 'empty hands', 1500); });
  }

  inspect() {
    const g = this.gun;
    if (!g || !g.wpn.clips.inspect) return;
    g.clip = 'inspect'; g.t0 = performance.now() / 1000;
  }

  gunClip(now) {
    const g = this.gun, c = g.wpn.clips[g.clip];
    let t = now - g.t0;
    if (g.clip !== 'idle' && (!c || t >= c.dur)) { g.clip = 'idle'; g.t0 = now; t = 0; }
    return { c: g.wpn.clips[g.clip], t };
  }

  drawGun(now) {
    const y = this.yaw * D, p = this.pitch * D;
    const fS = [Math.cos(p) * Math.cos(y), Math.cos(p) * Math.sin(y), -Math.sin(p)];
    const R = this.rpos || this.pos;
    const run = this.ground ? Math.min(1, Math.hypot(this.vel[0], this.vel[1]) / 250) : 0;
    this.vm(now, [R[0] * S, (R[2] + 64) * S, -R[1] * S], [fS[0], fS[2], -fS[1]], [Math.sin(y), 0, Math.cos(y)], S / 0.0254, run, this.landK || 0, this.swX || 0, this.swY || 0);
  }

  vm(now, eye, f, r, k, run, land, swX, swY) {
    const g = this.gun, cs = this.cs2, e = this.e;
    const { c, t } = this.gunClip(now);
    cs.pose(g.arms, c, t, g.clip === 'idle');
    cs.pose(g.wpn, c, t, g.clip === 'idle');
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const bob = Math.sin(now * 8.5) * 0.004 * run, bobU = -Math.abs(Math.cos(now * 8.5)) * 0.005 * run - land * 0.02 + swY * 0.3;
    const sx = swX * 0.3 + bob;
    const o = [eye[0] + r[0] * sx + u[0] * bobU, eye[1] + r[1] * sx + u[1] * bobU, eye[2] + r[2] * sx + u[2] * bobU];
    const M = new Float32Array([f[0] * k, f[1] * k, f[2] * k, 0, -r[0] * k, -r[1] * k, -r[2] * k, 0, u[0] * k, u[1] * k, u[2] * k, 0, o[0], o[1], o[2], 1]);
    const asp = e.canvas.width / e.canvas.height;
    const VP = M4.mul(M4.persp(vfov(set.vmfov, asp), asp, 0.01, 50), M4.look(eye, [eye[0] + f[0], eye[1] + f[1], eye[2] + f[2]], [0, 1, 0]));
    const keep = e.VP;
    e.VP = VP;
    e.gl.clear(e.gl.DEPTH_BUFFER_BIT);
    cs.draw(g.arms, M);
    const W = mulM(M, 0, cs.boneWorld(g.arms, 'wpn'), 0, new Float32Array(16), 0);
    cs.draw(g.wpn, W, g.skin);
    this.drawMag(g, W);
    e.VP = keep;
  }

  drawMag(g, W) {
    const cs = this.cs2, mag = g.wpn.mag;
    if (!mag || !g.wpn.byName.has('clip')) return;
    const C = mulM(W, 0, cs.boneWorld(g.wpn, 'clip'), 0, new Float32Array(16), 0);
    cs.draw(mag, mulM(C, 0, M4.fromQT([0.5, 0.5, 0.5, 0.5], [0, 0, 0]), 0, new Float32Array(16), 0), g.skin);
  }

  drawGun3(m, av) {
    const g = this.gun, cs = this.cs2;
    const R = av.rig, H = av.W[R.byName['hand.r']];
    if (!H) return;
    cs.pose(g.wpn, g.wpn.clips.idle, 0);
    const grip = cs.boneWorld(g.wpn, g.wpn.byName.has('ag1_hand_r') ? 'ag1_hand_r' : 'weapon');
    const k = S / 0.0254 * 1.1, c = Math.cos(-0.12), sn = Math.sin(-0.12);
    const B = new Float32Array([0, -sn * k, c * k, 0, k, 0, 0, 0, 0, c * k, sn * k, 0, H[12], H[13], H[14], 1]);
    const T = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -grip[12], -grip[13], -grip[14], 1]);
    const W = M4.mul(m, mulM(B, 0, T, 0, new Float32Array(16), 0));
    cs.draw(g.wpn, W, g.skin);
    this.drawMag(g, W);
  }

  wish() {
    const k = this.keys;
    let f = 0, s = 0;
    if (k.has('w')) f += 1; if (k.has('s')) f -= 1;
    if (k.has('d')) s += 1; if (k.has('a')) s -= 1;
    const y = this.yaw * D, fw = [Math.cos(y), Math.sin(y), 0], rt = [Math.sin(y), -Math.cos(y), 0];
    const v = [fw[0] * f * 450 + rt[0] * s * 450, fw[1] * f * 450 + rt[1] * s * 450, 0];
    const l = Math.hypot(v[0], v[1]);
    return l ? { dir: [v[0] / l, v[1] / l, 0], speed: Math.min(l, MAXS) } : { dir: [0, 0, 0], speed: 0 };
  }

  accel(dir, ws, a, dt, air) {
    const cap = air ? Math.min(ws, 30) : ws;
    const add = cap - dot(this.vel, dir);
    if (add <= 0) return;
    const as = Math.min(a * ws * dt, add);
    this.vel[0] += as * dir[0]; this.vel[1] += as * dir[1]; this.vel[2] += as * dir[2];
  }

  unstick(n) {
    const col = this.map.col, p = this.pos, dirs = [];
    if (n) dirs.push(n);
    dirs.push([0, 0, 1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, -1]);
    for (const k of [0.03125, 0.0625, 0.125, 0.25, 0.5, 1, 2, 4]) for (const d of dirs) {
      const q = [p[0] + d[0] * k, p[1] + d[1] * k, p[2] + d[2] * k];
      if (!col.trace(q, q).ss) return q;
    }
    return null;
  }

  slide(dt) {
    const col = this.map.col;
    let tl = dt, np = 0, stuck = 0;
    const planes = [], primal = this.vel.slice();
    let orig = this.vel.slice();
    this.touch = null;
    const ramp = n => n[2] > 0.05 && n[2] < 0.7;
    const keep = () => {
      const r = planes.find(ramp) || this.touch;
      let v = primal.slice();
      if (r) v = clipVel(v, r, 1);
      for (const q of planes) if (q !== r && dot(v, q) < 0 && Math.abs(q[2]) < 0.7) v = clipVel(v, q, 1);
      this.vel = v;
      if (r) { const q = [this.pos[0] + r[0] * 0.0625, this.pos[1] + r[1] * 0.0625, this.pos[2] + r[2] * 0.0625]; if (!col.trace(q, q).ss) this.pos = q; }
    };
    for (let bump = 0; bump < 8; bump++) {
      if (!this.vel[0] && !this.vel[1] && !this.vel[2]) break;
      let end = [this.pos[0] + this.vel[0] * tl, this.pos[1] + this.vel[1] * tl, this.pos[2] + this.vel[2] * tl];
      let tr = col.trace(this.pos, end);
      if (tr.as || (tr.f === 0 && stuck > 1)) {
        const fix = this.unstick(planes[np - 1] || tr.n);
        if (!fix) break;
        this.pos = fix; stuck = 0;
        end = [this.pos[0] + this.vel[0] * tl, this.pos[1] + this.vel[1] * tl, this.pos[2] + this.vel[2] * tl];
        tr = col.trace(this.pos, end);
        if (tr.as) break;
      }
      if (tr.f > 0) { this.pos = tr.e; orig = this.vel.slice(); np = 0; planes.length = 0; stuck = 0; }
      if (tr.f === 1) break;
      if (!tr.n) break;
      if (tr.f === 0) stuck++;
      if (tr.n[2] < 0.7 && tr.n[2] > -0.1) this.touch = tr.n;
      tl -= tl * tr.f;
      let dup = false;
      for (let i = 0; i < np; i++) if (dot(tr.n, planes[i]) > 0.99) { dup = true; break; }
      if (dup) {
        this.vel = clipVel(this.vel, tr.n, 1);
        this.vel[0] += tr.n[0]; this.vel[1] += tr.n[1]; this.vel[2] += tr.n[2];
        continue;
      }
      planes.push(tr.n); np++;
      if (np === 1 && !this.ground) { this.vel = clipVel(orig, tr.n, 1); orig = this.vel.slice(); continue; }
      let i;
      for (i = 0; i < np; i++) {
        this.vel = clipVel(orig, planes[i], 1);
        let j;
        for (j = 0; j < np; j++) if (j !== i && dot(this.vel, planes[j]) < 0) break;
        if (j === np) break;
      }
      if (i === np) {
        if (np !== 2) { if (!this.ground && planes.some(ramp)) { keep(); break; } this.vel = [0, 0, 0]; break; }
        const a = planes[0], b = planes[1], dir = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
        const d = dot(dir, this.vel);
        this.vel = [dir[0] * d, dir[1] * d, dir[2] * d];
      }
      if (dot(this.vel, primal) <= 0) { if (!this.ground && planes.some(ramp)) { keep(); break; } this.vel = [0, 0, 0]; break; }
    }
  }

  walk(dt) {
    const col = this.map.col;
    this.vel[2] = 0;
    const start = this.pos.slice(), sv = this.vel.slice();
    this.slide(dt);
    const downP = this.pos.slice(), downV = this.vel.slice();
    this.pos = start.slice(); this.vel = sv.slice();
    const up = col.trace(this.pos, [this.pos[0], this.pos[1], this.pos[2] + STEP]);
    if (!up.as) this.pos = up.e;
    this.slide(dt);
    const dn = col.trace(this.pos, [this.pos[0], this.pos[1], this.pos[2] - STEP - 1]);
    if (!dn.as) this.pos = dn.e;
    if (!dn.n || dn.n[2] < 0.7 || Math.hypot(downP[0] - start[0], downP[1] - start[1]) >= Math.hypot(this.pos[0] - start[0], this.pos[1] - start[1])) { this.pos = downP; this.vel = downV; }
    else this.vel[2] = downV[2];
  }

  categorize() {
    if (this.vel[2] > 180) { this.ground = null; return; }
    const tr = this.map.col.trace(this.pos, [this.pos[0], this.pos[1], this.pos[2] - 2]);
    if (tr.n && tr.n[2] >= 0.7 && tr.f < 1) { if (!this.ground && this.vel[2] < -300) this.landK = Math.min(1, -this.vel[2] / 900); this.ground = tr.n; this.pos = tr.e; if (this.vel[2] < 0) this.vel[2] = 0; }
    else this.ground = null;
  }

  tick(dt) {
    if (!this.ground) this.vel[2] -= G * 0.5 * dt;
    const jumped = this.keys.has(' ') && this.ground;
    if (jumped) { this.vel[2] = JUMP; this.ground = null; this.jumpT = performance.now(); }
    if (this.ground) {
      const sp = Math.hypot(this.vel[0], this.vel[1]);
      if (sp > 0.1) { const drop = Math.max(sp, STOP) * FRIC * dt, ns = Math.max(0, sp - drop) / sp; this.vel[0] *= ns; this.vel[1] *= ns; }
    }
    const wi = this.wish();
    if (this.ground) { this.accel(wi.dir, wi.speed, ACC, dt, false); this.walk(dt); }
    else { this.accel(wi.dir, wi.speed, AIRACC, dt, true); this.slide(dt); }
    if (!this.ground) this.vel[2] -= G * 0.5 * dt;
    for (let k = 0; k < 3; k++) this.vel[k] = Math.max(-MAXV, Math.min(MAXV, this.vel[k]));
    this.categorize();
    this.triggers();
    const mn = this.map.meta.bounds[0];
    if (this.pos[2] < mn[2] - 400) this.respawn(false);
  }

  triggers() {
    const c = [this.pos[0], this.pos[1], this.pos[2] + 36], h = [16, 16, 36];
    for (const t of this.map.trig) {
      if (c[0] + 16 < t.mins[0] || c[0] - 16 > t.maxs[0] || c[1] + 16 < t.mins[1] || c[1] - 16 > t.maxs[1] || c[2] + 36 < t.mins[2] || c[2] - 36 > t.maxs[2]) continue;
      if (!t.b.some(pl => inside(pl, c, h))) continue;
      if (t.dest) {
        this.pos = [t.dest.o[0], t.dest.o[1], t.dest.o[2] + 1];
        this.snap();
        this.vel = [0, 0, 0];
        this.yaw = t.dest.yaw;
        const key = t.dest.o.join(',');
        if (!this.reached.has(key)) {
          this.reached.add(key);
          this.check = t.dest;
          if (this.reached.size > 1 || !this.sameAsSpawn(t.dest)) this.stage();
        } else this.check = t.dest;
        return;
      }
      if (t.push) {
        const p = t.push, yaw = p[1] * D, pitch = p[0] * D;
        const dir = [Math.cos(pitch) * Math.cos(yaw), Math.cos(pitch) * Math.sin(yaw), -Math.sin(pitch)];
        for (let k = 0; k < 3; k++) this.vel[k] += dir[k] * t.speed * TICK * 6;
      }
      if (t.name && /end|finish/i.test(t.name) && !this.finished) this.finish();
    }
  }

  sameAsSpawn(d) { const s = this.map.meta.spawn.o; return Math.hypot(d.o[0] - s[0], d.o[1] - s[1], d.o[2] - s[2]) < 256; }

  stage() {
    const n = this.reached.size, tot = this.map.total;
    this.w.bank.add(0, 15, 4);
    this.w.opts.sfx?.beep?.(true);
    this.msg(`stage ${n} / ${tot}`, 2200);
    const b = this.best(), r = b[this.map.id] ||= { stages: 0 };
    r.stages = Math.max(r.stages, n);
    try { localStorage.setItem('dc.surf', JSON.stringify(b)); } catch (e) {}
    if (tot && n >= tot - 1 && !this.finished) this.finish();
  }

  finish() {
    this.finished = true;
    const t = performance.now() - this.t0;
    const b = this.best(), r = b[this.map.id] ||= { stages: 0 };
    const pb = !r.time || t < r.time;
    if (pb) r.time = t;
    try { localStorage.setItem('dc.surf', JSON.stringify(b)); } catch (e) {}
    this.w.bank.add(150, 120, 40);
    this.w.opts.sfx?.dubs?.();
    this.msg(`map done in ${this.fmt(t)}${pb ? ' · new pb' : ''}`, 5000);
  }

  frame(dt, now) {
    const w = this.w, e = this.e, m = this.map;
    if (!m) return;
    this.acc = Math.min(this.acc + dt, 0.25);
    while (this.acc >= TICK) { this.prev = this.pos.slice(); this.tick(TICK); this.acc -= TICK; }
    const a = this.acc / TICK, pv = this.prev || this.pos;
    const P = this.rpos = [pv[0] + (this.pos[0] - pv[0]) * a, pv[1] + (this.pos[1] - pv[1]) * a, pv[2] + (this.pos[2] - pv[2]) * a];
    const sp = Math.hypot(this.vel[0], this.vel[1]);
    this.hud(sp);
    const eyeS = [P[0], P[1], P[2] + 64];
    const ours = v => [v[0] * S, v[2] * S, -v[1] * S];
    const y = this.yaw * D, p = this.pitch * D;
    const fS = [Math.cos(p) * Math.cos(y), Math.cos(p) * Math.sin(y), -Math.sin(p)];
    const f = [fS[0], fS[2], -fS[1]];
    let eye = ours(eyeS);
    if (this.view === 'third') {
      const back = 130, tgt = [eyeS[0], eyeS[1], eyeS[2] - 6];
      const end = [tgt[0] - fS[0] * back, tgt[1] - fS[1] * back, tgt[2] - fS[2] * back + 14];
      const tr = m.col.trace(tgt, end, [-6, -6, -6], [6, 6, 6]);
      const want = tr.f;
      this.camF = Math.min(want, (this.camF ?? want) + dt * 1.5);
      const k = this.camF;
      eye = ours([tgt[0] + (end[0] - tgt[0]) * k, tgt[1] + (end[1] - tgt[1]) * k, tgt[2] + (end[2] - tgt[2]) * k]);
    }
    const asp = e.canvas.width / e.canvas.height;
    const VP = M4.mul(M4.persp(vfov(set.fov, asp), asp, 0.05, 900), M4.look(eye, [eye[0] + f[0], eye[1] + f[1], eye[2] + f[2]], [0, 1, 0]));
    e.amb = [0.62, 0.62, 0.66];
    e.fog = [0.05, 0.06, 0.09];
    e.fogR = [260, 880];
    const bc = m.meta.bounds;
    e.lights = [{ pos: ours([(bc[0][0] + bc[1][0]) / 2 + 9000, (bc[0][1] + bc[1][1]) / 2 + 6000, bc[1][2] + 20000]), color: [0.7, 0.68, 0.6], r: 2400, k: 1 }];
    e.begin(VP, e.fog);
    e.draw(m.obj, M4.id());
    this.drawMe(dt, now, ours, sp);
  }

  hud(sp) {
    const t = performance.now(), F = this.fps;
    F.n++;
    if (t - F.t >= 500) { F.show = Math.round(F.n * 1000 / (t - F.t)); F.n = 0; F.t = t; }
    if (t - this.hudT < 33) return;
    this.hudT = t;
    const m = this.map, txt = (sel, v) => { const el = this.$(sel); if (el.textContent !== v) el.textContent = v; };
    txt('.sf-speed', String(Math.round(sp)));
    txt('.sf-fps', F.show && set.fps ? F.show + ' fps' : '');
    txt('.sf-info', `${m.name} · ${this.fmt(t - this.t0)} · stage ${this.reached.size}/${m.total || '?'}`);
  }

  drawMe(dt, now, ours, sp) {
    const w = this.w, av = w.av, e = this.e;
    const surfing = !this.ground && this.touch && performance.now() - (this.touchT || 0) < 120;
    if (this.touch) { this.touchT = performance.now(); this.lastTouch = this.touch; }
    const mode = this.ground ? (sp > 30 ? 'run' : 'idle') : surfing ? 'surf' : 'air';
    if (mode !== this.mode) {
      this.mode = mode;
      if (mode === 'run') av.play(sp > 200 ? 'Fast_Run' : 'Jog_Fwd_Loop');
      if (mode === 'idle') av.play('Idle_Loop');
      if (mode === 'air' || mode === 'surf') av.play('Jump_Start');
    }
    if (mode === 'run' && av.cur === 'Jog_Fwd_Loop' && sp > 230) av.play('Fast_Run');
    av.update(dt);
    const vy = Math.atan2(this.vel[1], this.vel[0]) / D;
    const face = (mode === 'idle' || sp < 40) ? this.yaw : vy;
    const wrap = x => (((x % 360) + 540) % 360) - 180;
    this.faceY = this.faceY == null ? face : wrap(this.faceY + wrap(face - this.faceY) * Math.min(1, dt * 10));
    const n = this.lastTouch || [0, 0, 1];
    const tilt = surfing || (this.mode === 'air' && performance.now() - (this.touchT || 0) < 400) ? 1 : 0;
    this.tiltK = (this.tiltK || 0) + (tilt - (this.tiltK || 0)) * Math.min(1, dt * 8);
    this.pose(av, now, mode, n, sp);
    const pos = ours(this.rpos || this.pos);
    const rootYaw = (this.faceY + 90) * D;
    let m = M4.mul(M4.fromQT([0, 0, 0, 1], pos), M4.rotY(rootYaw));
    if (this.tiltK > 0.01) {
      const nO = [n[0], n[2], -n[1]];
      const up = [0, 1, 0], ax = [up[1] * nO[2] - up[2] * nO[1], up[2] * nO[0] - up[0] * nO[2], up[0] * nO[1] - up[1] * nO[0]];
      const al = Math.hypot(...ax);
      if (al > 0.01) {
        const ang = Math.acos(Math.max(-1, Math.min(1, nO[1]))) * 0.55 * this.tiltK;
        const q = Q.axis([ax[0] / al, ax[1] / al, ax[2] / al], ang);
        m = M4.mul(M4.mul(M4.fromQT([0, 0, 0, 1], [pos[0], pos[1] + 0.9, pos[2]]), M4.fromQT(q, [0, 0, 0])), M4.mul(M4.fromQT([0, 0, 0, 1], [0, -0.9, 0]), M4.rotY(rootYaw)));
      }
    }
    av.modelOverride = m;
    if (this.view === 'third') av.draw();
    if (this.view === 'third' && av.W) {
      if (this.gun) this.drawGun3(m, av);
      else if (this.card) e.draw(this.card, M4.mul(m, this.cardModel(av, now)), { unlit: 1 });
    }
    av.modelOverride = null;
    if (this.view === 'first' && this.gun) {
      this.fpArms(now, sp, dt);
      this.drawGun(now);
    } else if (this.view === 'first' && this.arms) {
      const A = this.fpArms(now, sp, dt);
      e.gl.clear(e.gl.DEPTH_BUFFER_BIT);
      e.draw(this.arms, A);
      if (this.card) e.draw(this.card, M4.mul(A, M4.fromQT(Q.mul(Q.axis([0, 1, 0], Math.PI - 0.2), Q.axis([0, 0, 1], 0.12)), [-0.14, 0.025, 0.465], 0.6)), { unlit: 1 });
    }
  }

  cardModel(av, now) {
    const R = av.rig, H = av.W[R.byName['hand.r']], L = av.W[R.byName['lowerArm.r']];
    const hp = [H[12], H[13], H[14]], d = [H[12] - L[12], H[13] - L[13], H[14] - L[14]], l = Math.hypot(...d) || 1;
    const pos = [hp[0] + d[0] / l * 0.07, hp[1] + d[1] / l * 0.07 + 0.02, hp[2] + d[2] / l * 0.07];
    const q = Q.mul(Q.axis([0, 1, 0], Math.PI - 0.25), Q.axis([0, 0, 1], (Math.sin(now * 2.3) * 4 - 8) * D));
    return M4.fromQT(q, pos, 1.5);
  }

  fpArms(now, sp, dt) {
    const y = this.yaw * D, p = this.pitch * D;
    const fS = [Math.cos(p) * Math.cos(y), Math.cos(p) * Math.sin(y), -Math.sin(p)];
    const f = [fS[0], fS[2], -fS[1]];
    const r = [Math.sin(y), 0, Math.cos(y)];
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const dy = ((this.yaw - (this.lastYaw ?? this.yaw) + 540) % 360) - 180, dp = this.pitch - (this.lastPitch ?? this.pitch);
    this.lastYaw = this.yaw; this.lastPitch = this.pitch;
    const k = Math.min(1, dt * 10);
    this.swX = (this.swX || 0) + (Math.max(-0.05, Math.min(0.05, dy * 0.004)) - (this.swX || 0)) * k;
    this.swY = (this.swY || 0) + (Math.max(-0.04, Math.min(0.04, dp * 0.004)) - (this.swY || 0)) * k;
    const run = this.ground ? Math.min(1, sp / 250) : 0;
    const bx = Math.sin(now * 8.5) * 0.012 * run, by = Math.abs(Math.cos(now * 8.5)) * 0.014 * run;
    const land = this.landK = Math.max(0, (this.landK || 0) - dt * 4);
    const ox = this.swX + bx, oy = -0.115 - by + this.swY - land * 0.05 + (this.ground ? 0 : 0.012), oz = -0.07;
    const R = this.rpos || this.pos;
    const eye = [R[0] * S, (R[2] + 64) * S, -R[1] * S];
    const t = [eye[0] - r[0] * ox + u[0] * oy + f[0] * oz, eye[1] - r[1] * ox + u[1] * oy + f[1] * oz, eye[2] - r[2] * ox + u[2] * oy + f[2] * oz];
    return new Float32Array([-r[0], -r[1], -r[2], 0, u[0], u[1], u[2], 0, f[0], f[1], f[2], 0, t[0], t[1], t[2], 1]);
  }

  pose(av, now, mode, n, sp) {
    if (!av.pose) return;
    const p = { ...av.pose.p };
    const nrm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
    const rot = (q, v) => { const r = Q.mul(Q.mul(q, [v[0], v[1], v[2], 0]), Q.conj(q)); return [r[0], r[1], r[2]]; };
    const fromTo = (a, b) => { a = nrm(a); b = nrm(b); const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; return d < -0.9999 ? [0, 0, 1, 0] : nrm([c[0], c[1], c[2], 1 + d]); };
    const aim = (bone, par, rest, dir) => { const q = fromTo(rest, rot(Q.conj(par), dir)); p[bone] = q; return Q.mul(par, q); };
    const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
    const air = mode === 'surf' || mode === 'air';
    const k = this.poseK = (this.poseK || 0) + ((air ? 1 : 0) - (this.poseK || 0)) * 0.2;
    const sw = Math.sin(now * 2.3), sw2 = Math.sin(now * 1.7 + 1);
    if (k > 0.02) {
      const tuck = mode === 'surf' ? 0 : 0.35;
      const hipQ = Q.axis([1, 0, 0], (10 + tuck * 8) * D * k);
      p.hip = Q.slerp ? hipQ : hipQ;
      const chestQ = Q.mul(hipQ, Q.mul(Q.axis([1, 0, 0], (14 + sw * 2) * D * k), Q.axis([0, 1, 0], -8 * D * k)));
      p.chest = Q.mul(Q.axis([1, 0, 0], (14 + sw * 2) * D * k), Q.axis([0, 1, 0], -8 * D * k));
      const base = av.pose.p;
      const lerpDir = (cur, tgt) => nrm(mix(cur, tgt, k));
      const ul = aim('upperLeg.l', hipQ, [0, -1, 0], lerpDir([0.1, -1, 0], [0.22, -0.68 + tuck * 0.2, 0.68 + tuck * 0.2]));
      aim('lowerLeg.l', ul, [0, -1, 0], lerpDir([0.05, -1, 0], [0.06, -0.82, -0.58 - tuck * 0.3]));
      const ur = aim('upperLeg.r', hipQ, [0, -1, 0], lerpDir([-0.1, -1, 0], [-0.22, -0.82 + tuck * 0.2, 0.45 + tuck * 0.25]));
      aim('lowerLeg.r', ur, [0, -1, 0], lerpDir([-0.05, -1, 0], [-0.05, -0.85, -0.5 - tuck * 0.3]));
      p['foot.l'] = Q.axis([1, 0, 0], -15 * D * k); p['foot.r'] = Q.axis([1, 0, 0], -12 * D * k);
      const la = aim('upperArm.l', chestQ, [1, 0, 0], lerpDir([1, -0.9, 0], [0.88, -0.3 + sw * 0.08, -0.35]));
      aim('lowerArm.l', la, [1, 0, 0], lerpDir([1, -1, 0], [0.75, -0.45, 0.15 + sw2 * 0.08]));
      if (this.card) {
        const ra = aim('upperArm.r', chestQ, [-1, 0, 0], lerpDir([-1, -0.9, 0], [-0.95, 0.12 + sw * 0.04, 0.12]));
        const rl = aim('lowerArm.r', ra, [-1, 0, 0], lerpDir([-1, -1, 0], [-0.3, 0.92, -0.08]));
        p['hand.r'] = Q.axis([0, 0, 1], 0);
      } else {
        const ra = aim('upperArm.r', chestQ, [-1, 0, 0], lerpDir([-1, -0.9, 0], [-0.88, -0.3 - sw * 0.08, -0.35]));
        aim('lowerArm.r', ra, [-1, 0, 0], lerpDir([-1, -1, 0], [-0.75, -0.45, 0.15 - sw2 * 0.08]));
      }
      p.head = Q.axis([1, 0, 0], -10 * D * k);
    } else if (this.card) {
      const chestQ = p.chest || [0, 0, 0, 1];
      const ra = aim('upperArm.r', chestQ, [-1, 0, 0], [-0.45, -0.55, 0.7]);
      aim('lowerArm.r', ra, [-1, 0, 0], [-0.1, 0.35, 0.93]);
    }
    av.pose = { p, root: k > 0.02 ? [0, av.rig.hip * (1 - 0.16 * k), 0] : av.pose.root };
  }
}
