import { Engine, place, boxG, M4, Q, merge } from './engine.js';
import { Avatar } from './avatar.js';
import { T, paint } from './tex.js';
import { Arm } from './arm.js';
import { Durak } from './durak.js';
import { Chess } from './chess.js';
import { Bank } from './bank.js';
import { Loot } from './loot.js';
import { Wheel } from './wheel.js';
import { Events } from './events.js';
import { Blyat } from './blyat.js';
import { Extras } from './extras.js';
import { Surf, lockMouse } from './surf.js';
import { Settings, set, lookK, vfov } from './settings.js';

const rotX = a => M4.fromQT(Q.axis([1, 0, 0], a), [0, 0, 0]);
const rotZ = a => M4.fromQT(Q.axis([0, 0, 1], a), [0, 0, 0]);
const at = (x, y, z) => M4.fromQT([0, 0, 0, 1], [x, y, z]);
const D = Math.PI / 180;

function poly(v, n, uv) {
  return { P: v.flat(), N: [...n, ...n, ...n, ...n], U: uv.flat(), I: [0, 1, 2, 0, 2, 3] };
}
function floorQ(x0, z0, x1, z1, y, tile, down) {
  return poly([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], [0, down ? -1 : 1, 0], [[x0 / tile, z0 / tile], [x1 / tile, z0 / tile], [x1 / tile, z1 / tile], [x0 / tile, z1 / tile]]);
}
function wallQ(ax, az, bx, bz, y0, y1, tile, n, vs = 1) {
  const L = Math.hypot(bx - ax, bz - az) / tile;
  return poly([[ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az]], n, [[0, vs], [L, vs], [L, 0], [0, 0]]);
}

export class World {
  constructor(host, opts = {}) {
    this.host = host;
    this.opts = opts;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'world-gl';
    this.ui = document.createElement('div');
    this.ui.className = 'world-ui';
    this.ui.innerHTML = `<div class="w-where"></div><div class="w-prompt" hidden></div><div class="w-say" hidden></div><div class="w-hint">wasd walk · shift run · space jump (hold to bhop) · f dropkick · v first person · q shift lock · e use · i inventory · b phrasebook</div><div class="w-fade"></div>`;
    host.append(this.canvas, this.ui);
    this.$ = s => this.ui.querySelector(s);
    this.match = null;
    this.e = new Engine(this.canvas, { pixel: opts.pixel || 3, loader: opts.loader, base: 'assets/world/' });
    this.av = new Avatar(this.e);
    this.keys = new Set();
    this.cam = { yaw: 0, pitch: 0.28, dist: 2.4, yawT: 0 };
    this.scenes = {};
    this.active = false;
    this.busy = false;
    this.idle = 0;
    this.flick = { k: 1, until: 0, next: 3 };
    this.bind();
    this.arm = new Arm(this);
    this.durak = new Durak(this);
    this.chess = new Chess(this);
    this.bank = new Bank(this);
    this.loot = new Loot(this);
    this.wheel = new Wheel(this);
    this.events = new Events(this);
    this.blyat = new Blyat(this);
    this.extras = new Extras(this);
    this.surf = new Surf(this);
    this.settings = new Settings(this);
    const emit = opts.onEvent;
    this.opts.onEvent = (ev, x) => { this.event(ev, x); emit?.(ev, x); };
    this.npcs = [];
    this.ready = this.load();
  }

  bind() {
    const typing = e => e.target.closest?.('input, textarea, select');
    addEventListener('keydown', e => {
      if (!this.active || typing(e)) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      this.keys.add(k);
      if (e.shiftKey) this.keys.add('shift');
      if (k === 'e' && !e.repeat) this.use();
      if ((k === 'v' || k === 'м') && !e.repeat && !this.surfOn && !this.busy) { this.fp = !this.fp; this.slock = false; if (this.fp) lockMouse(this.canvas); else document.exitPointerLock?.(); }
      if ((k === 'q' || k === 'й') && !e.repeat && !this.surfOn && !this.busy) { this.slock = !this.slock; this.fp = false; if (this.slock) lockMouse(this.canvas); else document.exitPointerLock?.(); }
      if ((k === 'f' || k === 'а') && !e.repeat && !this.busy && !this.kickS && !this.seated) this.dropkick();
      this.$('.w-hint').classList.add('gone');
    });
    addEventListener('keyup', e => { this.keys.delete(e.key.toLowerCase()); if (!e.shiftKey) this.keys.delete('shift'); });
    addEventListener('blur', () => this.keys.clear());
    let drag = null;
    this.canvas.addEventListener('pointerdown', e => { if ((this.fp || this.slock) && !this.surfOn && document.pointerLockElement !== this.canvas && !this.busy) lockMouse(this.canvas); drag = [e.clientX, e.clientY]; this.canvas.setPointerCapture(e.pointerId); });
    addEventListener('mousemove', e => {
      if (this.surfOn || !this.active || document.pointerLockElement !== this.canvas) return;
      if (Math.abs(e.movementX) > 2500 || Math.abs(e.movementY) > 2500) return;
      const k = lookK() * (this.fp ? 1 : 3.3), my = e.movementY * (set.invert ? -1 : 1);
      this.cam.yaw -= e.movementX * k;
      this.cam.pitch = Math.max(this.fp ? -1.5 : -0.2, Math.min(this.fp ? 1.5 : 1.1, this.cam.pitch + my * k));
      this.camTouched = performance.now();
    });
    this.canvas.addEventListener('pointermove', e => {
      if (!drag) return;
      this.cam.yaw -= (e.clientX - drag[0]) * 0.006;
      this.cam.pitch = Math.max(-0.2, Math.min(1.1, this.cam.pitch + (e.clientY - drag[1]) * 0.004));
      drag = [e.clientX, e.clientY];
      this.camTouched = performance.now();
    });
    this.canvas.addEventListener('pointerup', () => drag = null);
    this.canvas.addEventListener('wheel', e => { this.zoom = Math.max(0.6, Math.min(1.6, (this.zoom || 1) + Math.sign(e.deltaY) * 0.1)); }, { passive: true });
    this.$('.w-prompt').addEventListener('click', () => this.use());
  }

  async load() {
    const e = this.e;
    const t = {};
    for (const k of ['concrete', 'wall', 'ceiling', 'wood', 'fabric', 'door', 'asphalt', 'dirt', 'garage', 'brick']) t[k] = e.texCanvas(T[k](), null, true);
    t.pipe = e.texCanvas(T.metal('#4b5a50'), null, true);
    t.rust = e.texCanvas(T.metal('#6d5844'), null, true);
    t.panelD = e.texCanvas(T.panel(false), null, true);
    t.panelN = e.texCanvas(T.panel(true), null, true);
    this.t = t;
    this.screenC = paint(128, 96, () => {});
    this.screenT = e.texCanvas(this.screenC);
    await this.av.load(this.opts.skin || 'sas');
    await Promise.all([this.buildBasement(), this.buildYard()]);
    this.chess.build();
    await this.events.build();
    await this.extras.build();
    this.go('basement', true);
  }

  async put(sc, name, x, y, z, ry = 0, s = 1, extra) {
    const o = await this.e.prop(name);
    let m = place([x, y, z], ry, s);
    if (extra) m = M4.mul(m, extra);
    sc.items.push({ obj: o, m });
    return o;
  }

  shape(sc, g, tex, tint, opts) {
    const o = this.e.shape(g, tex, tint);
    sc.items.push({ obj: o, m: M4.id(), o: opts });
    return o;
  }

  solid(sc, x0, z0, x1, z1, h = 99) { sc.col.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), h]); }

  async buildBasement() {
    const t = this.t, H = 2.6, X0 = -4, X1 = 4, Z0 = -3, Z1 = 3;
    const sc = this.scenes.basement = { name: 'basement', items: [], col: [], acts: [], bounds: [X0, X1, Z0, Z1, H], amb: [0.1, 0.1, 0.11], fog: [0.02, 0.022, 0.02], fogR: [5, 14], spawn: [0.6, 0, 1.6, Math.PI], cam: 2.3 };
    this.shape(sc, floorQ(X0, Z0, X1, Z1, 0, 1.6), t.concrete);
    this.shape(sc, floorQ(X0, Z0, X1, Z1, H, 1.6, true), t.ceiling);
    this.shape(sc, merge(wallQ(X0, Z0, X1, Z0, 0, H, 1.3, [0, 0, 1]), wallQ(X1, Z1, X0, Z1, 0, H, 1.3, [0, 0, -1]), wallQ(X0, Z1, X0, Z0, 0, H, 1.3, [1, 0, 0]), wallQ(X1, Z0, X1, Z1, 0, H, 1.3, [-1, 0, 0])), t.wall);
    this.solid(sc, -99, -99, 99, Z0); this.solid(sc, -99, Z1, 99, 99); this.solid(sc, -99, -99, X0, 99); this.solid(sc, X1, -99, 99, 99);

    this.shape(sc, merge(boxG(8, 0.09, 0.09, 0, 2.42, -2.82), boxG(8, 0.06, 0.06, 0, 2.3, -2.86), boxG(0.09, 0.09, 6, 3.82, 2.42, 0), boxG(0.06, 2.4, 0.06, 3.86, 1.2, -2.86)), t.pipe);
    this.shape(sc, merge(boxG(0.12, 0.12, 0.3, -1.2, 2.42, -2.82), boxG(0.12, 0.12, 0.3, 2.1, 2.42, -2.82)), t.rust);

    this.shape(sc, merge(boxG(1.25, 0.05, 0.62, -3.25, 0.74, -2.6), boxG(0.05, 0.72, 0.05, -3.82, 0.36, -2.34), boxG(0.05, 0.72, 0.05, -2.68, 0.36, -2.34), boxG(0.05, 0.72, 0.05, -3.82, 0.36, -2.86), boxG(0.05, 0.72, 0.05, -2.68, 0.36, -2.86)), t.wood);
    this.solid(sc, -3.9, -3, -2.6, -2.25, 1.35);
    this.crt = await this.put(sc, 'crt', -3.3, 0.765, -2.62, 0, 1);
    this.crtScreen = this.shape(sc, poly([[-3.53, 0.86, -2.38], [-3.13, 0.86, -2.38], [-3.13, 1.17, -2.38], [-3.53, 1.17, -2.38]], [0, 0, 1], [[0, 1], [1, 1], [1, 0], [0, 0]]), this.screenT, [1, 1, 1, 1], { emit: 1.2, unlit: 1 });
    await this.put(sc, 'chips', -2.9, 0.765, -2.42, 0.4, 0.9);
    this.shape(sc, merge(boxG(0.36, 0.04, 0.36, -3.1, 0.46, -1.8), boxG(0.04, 0.44, 0.04, -3.1, 0.22, -1.8)), t.wood);
    sc.acts.push({ p: [-3.25, 1, -2.2], r: 1.35, label: 'use the terminal (trade ups)', act: () => this.terminal() });

    this.shape(sc, merge(boxG(2.1, 0.42, 0.85, 0.3, 0.21, -2.55), boxG(2.1, 0.55, 0.22, 0.3, 0.6, -2.88), boxG(0.22, 0.62, 0.85, -0.86, 0.31, -2.55), boxG(0.22, 0.62, 0.85, 1.46, 0.31, -2.55)), t.fabric);
    this.solid(sc, -0.95, -3, 1.55, -2.1, 0.9);
    await this.put(sc, 'rug0', 0.3, 1.75, -2.985, 0, 1.55, M4.mul(rotX(90 * D), M4.fromQT(Q.axis([0, 1, 0], 90 * D), [0, 0, 0])));
    await this.put(sc, 'rug1', 0.4, 0.002, -0.6, 90 * D, 1.6);
    sc.acts.push({ p: [0.3, 0.5, -2.3], r: 1.1, label: 'sit', act: () => this.sit([0.3, 0, -2.45]) });

    await this.put(sc, 'radiator', -3.88, 0.12, 0.3, 0, 1);
    this.solid(sc, -4, -0.3, -3.75, 0.9, 0.75);
    this.shape(sc, merge(boxG(1.0, 0.04, 0.02, -3.99, 2.14, 0.3), boxG(1.0, 0.04, 0.02, -3.99, 1.82, 0.3)), t.rust);
    this.windowQ = this.shape(sc, poly([[-3.985, 1.84, -0.18], [-3.985, 1.84, 0.78], [-3.985, 2.12, 0.78], [-3.985, 2.12, -0.18]], [1, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]), null, [0.5, 0.6, 0.7, 1], { emit: 1, unlit: 1 });

    await this.put(sc, 'vending', 3.35, 0, -2.35, -90 * D, 1);
    this.solid(sc, 2.8, -3, 3.95, -1.7);
    sc.acts.push({ p: [3.2, 1, -1.6], r: 1.3, label: 'vending machine', act: () => this.loot.open('vend') });

    this.shape(sc, merge(boxG(0.9, 0.04, 0.3, 3.84, 1.5, 1.2), boxG(0.04, 0.2, 0.04, 3.95, 1.4, 0.85), boxG(0.04, 0.2, 0.04, 3.95, 1.4, 1.55)), t.wood);
    await this.put(sc, 'mexi', 3.82, 1.52, 1.2, -90 * D, 0.7);
    sc.acts.push({ p: [3.6, 1.5, 1.2], r: 1.2, label: 'pet', act: () => this.say(['хороший мальчик', 'кто это вообще', 'он смотрит на меня']) });

    this.shape(sc, merge(boxG(1.1, 0.06, 1.1, 1.6, 0.74, 1.0), boxG(0.12, 0.72, 0.12, 1.6, 0.36, 1.0), boxG(0.6, 0.04, 0.6, 1.6, 0.02, 1.0)), t.wood);
    this.solid(sc, 1.1, 0.5, 2.1, 1.5, 0.8);
    this.cardTable = [1.6, 0, 1.0];
    this.shape(sc, merge(boxG(0.36, 0.42, 0.36, 1.6, 0.21, 0.32), boxG(0.36, 0.42, 0.36, 1.6, 0.21, 1.68)), t.wood);
    const cards = paint(64, 64, (x, R) => { x.fillStyle = '#e8e2d2'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#a02020'; x.font = 'bold 26px serif'; x.fillText('♥', 18, 42); });
    const back = paint(32, 32, x => { x.fillStyle = '#7a1e1e'; x.fillRect(0, 0, 32, 32); x.strokeStyle = '#e0c080'; x.strokeRect(3, 3, 26, 26); });
    const ct = this.e.texCanvas(cards), cb = this.e.texCanvas(back);
    for (let i = 0; i < 6; i++) this.shape(sc, boxG(0.09, 0.004, 0.13, 1.35 + (i % 3) * 0.12, 0.775 + i * 0.002, 0.72 + (i > 2 ? 0.55 : 0)), cb);
    this.shape(sc, boxG(0.09, 0.004, 0.13, 1.62, 0.778, 1.0), ct);
    this.shape(sc, boxG(0.09, 0.03, 0.13, 1.85, 0.79, 1.15), cb);
    sc.acts.push({ p: [1.6, 0.8, 1.0], r: 1.3, label: 'durak (cards)', act: () => this.game('durak') });

    this.shape(sc, merge(boxG(0.7, 0.06, 0.7, -1.8, 0.7, 1.6), boxG(0.5, 0.68, 0.5, -1.8, 0.34, 1.6)), t.rust);
    this.solid(sc, -2.15, 0.58, -1.45, 2.62, 0.8);
    this.chessTable = [-1.8, 0.732, 1.6];
    this.shape(sc, boxG(0.008, 0.62, 0.008, -1.8, 2.29, 1.6), t.pipe);
    sc.items.push({ obj: this.e.shape(boxG(0.06, 0.08, 0.06, -1.8, 1.95, 1.6), null, [1, 0.85, 0.55, 1]), m: M4.id(), o: { unlit: 1 } });
    this.shape(sc, merge(boxG(0.34, 0.42, 0.34, -1.8, 0.21, 0.75), boxG(0.34, 0.42, 0.34, -1.8, 0.21, 2.45)), t.wood);
    sc.acts.push({ p: [-1.8, 0.8, 1.6], r: 1.2, label: 'chess', act: () => this.game('chess') });

    const B = this.barrel = [-0.4, 0, 1.75];
    this.shape(sc, merge(boxG(0.56, 0.93, 0.56, B[0], 0.465, B[2]), boxG(0.62, 0.05, 0.62, B[0], 0.2, B[2]), boxG(0.62, 0.05, 0.62, B[0], 0.75, B[2])), t.rust);
    this.solid(sc, B[0] - 0.3, B[2] - 0.3, B[0] + 0.3, B[2] + 0.3, 0.98);
    this.shape(sc, boxG(0.5, 0.03, 0.5, B[0], 0.945, B[2]), t.wood);
    sc.acts.push({ p: [B[0], 1, B[2]], r: 1.2, label: 'arm wrestling', act: () => this.arm.open() });

    this.shape(sc, poly([[2.2, 0, 2.985], [3.2, 0, 2.985], [3.2, 2.05, 2.985], [2.2, 2.05, 2.985]], [0, 0, -1], [[0, 1], [1, 1], [1, 0], [0, 0]]), t.door);
    this.shape(sc, merge(boxG(1.12, 0.08, 0.06, 2.7, 2.09, 2.97), boxG(0.06, 2.1, 0.06, 2.17, 1.05, 2.97), boxG(0.06, 2.1, 0.06, 3.23, 1.05, 2.97)), t.wood);
    sc.acts.push({ p: [2.7, 1, 2.7], r: 1.1, label: 'go outside', act: () => this.travel('yard', [1.5, 0, -6.2, 0]) });

    this.tube = this.e.shape(merge(boxG(1.2, 0.05, 0.05, 0, 2.5, -0.2), boxG(0.03, 0.1, 0.03, -0.5, 2.56, -0.2), boxG(0.03, 0.1, 0.03, 0.5, 2.56, -0.2)), null, [1, 1, 0.92, 1]);
    sc.items.push({ obj: this.tube, m: M4.id(), o: { unlit: 1 }, tube: true });
    sc.lights = (now, night) => [
      { pos: [0, 2.35, -0.2], color: [1.0, 0.95, 0.82], r: 7.5, k: this.flick.k * 1.15 },
      { pos: [-3.3, 1.05, -2.0], color: [0.35, 0.75, 0.55], r: 2.2, k: 0.7 + Math.sin(now * 13) * 0.05 },
      { pos: [3.0, 1.2, -1.7], color: [0.9, 0.85, 0.7], r: 2.4, k: 0.8 },
      { pos: [-3.6, 2.0, 0.3], color: night ? [0.2, 0.25, 0.45] : [0.7, 0.75, 0.8], r: 3.2, k: night ? 0.5 : 0.9 },
      { pos: [-1.8, 1.75, 1.6], color: [1.0, 0.8, 0.5], r: 1.9, k: 0.9 + Math.sin(now * 3.1) * 0.04 }
    ];
  }

  async buildYard() {
    const t = this.t, X0 = -12, X1 = 12, Z0 = -9, Z1 = 9;
    const sc = this.scenes.yard = { name: 'yard', items: [], col: [], acts: [], bounds: [X0, X1, Z0, Z1, 30], amb: [0.5, 0.52, 0.55], fog: [0.62, 0.66, 0.7], fogR: [10, 34], spawn: [1.5, 0, -6.2, 0], cam: 3.6, sky: true };
    this.shape(sc, floorQ(-40, -40, 40, 40, 0, 3), t.asphalt);
    this.shape(sc, merge(floorQ(-11, 3.5, -4, 8.5, 0.01, 2), floorQ(5, -8.5, 11, -4.5, 0.01, 2)), t.dirt);
    this.solid(sc, -99, -99, 99, Z0); this.solid(sc, -99, Z1, 99, 99); this.solid(sc, -99, -99, X0, 99); this.solid(sc, X1, -99, 99, 99);

    const bld = (cx, cz, w, d, h, ry) => {
      const g = boxG(w, h, d, 0, h / 2, 0);
      for (let f = 0; f < 4; f++) {
        const W = f < 2 ? w : d;
        for (let v = 0; v < 4; v++) { b(g, f, v, W, h); }
      }
      for (let v = 0; v < 8; v++) { g.U[(16 + v) * 2] = 0.95; g.U[(16 + v) * 2 + 1] = 0.97; }
      return { g, m: M4.mul(at(cx, 0, cz), M4.rotY(ry)) };
      function b(g, f, v, W, h) { g.U[(f * 4 + v) * 2] = g.U[(f * 4 + v) * 2] * W / 12.8; g.U[(f * 4 + v) * 2 + 1] = g.U[(f * 4 + v) * 2 + 1] * h / 11.2; }
    };
    this.blds = [];
    for (const [cx, cz, w, d, h, ry] of [[0, -14, 30, 10, 14, 0], [-17, 0, 10, 24, 14, 0], [17, 2, 10, 20, 11.2, 0], [0, 15, 26, 8, 14, 0]]) {
      const b = bld(cx, cz, w, d, h, ry);
      const o = this.e.shape(b.g, t.panelD);
      sc.items.push({ obj: o, m: b.m, bld: true });
    }
    this.shape(sc, merge(boxG(2.4, 2.4, 1.6, 1.5, 1.2, -8.2), boxG(2.6, 0.12, 1.9, 1.5, 2.46, -8.1)), t.brick);
    this.shape(sc, poly([[1.0, 0, -7.39], [2.0, 0, -7.39], [2.0, 2.0, -7.39], [1.0, 2.0, -7.39]], [0, 0, 1], [[0, 1], [1, 1], [1, 0], [0, 0]]), t.door);
    this.solid(sc, 0.3, -9, 2.7, -7.4, 2.6);
    sc.acts.push({ p: [1.5, 1, -7.1], r: 1.3, label: 'go to the basement', act: () => this.travel('basement', [2.7, 0, 2.3, Math.PI]) });

    await this.put(sc, 'lada', -4.5, 0, -2.5, 75 * D, 1);
    this.solid(sc, -6.4, -3.4, -2.6, -1.6, 1.4);
    sc.acts.push({ p: [-4.5, 0.8, -2.5], r: 2.6, label: 'honk', act: () => this.honk() });

    for (let i = 0; i < 5; i++) {
      const x = 4.2 + i * 1.6;
      this.shape(sc, merge(boxG(1.55, 2.2, 3.2, x, 1.1, 6.8), boxG(1.6, 0.08, 3.4, x, 2.24, 6.75)), t.garage);
    }
    this.solid(sc, 3.4, 5.2, 11.6, 9, 2.3);

    this.shape(sc, merge(boxG(1.8, 0.06, 0.45, -6.5, 0.45, 4.4), boxG(1.8, 0.4, 0.06, -6.5, 0.7, 4.62), boxG(0.08, 0.45, 0.4, -7.3, 0.22, 4.4), boxG(0.08, 0.45, 0.4, -5.7, 0.22, 4.4)), t.wood);
    this.solid(sc, -7.4, 4.15, -5.6, 4.7, 0.9);
    sc.acts.push({ p: [-6.5, 0.5, 4.2], r: 1.2, label: 'sit', act: () => this.sit([-6.5, 0, 4.35]) });

    this.shape(sc, merge(boxG(0.14, 5, 0.14, 4, 2.5, -3), boxG(1.1, 0.1, 0.14, 3.5, 5, -3), boxG(0.4, 0.12, 0.3, 3.0, 4.92, -3)), t.pipe);
    this.solid(sc, 3.85, -3.15, 4.15, -2.85, 5);
    this.lamp = this.e.shape(boxG(0.3, 0.03, 0.22, 3.0, 4.85, -3), null, [1, 0.85, 0.55, 1]);
    sc.items.push({ obj: this.lamp, m: M4.id(), o: { unlit: 1 }, lamp: true });

    this.shape(sc, merge(boxG(0.12, 1.8, 0.12, -9, 0.9, -5), boxG(0.12, 1.8, 0.12, -9, 0.9, -1), boxG(0.06, 0.06, 4, -9, 1.6, -3)), t.rust);
    this.solid(sc, -9.1, -5.1, -8.9, -0.9, 1.8);

    const hz = new Avatar(this.e);
    hz.load('assets/chars/hazmat').then(() => { hz.play('Idle_Loop'); hz.pos = [8.6, 0, 4.2]; hz.yaw = Math.PI * 0.95; this.npcs.push({ av: hz, scene: 'yard' }); }).catch(() => {});
    this.solid(sc, 8.3, 3.9, 8.9, 4.5, 2);
    sc.acts.push({ p: [8.6, 1.2, 4.0], r: 1.4, label: 'sell skins for scrap', act: () => { this.say(['чё продаёшь', 'скрап есть скрап']); this.loot.inventory(); } });
    this.wheel.draw();
    const wg = this.e.texCanvas(this.wheel.cv);
    this.shape(sc, merge(boxG(0.12, 1.1, 0.12, 6.7, 0.55, 4.4), boxG(1.5, 0.1, 0.5, 6.7, 0.05, 4.4)), t.rust);
    this.shape(sc, poly([[7.35, 0.75, 4.32], [6.05, 0.75, 4.32], [6.05, 2.05, 4.32], [7.35, 2.05, 4.32]], [0, 0, -1], [[0, 1], [1, 1], [1, 0], [0, 0]]), wg);
    this.solid(sc, 5.95, 4.15, 7.45, 4.65, 2.1);
    sc.acts.push({ p: [6.7, 1.3, 4.1], r: 1.5, label: 'scrap wheel', act: () => this.wheel.open() });
    this.shape(sc, boxG(1.0, 0.75, 0.6, 3.6, 0.375, 4.6), t.wood);
    await this.put(sc, 'crt', 3.6, 0.75, 4.55, Math.PI, 0.9);
    this.shape(sc, boxG(0.45, 0.4, 0.45, 4.25, 0.2, 4.6), t.rust);
    this.solid(sc, 3.0, 4.25, 4.5, 4.95, 1.3);
    sc.acts.push({ p: [3.6, 1.0, 4.1], r: 1.4, label: 'surf servers', act: () => this.surf.open() });
    this.dropAt = [-1.5, 0, 2.2];
    this.drop = this.e.shape(merge(boxG(0.9, 0.6, 0.9, 0, 0.3, 0), boxG(0.95, 0.08, 0.95, 0, 0.62, 0), boxG(0.06, 0.66, 0.95, 0.47, 0.33, 0), boxG(0.06, 0.66, 0.95, -0.47, 0.33, 0)), this.e.texCanvas(paint(32, 32, (x) => { x.fillStyle = '#3a5f8a'; x.fillRect(0, 0, 32, 32); x.fillStyle = '#e8e2c8'; x.fillRect(0, 13, 32, 6); x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(0, 0, 32, 2); })));
    this.smoke = this.e.shape(boxG(0.25, 0.25, 0.25), null, [0.35, 0.9, 0.4, 1]);
    sc.acts.push({ p: [this.dropAt[0], 0.7, this.dropAt[2]], r: 1.4, label: 'open airdrop', cond: () => this.bank.dropReady(), act: () => this.claimDrop() });
    this.chicken = { pos: [2, 0, 3], yaw: 0, tgt: [2, 0, 3], fly: 0, vy: 0, t: 0 };
    this.chickenObj = {
      body: this.e.shape(merge(boxG(0.18, 0.16, 0.26, 0, 0.26, 0), boxG(0.12, 0.14, 0.11, 0, 0.38, 0.12), boxG(0.06, 0.1, 0.04, 0, 0.3, -0.15)), null, [0.93, 0.92, 0.86, 1]),
      comb: this.e.shape(merge(boxG(0.03, 0.05, 0.08, 0, 0.47, 0.12), boxG(0.03, 0.04, 0.03, 0, 0.36, 0.19)), null, [0.8, 0.12, 0.1, 1]),
      beak: this.e.shape(boxG(0.04, 0.03, 0.05, 0, 0.39, 0.2), null, [0.9, 0.6, 0.1, 1]),
      legs: this.e.shape(merge(boxG(0.02, 0.18, 0.02, 0.05, 0.09, 0), boxG(0.02, 0.18, 0.02, -0.05, 0.09, 0)), null, [0.9, 0.6, 0.1, 1])
    };
    sc.acts.push({ p: this.chicken.pos, r: 1.0, label: 'kick the chicken', cond: () => !this.chicken.fly, act: () => this.kickChicken() });
    sc.lights = (now, night) => night
      ? [{ pos: [3.0, 4.6, -3], color: [1, 0.78, 0.45], r: 11, k: 1.4 }, { pos: [1.5, 2.6, -7.2], color: [0.9, 0.85, 0.6], r: 4, k: 0.9 }]
      : [{ pos: [0, 30, 0], color: [1, 0.97, 0.9], r: 80, k: 0.7 }];
  }

  event(ev, x) {
    const m = /^(arm|durak|chess)_(win|lose|w|l|d)$/.exec(ev);
    if (m) this.bank.reward(m[1], x, m[2][0] === 'w' ? 'w' : m[2][0] === 'd' ? 'd' : 'l');
    if (m && m[2][0] === 'l') setTimeout(() => this.extras.ohneShow(), 1200);
    if (ev === 'case' && x <= 2 && Math.random() < 0.25) setTimeout(() => this.extras.ohneShow(), 600);
  }

  claimDrop() {
    if (!this.bank.dropReady()) return;
    this.bank.claimDrop();
    this.bank.add(400, 60, 20);
    const cr = this.loot.crates();
    if (cr.length && Math.random() < 0.35) {
      const it = this.loot.roll(cr[Math.random() * cr.length | 0]);
      this.bank.s.inv.push(it); this.bank.save();
      this.say('airdrop had a skin: ' + it.hash.replace(/ \(.*\)$/, ''), 3500);
    } else this.say(['аирдроп мой', 'халява', 'спасибо самолёт']);
    this.opts.sfx?.ok?.();
  }

  kickChicken() {
    const c = this.chicken, av = this.av;
    const dx = c.pos[0] - av.pos[0], dz = c.pos[2] - av.pos[2], l = Math.hypot(dx, dz) || 1;
    c.fly = 1; c.vy = 4.5; c.vx = dx / l * 4; c.vz = dz / l * 4;
    av.yaw = Math.atan2(dx, dz);
    av.play('Interact', true); av.onDone = () => av.play('Idle_Loop');
    this.say(['кудах', 'ГОООЛ', 'прости курочка'], 1600);
    this.opts.sfx?.poke?.();
  }

  chickenStep(dt, now) {
    const c = this.chicken, av = this.av;
    if (c.fly) {
      c.pos[0] += c.vx * dt; c.pos[2] += c.vz * dt; c.pos[1] += c.vy * dt; c.vy -= 9 * dt; c.spin = (c.spin || 0) + dt * 14;
      const [X0, X1, Z0, Z1] = this.scenes.yard.bounds;
      c.pos[0] = Math.max(X0 + 0.3, Math.min(X1 - 0.3, c.pos[0])); c.pos[2] = Math.max(Z0 + 0.3, Math.min(Z1 - 0.3, c.pos[2]));
      if (c.pos[1] <= 0) { c.pos[1] = 0; c.fly = 0; c.spin = 0; c.tgt = c.pos.slice(); }
      return;
    }
    const dx = c.pos[0] - av.pos[0], dz = c.pos[2] - av.pos[2], d = Math.hypot(dx, dz);
    let sp = 0.5;
    if (d < 1.6 && this.scene === this.scenes.yard) { c.tgt = [c.pos[0] + dx / d * 2.5, 0, c.pos[2] + dz / d * 2.5]; sp = 2.2; }
    const tx = c.tgt[0] - c.pos[0], tz = c.tgt[2] - c.pos[2], tl = Math.hypot(tx, tz);
    if (tl < 0.1) { if (Math.random() < dt * 0.6) c.tgt = [c.pos[0] + (Math.random() - 0.5) * 6, 0, c.pos[2] + (Math.random() - 0.5) * 6]; c.walk = 0; }
    else { c.pos[0] += tx / tl * sp * dt; c.pos[2] += tz / tl * sp * dt; c.yaw = Math.atan2(tx, tz); c.walk = sp; }
    const [X0, X1, Z0, Z1] = this.scenes.yard.bounds;
    c.pos[0] = Math.max(X0 + 0.3, Math.min(X1 - 0.3, c.pos[0])); c.pos[2] = Math.max(Z0 + 0.3, Math.min(Z1 - 0.3, c.pos[2]));
    const before = c.pos.slice();
    this.collide(c.pos, 0.15);
    if (Math.hypot(before[0] - c.pos[0], before[2] - c.pos[2]) > 0.001) c.tgt = c.pos.slice();
  }

  drawYardExtras(now) {
    const e = this.e, c = this.chicken, o = this.chickenObj;
    const bob = c.walk ? Math.abs(Math.sin(now * 14)) * 0.03 : Math.sin(now * 2) * 0.005;
    const m = M4.mul(M4.mul(at(c.pos[0], c.pos[1] + bob, c.pos[2]), M4.rotY(c.yaw)), rotX(c.spin || 0));
    e.draw(o.body, m); e.draw(o.comb, m); e.draw(o.beak, m); e.draw(o.legs, m);
    if (this.bank.dropReady()) {
      const D = this.dropAt;
      e.draw(this.drop, at(D[0], 0, D[2]));
      for (let i = 0; i < 6; i++) {
        const k = ((now * 0.35 + i / 6) % 1), s = 0.35 + k * 1.1;
        e.draw(this.smoke, M4.mul(at(D[0] + 0.5 + Math.sin(i * 3 + now) * 0.2 * k, 0.7 + k * 3.2, D[2] + Math.cos(i * 2) * 0.3 * k), M4.fromQT([0, 0, 0, 1], [0, 0, 0], s)), { unlit: 1, tint: [0.85, 0.9, 0.85, 1] });
      }
    }
  }

  async loadArms() {
    if (this.armsP) return this.armsP;
    this.armsP = (async () => { const d = await this.e.json('assets/fp/fparms.json'); this.arms = this.e.shape({ P: d.pos, N: d.nor, U: d.uv, I: d.idx }, await this.e.texUrl('assets/fp/fparms.png', false, false)); })().catch(() => {});
    return this.armsP;
  }

  drawArms(now, dt) {
    if (!this.arms) { this.loadArms(); return; }
    const { eye, f } = this.fpEye, y = this.fpEye.yaw;
    const r = [-Math.cos(y), 0, Math.sin(y)];
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const hs = Math.hypot(...(this.hv || [0, 0]));
    const run = this.av.pos[1] > 0 ? 0 : Math.min(1, hs / 3.4);
    const bx = Math.sin(now * 8) * 0.012 * run, by = Math.abs(Math.cos(now * 8)) * 0.014 * run;
    const ox = bx, oy = -0.13 - by - (this.vy > 0 ? 0.02 : 0), oz = -0.06;
    const t = [eye[0] - r[0] * ox + u[0] * oy + f[0] * oz, eye[1] - r[1] * ox + u[1] * oy + f[1] * oz, eye[2] - r[2] * ox + u[2] * oy + f[2] * oz];
    const A = new Float32Array([-r[0], -r[1], -r[2], 0, u[0], u[1], u[2], 0, f[0], f[1], f[2], 0, t[0], t[1], t[2], 1]);
    this.e.gl.clear(this.e.gl.DEPTH_BUFFER_BIT);
    this.e.draw(this.arms, A);
  }

  dropkick() {
    const av = this.av;
    this.kickS = { t: 0, d: [Math.sin(av.yaw), Math.cos(av.yaw)], hit: false };
    av.play('Drop_Kick', true);
    av.onDone = () => { this.kickS = null; av.play('Idle_Loop'); };
    this.say(['ХАААА', 'ДРОПКИК', 'спарта'], 1200);
  }

  kickHit(d) {
    const av = this.av, sc = this.scene;
    const hits = [];
    const test = (v, cb) => { const dx = v.pos[0] - av.pos[0], dz = v.pos[2] - av.pos[2], dist = Math.hypot(dx, dz); if (dist < 1.9 && (dx * d[0] + dz * d[1]) / (dist || 1) > 0.35) cb(dist); };
    for (const n of this.npcs) if (this.scenes[n.scene] === sc) test(n.av, () => hits.push({ av: n.av, after: () => n.av.play('Idle_Loop'), line: ['ты чё блять', 'мой скрап!', 'ай'] }));
    for (const c of this.extras.crowd) if (c.scene === sc && !c.dead) test(c.av, () => hits.push({ av: c.av, after: () => { if (c.think) { c.dead = true; c.t = 0; } else c.av.play('Idle_Loop'); }, crowd: c }));
    const g = this.events.ghost;
    if (g && this.events.marketOpen() && sc === this.scenes.basement) test(g, () => hits.push({ av: g, after: () => g.play('Idle_FoldArms_Loop'), line: ['эй я призрак', 'больно вообще-то'] }));
    const ch = this.chicken;
    if (sc === this.scenes.yard && !ch.fly) test({ pos: ch.pos }, () => { ch.fly = 1; ch.vy = 6; ch.vx = d[0] * 7; ch.vz = d[1] * 7; this.say('КУДАХ', 900); });
    for (const h of hits) {
      if (h.crowd) { h.crowd.think = null; h.crowd.vel = null; }
      h.av.play('Knocked_Out', true);
      h.av.onDone = h.after;
      (this.kb ||= []).push({ av: h.av, v: [d[0] * 4.5, d[1] * 4.5], t: 0.6 });
      if (h.line) setTimeout(() => this.say(h.line[Math.random() * h.line.length | 0], 1500), 900);
    }
    if (hits.length) { this.opts.sfx?.poke?.(); this.opts.sfx?.push?.(); }
  }

  timeOfDay() {
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    const day = h >= 8 && h < 16.5 ? 1 : h >= 7 && h < 8 ? h - 7 : h >= 16.5 && h < 18 ? (18 - h) / 1.5 : 0;
    return day;
  }

  go(name, first) {
    const sc = this.scene = this.scenes[name];
    const s = sc.spawn;
    this.av.pos = [s[0], 0, s[2]]; this.av.yaw = s[3];
    this.cam.yaw = s[3]; this.cam.dist = sc.cam;
    this.$('.w-where').textContent = sc.name;
    if (!first) this.opts.onEvent?.('door');
  }

  travel(name, spawn) {
    if (this.busy) return;
    this.busy = true;
    const f = this.$('.w-fade');
    f.classList.add('on');
    setTimeout(() => {
      this.scenes[name].spawn = spawn;
      this.go(name);
      setTimeout(() => { f.classList.remove('on'); this.busy = false; }, 120);
    }, 420);
  }

  say(lines, ms = 2400) {
    const t = Array.isArray(lines) ? lines[Math.random() * lines.length | 0] : lines;
    const b = this.$('.w-say');
    b.textContent = t; b.hidden = false;
    clearTimeout(this.sayT);
    this.sayT = setTimeout(() => b.hidden = true, ms);
    this.opts.onEvent?.('say', t);
  }

  honk() {
    try {
      const a = this.ac ||= new AudioContext(), g = a.createGain();
      g.gain.value = 0.06 * (this.opts.volume?.() ?? 0.5); g.connect(a.destination);
      for (const f of [392, 466]) { const o = a.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(g); o.start(); o.stop(a.currentTime + 0.45); }
    } catch (e) {}
    this.say(['би-бип', 'кто тут припарковался блять', 'заводится? нет']);
  }

  sit(p) {
    if (this.busy) return;
    this.av.pos = [p[0], 0, p[2]];
    this.av.yaw = 0;
    this.av.play('Sitting_Enter', true);
    this.av.onDone = () => this.av.play('Sitting_Idle_Loop');
    this.seated = true;
  }

  stand() {
    this.seated = false;
    this.events?.wake();
    this.av.play('Sitting_Exit', true);
    this.busy = true;
    this.av.onDone = () => { this.busy = false; this.av.play('Idle_Loop'); };
  }

  terminal() {
    if (this.busy) return;
    this.busy = true;
    this.av.yaw = Math.atan2(-3.3 - this.av.pos[0], -2.6 - this.av.pos[2]);
    this.av.play('Interact', true);
    this.opts.onEvent?.('terminal');
    this.av.onDone = () => { this.busy = false; this.av.play('Idle_Loop'); this.opts.onTerminal?.(); };
  }

  game(kind) {
    if (kind === 'durak') return this.durak.open();
    if (kind === 'chess') return this.chess.open();
    if (this.opts.onGame?.(kind)) return;
    this.say({ durak: 'карты есть, соперников нет. скоро', chess: 'доска грязная, фигуры потерялись. скоро', arm: 'никто не хочет со мной бороться. скоро' }[kind]);
  }

  use() {
    if (!this.active) return;
    if (this.seated) return this.stand();
    if (this.busy) return;
    if (this.near) this.near.act();
  }

  async setSkin(s) { await this.av.setSkin(s); }

  enter() {
    this.active = true;
    this.host.hidden = false;
    this.last = performance.now();
    this.e.resize();
    requestAnimationFrame(this.frame ||= this.loop.bind(this));
  }

  leave() {
    this.active = false;
    this.host.hidden = true;
    this.keys.clear();
  }

  collide(p, r) {
    for (let it = 0; it < 2; it++) for (const [x0, z0, x1, z1] of this.scene.col) {
      const cx = Math.max(x0, Math.min(p[0], x1)), cz = Math.max(z0, Math.min(p[2], z1));
      const dx = p[0] - cx, dz = p[2] - cz, d = Math.hypot(dx, dz);
      if (d < r) {
        if (d < 1e-5) { const m = [p[0] - x0, x1 - p[0], p[2] - z0, z1 - p[2]], i = m.indexOf(Math.min(...m)); if (i === 0) p[0] = x0 - r; else if (i === 1) p[0] = x1 + r; else if (i === 2) p[2] = z0 - r; else p[2] = z1 + r; }
        else { p[0] = cx + dx / d * r; p[2] = cz + dz / d * r; }
      }
    }
  }

  step(dt, now) {
    const k = this.keys, av = this.av;
    if (this.match) {
      const a = this.arm, m = a.m;
      a.update(dt);
      av.update(dt); a.foe.update(dt);
      a.top = 0.975;
      const phi = (m.vs ?? 0) * 72 * Math.PI / 180 + (m.shake > 0 ? (Math.random() - 0.5) * 0.08 : 0) + Math.sin(now * 23) * 0.012;
      const C = this.barrel;
      if (!m.over || m.t < 0) { a.place(av, phi, 1, C, Math.PI / 2); a.place(a.foe, phi, -1, C, -Math.PI / 2); }
      else { av.yaw = Math.PI / 2; a.foe.yaw = -Math.PI / 2; if (!this.afterPos) { this.afterPos = 1; } }
      return;
    }
    this.afterPos = 0;
    if (this.chessOn) {
      const T = this.chessTable;
      av.update(dt); if (this.chess.g) this.chess.foe.update(dt);
      this.chess.update(dt);
      av.pos = [T[0], 0, T[2] - 0.85]; av.yaw = 0;
      if (!this.chess.g?.enter) { this.chess.foe.pos = [T[0], 0, T[2] + 0.85]; this.chess.foe.yaw = Math.PI; }
      return;
    }
    if (this.durakOn) {
      const T = this.cardTable;
      av.update(dt); if (this.durak.g) this.durak.foe.update(dt);
      av.pos = [T[0], 0, T[2] - 0.62]; av.yaw = 0;
      this.durak.foe.pos = [T[0], 0, T[2] + 0.62]; this.durak.foe.yaw = Math.PI;
      return;
    }
    if (this.scared) {
      this.scared.t -= dt;
      av.pos[0] += this.scared.v[0] * dt * Math.max(0, this.scared.t - 1.2); av.pos[2] += this.scared.v[1] * dt * Math.max(0, this.scared.t - 1.2);
      this.collide(av.pos, 0.28);
      if (this.scared.t <= 0) { this.scared = null; av.play('Idle_Loop'); }
      av.update(dt);
      return;
    }
    let ix = 0, iz = 0;
    if (k.has('w') || k.has('arrowup') || k.has('ц')) iz += 1;
    if (k.has('s') || k.has('arrowdown') || k.has('ы')) iz -= 1;
    if (k.has('a') || k.has('arrowleft') || k.has('ф')) ix += 1;
    if (k.has('d') || k.has('arrowright') || k.has('в')) ix -= 1;
    const lock = this.fp || this.slock;
    const kick = this.kickS;
    const moving = (ix || iz) && !this.busy && !kick;
    if (this.seated && moving) this.stand();
    const run = k.has('shift');
    this.hv ||= [0, 0]; this.vy ||= 0;
    const air = av.pos[1] > 0.001 || this.vy > 0;
    let wx = 0, wz = 0;
    if (moving && !this.seated) {
      const cy = this.cam.yaw, fx = Math.sin(cy), fz = Math.cos(cy);
      wx = fx * iz + fz * ix; wz = fz * iz - fx * ix;
      const l = Math.hypot(wx, wz); wx /= l; wz /= l;
    }
    const sp = run ? 3.4 : 1.45;
    const hv = this.hv, accel = (dir, wish, a, cap) => {
      const add = Math.min(wish, cap) - (hv[0] * dir[0] + hv[1] * dir[1]);
      if (add <= 0) return;
      const as = Math.min(a * wish * dt, add);
      hv[0] += as * dir[0]; hv[1] += as * dir[1];
    };
    let jumped = false;
    if (kick) {
      kick.t += dt;
      if (kick.t > 0.25 && kick.t < 0.95) { av.pos[0] += kick.d[0] * 3.4 * dt; av.pos[2] += kick.d[1] * 3.4 * dt; }
      if (!kick.hit && kick.t > 0.5) { kick.hit = true; this.kickHit(kick.d); }
      hv[0] = hv[1] = 0;
    } else if (!air) {
      if (k.has(' ') && !this.busy && !this.seated) {
        jumped = true;
        this.hops = now - (this.landT || 0) < 0.25 ? Math.min((this.hops || 0) + 1, 99) : 1;
        this.vy = 4.7;
        av.play('Jump_Start', true); av.onDone = null;
        this.idle = 0;
      } else {
        const s0 = Math.hypot(hv[0], hv[1]);
        if (s0 > 0.001) { const drop = Math.max(s0, 1.2) * 7 * dt, ns = Math.max(0, s0 - drop) / s0; hv[0] *= ns; hv[1] *= ns; }
      }
      if (moving) accel([wx, wz], sp, jumped ? 0 : 11, sp);
    } else if (moving) accel([wx, wz], sp, 40, 0.42);
    const top = 9, hsp = Math.hypot(hv[0], hv[1]);
    if (hsp > top) { hv[0] *= top / hsp; hv[1] *= top / hsp; }
    if (air || this.vy > 0) {
      this.vy -= 14 * dt;
      av.pos[1] = Math.max(0, av.pos[1] + this.vy * dt);
      if (av.pos[1] <= 0 && this.vy < 0) {
        this.vy = 0; this.landT = now;
        if (!k.has(' ') && !kick) { this.hops = 0; const m = Math.hypot(hv[0], hv[1]); av.play(m > 0.3 ? (m > 2.5 ? 'Jog_Fwd_Loop' : 'Walk_Loop') : 'Jump_Land', m <= 0.3); av.onDone = () => av.play('Idle_Loop'); }
      }
    }
    av.pos[0] += hv[0] * dt; av.pos[2] += hv[1] * dt;
    const ex = av.pos[0], ez = av.pos[2];
    this.collide(av.pos, 0.28);
    const px = av.pos[0] - ex, pz = av.pos[2] - ez, pl = Math.hypot(px, pz);
    if (pl > 1e-5) { const nx = px / pl, nz = pz / pl, vn = hv[0] * nx + hv[1] * nz; if (vn < 0) { hv[0] -= nx * vn; hv[1] -= nz * vn; } }
    const hs = Math.hypot(...this.hv);
    if (lock && !kick) av.yaw = this.cam.yaw;
    else if (hs > 0.1 && !kick) {
      const want = Math.atan2(this.hv[0], this.hv[1]);
      let d = want - av.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      av.yaw += d * Math.min(1, dt * 10);
    }
    if (!air && !kick && !jumped) {
      if (moving) {
        av.play(run || hs > 2.5 ? (hs > 4 ? 'Fast_Run' : 'Jog_Fwd_Loop') : 'Walk_Loop');
        this.idle = 0;
        if (!lock && (!this.camTouched || now - this.camTouched > 1500)) {
          let c = av.yaw - this.cam.yaw; while (c > Math.PI) c -= 2 * Math.PI; while (c < -Math.PI) c += 2 * Math.PI;
          if (iz >= 0) this.cam.yaw += c * Math.min(1, dt * 1.2);
        }
      } else if (!this.busy && !this.seated) {
        this.idle += dt;
        const cur = av.cur;
        if (['Walk_Loop', 'Jog_Fwd_Loop', 'Fast_Run', 'Jump_Start', 'Jump'].includes(cur)) av.play('Idle_Loop');
        if (this.idle > 14 && cur === 'Idle_Loop') av.play(Math.random() < 0.5 ? 'Idle_TalkingPhone_Loop' : 'Idle_FoldArms_Loop');
      }
    }
    for (const kb of this.kb || []) {
      kb.t -= dt;
      if (kb.t > 0) { kb.av.pos[0] += kb.v[0] * dt * (kb.t / 0.6); kb.av.pos[2] += kb.v[1] * dt * (kb.t / 0.6); this.collide(kb.av.pos, 0.25); }
    }
    this.kb = (this.kb || []).filter(x => x.t > 0);
    av.update(dt);
  }

  camera() {
    const asp0 = this.e.canvas.width / this.e.canvas.height;
    if (this.shot) return M4.mul(M4.persp(1.0, asp0, 0.05, 90), M4.look(this.shot[0], this.shot[1], [0, 1, 0]));
    if (this.match) {
      const C = this.barrel, sh = this.arm.m?.shake > 0 ? (Math.random() - 0.5) * 0.03 : 0;
      return M4.mul(M4.persp(1.0, asp0, 0.05, 60), M4.look([C[0] + 0.55 + sh, 1.75, C[2] - 1.5], [C[0], 1.12, C[2]], [0, 1, 0]));
    }
    if (this.chessOn) {
      const T = this.chessTable;
      if (this.chess.g?.enter) { const f = this.chess.foe.pos; return M4.mul(M4.persp(1.15, asp0, 0.05, 60), M4.look([T[0] - 0.4, 2.0, T[2] - 1.3], [f[0] * 0.8 + T[0] * 0.2, 0.9, f[2]], [0, 1, 0])); }
      return M4.mul(M4.persp(1.0, asp0, 0.05, 60), M4.look([T[0], 1.3, T[2] - 0.5], [T[0], 0.72, T[2] + 0.06], [0, 1, 0]));
    }
    if (this.durakOn) {
      const T = this.cardTable;
      return M4.mul(M4.persp(1.1, asp0, 0.05, 60), M4.look([T[0] + 0.05, 2.1, T[2] - 0.95], [T[0], 0.8, T[2] + 0.3], [0, 1, 0]));
    }
    const c = this.cam, sc = this.scene, av = this.av, d = c.dist * (this.zoom || 1);
    if (this.fp && !this.busy) {
      const h = av.head(), f = [Math.sin(c.yaw) * Math.cos(c.pitch), -Math.sin(c.pitch), Math.cos(c.yaw) * Math.cos(c.pitch)];
      const eye = [av.pos[0] + Math.sin(av.yaw) * 0.12, h[1] + 0.06, av.pos[2] + Math.cos(av.yaw) * 0.12];
      this.fpEye = { eye, f, yaw: c.yaw, pitch: c.pitch };
      return M4.mul(M4.persp(vfov(set.fov, asp0), asp0, 0.03, 90), M4.look(eye, [eye[0] + f[0], eye[1] + f[1], eye[2] + f[2]], [0, 1, 0]));
    }
    this.fpEye = null;
    const tgt = [av.pos[0], av.pos[1] + (this.seated ? 1.05 : 1.45), av.pos[2]];
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    tgt[0] += -fz * 0.35; tgt[2] += fx * 0.35;
    let eye = [tgt[0] - fx * Math.cos(c.pitch) * d, tgt[1] + Math.sin(c.pitch) * d, tgt[2] - fz * Math.cos(c.pitch) * d];
    const [X0, X1, Z0, Z1, H] = sc.bounds, m = 0.12;
    const clamp = p => [Math.max(X0 + m, Math.min(X1 - m, p[0])), Math.max(0.3, Math.min(H - m, p[1])), Math.max(Z0 + m, Math.min(Z1 - m, p[2]))];
    eye = clamp(eye);
    const inside = p => sc.col.some(([x0, z0, x1, z1, h]) => p[1] < h + 0.1 && p[0] > x0 - 0.1 && p[0] < x1 + 0.1 && p[2] > z0 - 0.1 && p[2] < z1 + 0.1);
    const v = [eye[0] - tgt[0], eye[1] - tgt[1], eye[2] - tgt[2]];
    let k = 1;
    for (let s = 0.08; s <= 1; s += 0.04) if (inside([tgt[0] + v[0] * s, tgt[1] + v[1] * s, tgt[2] + v[2] * s])) { k = Math.max(0.1, s - 0.08); break; }
    this.camK = Math.min(k, (this.camK ?? k) + 0.04);
    eye = [tgt[0] + v[0] * this.camK, tgt[1] + v[1] * this.camK, tgt[2] + v[2] * this.camK];
    const asp = this.e.canvas.width / this.e.canvas.height;
    return M4.mul(M4.persp(1.15, asp, 0.05, 90), M4.look(eye, tgt, [0, 1, 0]));
  }

  paintScreen(now) {
    if (now - (this.scrT || 0) < 0.5) return;
    this.scrT = now;
    const x = this.screenC.getContext('2d'), s = this.opts.status?.() || {};
    x.fillStyle = '#06140c'; x.fillRect(0, 0, 128, 96);
    x.fillStyle = '#5dff9a'; x.font = '10px monospace';
    x.fillText('de_contract', 6, 14);
    x.fillText('sure: ' + (s.sure ?? '--'), 6, 32);
    x.fillText('best: ' + (s.best ?? '--'), 6, 46);
    x.fillText(s.age ?? '', 6, 60);
    if ((now * 2 | 0) % 2) x.fillRect(6, 70, 7, 10);
    x.fillStyle = 'rgba(0,0,0,.25)'; for (let y = 0; y < 96; y += 2) x.fillRect(0, y, 128, 1);
    const gl = this.e.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.screenT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.screenC);
  }

  loop(ms) {
    if (!this.active) return;
    requestAnimationFrame(this.frame);
    const now = ms / 1000, dt = Math.min(0.05, now - (this.last / 1000 || now));
    this.last = ms;
    if (!this.scene) return;
    if (this.surfOn) { this.surfOn.frame(dt, now); this.e.end(); this.interact(); return; }
    this.step(dt, now);
    this.chickenStep(dt, now);
    this.events.update(dt, now);
    this.extras.update(dt, now);
    const f = this.flick;
    if (now > f.next) { f.until = now + 0.15 + Math.random() * 0.5; f.next = now + 4 + Math.random() * 14; }
    f.k = now < f.until ? (Math.random() < 0.5 ? 0.15 : 0.9) : 1;
    const day = this.timeOfDay(), night = day < 0.5, e = this.e, sc = this.scene;
    e.lights = sc.lights(now, night);
    if (sc.sky) {
      const n = [0.05, 0.06, 0.1], dcol = [0.62, 0.66, 0.7];
      e.fog = dcol.map((v, i) => n[i] + (v - n[i]) * day);
      e.amb = [0.12 + 0.38 * day, 0.13 + 0.39 * day, 0.18 + 0.37 * day];
      e.fogR = [10, 26 + day * 10];
    } else { e.fog = sc.fog; e.amb = sc.amb; e.fogR = sc.fogR; }
    this.paintScreen(now);
    const VP = this.camera();
    e.begin(VP, e.fog);
    for (const it of sc.items) {
      let o = it.o || {};
      if (it.tube) o = { unlit: 1, tint: [f.k, f.k, f.k, 1] };
      if (it.lamp) o = { unlit: 1, tint: night ? [1.2, 1.2, 1.2, 1] : [0.4, 0.4, 0.4, 1] };
      if (it.bld && night) { e.draw(it.obj, it.m, { tex: this.t.panelN, unlit: 1 }); continue; }
      e.draw(it.obj, it.m, o);
    }
    if (this.windowQ) this.windowQ.groups[0].tint = night ? [0.12, 0.15, 0.3, 1] : [0.75, 0.82, 0.9, 1];
    if (!this.chessOn && !this.fpEye) this.av.draw();
    if (sc === this.scenes.basement) this.chess.draw();
    for (const n of this.npcs) if (this.scenes[n.scene] === sc) { n.av.update(Math.min(dt, 0.05)); n.av.draw(); }
    if (sc === this.scenes.yard) this.drawYardExtras(now);
    this.events.draw(now);
    this.extras.draw(now);
    if (this.fpEye) this.drawArms(now, dt);
    if (this.chessOn && this.chess.g) this.chess.foe.draw();
    if (this.match) this.arm.foe.draw();
    if (this.durakOn && this.durak.g) this.durak.foe.draw();
    this.interact();
  }

  interact() {
    const av = this.av, p = this.$('.w-prompt');
    let best = null, bd = 1e9;
    if (!this.busy && !this.seated) for (const a of this.scene.acts) {
      if (a.cond && !a.cond()) continue;
      const dx = a.p[0] - av.pos[0], dz = a.p[2] - av.pos[2], d = Math.hypot(dx, dz);
      if (d > a.r) continue;
      const facing = Math.cos(Math.atan2(dx, dz) - av.yaw);
      const score = d - facing * 0.6;
      if (score < bd) { bd = score; best = a; }
    }
    this.near = best;
    const tgt = best || (this.seated ? { label: 'stand up', p: [av.pos[0], 1.2, av.pos[2]] } : null);
    if (!tgt) { p.hidden = true; } else {
      const s = this.e.project([tgt.p[0], tgt.p[1] + 0.35, tgt.p[2]]);
      if (!s) { p.hidden = true; } else {
        const r = this.host.getBoundingClientRect();
        p.hidden = false;
        if (p.dataset.l !== tgt.label) { p.innerHTML = `<b>E</b> ${tgt.label}`; p.dataset.l = tgt.label; }
        p.style.transform = `translate(${s[0] - r.left}px, ${s[1] - r.top}px) translate(-50%, -100%)`;
      }
    }
    const b = this.$('.w-say');
    if (!b.hidden) {
      const h = av.head(), s = this.e.project([h[0], h[1] + 0.35, h[2]]);
      if (s) { const r = this.host.getBoundingClientRect(); b.style.transform = `translate(${s[0] - r.left}px, ${s[1] - r.top}px) translate(-50%, -100%)`; }
    }
  }
}
