import { M4, Q, merge, boxG } from './engine.js';
import { Avatar } from './avatar.js';
import { paint } from './tex.js';

const GUN_W = new Float32Array([-0.11418, -0.01366, 0.00098, 0, 0.00099, -0.00005, 0.115, 0, -0.01366, 0.11419, 0.00017, 0, -0.95498, 1.40101, -0.08625, 1]);
const GUN_HAND = [-0.79935, 1.41951, -0.00157];
const at = (x, y, z, s = 1) => M4.fromQT([0, 0, 0, 1], [x, y, z], s);
const D = Math.PI / 180;
const wait = ms => new Promise(r => setTimeout(r, ms));
const pick = a => a[Math.random() * a.length | 0];

function invRest(m) {
  const r = new Float32Array(16);
  r[0] = m[0]; r[1] = m[4]; r[2] = m[8]; r[4] = m[1]; r[5] = m[5]; r[6] = m[9]; r[8] = m[2]; r[9] = m[6]; r[10] = m[10]; r[15] = 1;
  const s = Math.hypot(m[0], m[1], m[2]) || 1;
  for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) r[i] /= s * s;
  r[12] = -(r[0] * m[12] + r[4] * m[13] + r[8] * m[14]); r[13] = -(r[1] * m[12] + r[5] * m[13] + r[9] * m[14]); r[14] = -(r[2] * m[12] + r[6] * m[13] + r[10] * m[14]);
  return r;
}

export class Extras {
  constructor(w) {
    this.w = w;
    this.e = w.e;
    this.crowd = [];
    this.rocks = [];
    this.keys = '';
    this.gunUntil = 0;
    this.ohne = document.createElement('div');
    this.ohne.className = 'ohne';
    this.ohne.innerHTML = '<img src="assets/ui/ohne.jpg" alt=""><span></span>';
    w.ui.append(this.ohne);
    this.tip = document.createElement('div');
    this.tip.className = 'w-tip';
    this.tip.hidden = true;
    w.ui.append(this.tip);
    addEventListener('keydown', e => {
      if (!w.active || e.target.closest?.('input, textarea, select')) return;
      this.keys = (this.keys + e.key.toLowerCase()).slice(-6);
      if (this.keys.endsWith('4b2a')) { if (w.blyat?.on) w.blyat.close(); this.rush(); }
    }, true);
    w.canvas.addEventListener('pointerdown', e => { this.clickHead(e); this.clickHeli(e); this.clickCan(e); });
    this.ikT = 90 + Math.random() * 120;
    this.nakT = 60 + Math.random() * 120;
  }

  async build() {
    const e = this.e;
    try {
      const g = await e.json('assets/revolver.json');
      this.gun = e.shape({ P: g.pos, N: g.nor, U: g.uv, I: g.idx }, await e.texUrl('assets/revolver.png', false, true));
    } catch (err) { this.gun = null; }
    this.rock = e.shape(boxG(0.09, 0.07, 0.08), null, [0.45, 0.43, 0.4, 1]);
    this.can = e.shape(merge(boxG(0.07, 0.12, 0.07, 0, 0.06, 0), boxG(0.075, 0.02, 0.075, 0, 0.06, 0)), null, [0.75, 0.15, 0.12, 1]);
    const ys = this.w.scenes.yard;
    this.w.shape(ys, merge(boxG(1.6, 1.25, 1.0, -10.6, 0.625, -6.6), boxG(1.7, 0.08, 1.1, -10.6, 1.29, -6.75)), this.w.t.pipe);
    this.w.solid(ys, -11.5, -7.2, -9.7, -6.0, 1.4);
    ys.acts.push({ p: [-10.3, 1.0, -5.9], r: 1.4, label: 'dig through the trash', act: () => this.dig() });
    ys.acts.push({ p: [-7.6, 1.0, -2.9], r: 1.5, label: 'shoot cans', cond: () => !this.cans, act: () => this.startCans() });
    this.flashObj = e.shape(boxG(0.12, 0.12, 0.12), null, [1, 0.85, 0.4, 1]);
    const sc = this.w.scenes.basement;
    this.boardC = paint(256, 160, () => {});
    this.boardT = e.texCanvas(this.boardC);
    this.paintBoard();
    this.w.shape(sc, merge(boxG(1.2, 0.85, 0.04, 1.25, 1.55, 2.975), boxG(1.3, 0.05, 0.08, 1.25, 1.1, 2.95)), this.w.t.wood);
    sc.items.push({ obj: e.shape({ P: [1.82, 1.16, 2.95, 0.68, 1.16, 2.95, 0.68, 1.94, 2.95, 1.82, 1.94, 2.95], N: [0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1], U: [0, 1, 1, 1, 1, 0, 0, 0], I: [0, 1, 2, 0, 2, 3] }, this.boardT), m: M4.id() });
    sc.acts.push({ p: [1.25, 1.2, 2.6], r: 1.2, label: 'start beef', act: () => this.beefMenu() });
  }

  tally() { try { return JSON.parse(localStorage.getItem('dc.beef')) || { ct: 0, t: 0, log: [] }; } catch { return { ct: 0, t: 0, log: [] }; } }

  paintBoard() {
    const x = this.boardC.getContext('2d'), b = this.tally();
    x.fillStyle = '#1e2a22'; x.fillRect(0, 0, 256, 160);
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(200,210,200,${Math.random() * 0.05})`; x.fillRect(Math.random() * 256, Math.random() * 160, 30 + Math.random() * 60, 6 + Math.random() * 10); }
    x.strokeStyle = 'rgba(230,235,225,.85)'; x.fillStyle = 'rgba(230,235,225,.9)'; x.lineWidth = 2;
    x.font = 'bold 22px "Comic Sans MS", cursive'; x.textAlign = 'center';
    x.fillText('CT', 64, 30); x.fillText('T', 192, 30);
    x.beginPath(); x.moveTo(128, 10); x.lineTo(128, 150); x.moveTo(20, 40); x.lineTo(236, 40); x.stroke();
    const marks = (n, cx) => {
      for (let i = 0; i < Math.min(n, 30); i++) {
        const g = i / 5 | 0, k = i % 5, gx = cx - 50 + (g % 3) * 36, gy = 52 + (g / 3 | 0) * 34;
        x.beginPath();
        if (k < 4) { x.moveTo(gx + k * 6, gy); x.lineTo(gx + k * 6 + 1, gy + 24); } else { x.moveTo(gx - 3, gy + 20); x.lineTo(gx + 24, gy + 4); }
        x.stroke();
      }
      if (n > 30) { x.font = '14px "Comic Sans MS", cursive'; x.fillText('+' + (n - 30), cx, 150); }
    };
    marks(b.ct, 64); marks(b.t, 192);
    x.font = '11px "Comic Sans MS", cursive'; x.fillStyle = 'rgba(230,235,225,.6)'; x.fillText('basement beef', 128, 156);
    const gl = this.e.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.boardT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.boardC);
  }

  myTeam() { return (this.w.opts.skin || 'sas') === 'phoenix' ? 't' : 'ct'; }

  async npc(skin, tint) {
    const a = new Avatar(this.e);
    await a.load(skin);
    a.tint = tint;
    return a;
  }

  say(t, ms) { this.w.say(t, ms); }

  ohneShow(line) {
    if (Date.now() - (this.ohneAt || 0) < 45000) return;
    this.ohneAt = Date.now();
    const o = this.ohne;
    o.querySelector('span').textContent = line || pick(['...', 'bro.', 'that was bad', 'why would you do that', 'im disappointed']);
    o.classList.remove('go'); void o.offsetWidth; o.classList.add('go');
  }

  update(dt, now) {
    const w = this.w;
    for (const c of this.crowd) {
      if (c.dead) { c.t += dt; continue; }
      if (c.vel) { c.av.pos[0] += c.vel[0] * dt; c.av.pos[2] += c.vel[1] * dt; }
      if (c.think) c.think(dt, c);
      c.av.update(dt);
    }
    this.crowd = this.crowd.filter(c => !(c.dead && c.t > 3) && !c.gone);
    for (const r of this.rocks) {
      r.t += dt;
      for (let k = 0; k < 3; k++) r.p[k] += r.v[k] * dt;
      r.v[1] -= 9 * dt;
      if (r.p[1] < 0) r.done = true;
      const h = w.av.head();
      if (!r.done && Math.hypot(r.p[0] - h[0], r.p[1] - h[1], r.p[2] - h[2]) < 0.35) {
        r.done = true;
        if (!w.busy) { w.av.play('Hit_Head', true); w.av.onDone = () => w.av.play('Idle_Loop'); }
        w.opts.sfx?.poke?.();
        this.say(pick(['АЙ', 'сука камень', 'кто кидает']), 1200);
      }
    }
    this.rocks = this.rocks.filter(r => !r.done);
    if (this.cans && !this.canDone) {
      this.canT -= dt;
      this.tip.textContent = 'click the cans · ' + Math.max(0, Math.ceil(this.canT)) + 's';
      if (this.canT <= 0) this.endCans();
    }
    if (this.cans) for (const c of this.cans) if (c.v) { c.v[1] -= 9 * dt; for (let k = 0; k < 3; k++) c.p[k] += c.v[k] * dt; if (c.p[1] < 0.05) { c.p[1] = 0.05; c.v = null; } }
    const h = w.events.heli;
    if (h && !h.dead && w.scene === w.scenes.yard && Math.abs(h.p[0]) < 16 && !this.nk) { this.tip.hidden = false; this.tip.textContent = 'click the heli to shoot it'; this.heliTip = true; }
    else if (this.heliTip) { this.heliTip = false; if (!this.nk && !this.cans) this.tip.hidden = true; }
    if (w.scene === w.scenes.yard && !w.busy && !this.event) {
      this.ikT -= dt; this.nakT -= dt;
      if (this.ikT <= 0) { this.ikT = 240 + Math.random() * 600; if (Math.random() < 0.4) this.ikonik(); }
      else if (this.nakT <= 0) { this.nakT = 140 + Math.random() * 160; if (Math.random() < 0.75) this.nakeds(); }
    }
  }

  draw(now) {
    const w = this.w, e = this.e;
    for (const c of this.crowd) if (c.scene === w.scene) c.av.draw(c.tint ? { tint: c.tint } : {});
    for (const r of this.rocks) e.draw(this.rock, M4.mul(at(...r.p), M4.rotY(r.t * 9)));
    if (w.scene === w.scenes.yard) {
      const cans = this.cans || (this.cansReady() ? [0, 1, 2, 3, 4, 5].map(i => ({ p: [-9, 1.68, -4.6 + i * 0.7] })) : []);
      for (const c of cans) e.draw(this.can, at(...c.p));
    }
    if (this.gun && (w.av.cur.startsWith('Pistol') || now < this.gunUntil) && w.av.W) this.drawGun(w.av, now);
  }

  drawGun(av, now) {
    const R = av.rig;
    if (!R.gunOff) {
      const hi = R.byName['hand.r'], hp = M4.pos(R.rest[hi]);
      R.gunOff = M4.mul(invRest(R.rest[hi]), M4.mul(at(hp[0] - GUN_HAND[0], hp[1] - GUN_HAND[1], hp[2] - GUN_HAND[2]), GUN_W));
    }
    const m = M4.mul(av.model(), M4.mul(av.W[R.byName['hand.r']], R.gunOff));
    this.e.draw(this.gun, m);
    if (now < (this.muzzle || 0)) this.e.draw(this.flashObj, M4.mul(m, at(0, 0, 1.7)), { unlit: 1 });
  }

  face(av, p) { av.yaw = Math.atan2(p[0] - av.pos[0], p[2] - av.pos[2]); }

  async shoot(target) {
    const w = this.w, av = w.av;
    this.face(av, target.av.pos);
    av.play('Pistol_Aim_Neutral');
    await wait(260);
    av.play('Pistol_Shoot', true);
    this.muzzle = performance.now() / 1000 + 0.08;
    w.opts.sfx?.shot?.();
    await wait(90);
    target.dead = true; target.t = 0; target.vel = null; target.think = null;
    target.av.play('Death01', true);
    await wait(260);
  }

  async rush() {
    const w = this.w;
    if (this.event || w.busy) return;
    this.event = 'rush';
    const me = w.opts.skin || 'sas', mate = me === 'orange' ? 'sas' : me, foe = mate === 'phoenix' ? 'sas' : 'phoenix';
    const sc = w.scene, yard = sc === w.scenes.yard;
    const z = yard ? 0 : -0.4, x0 = yard ? -11 : -3.6, dir = 1, sp = yard ? 5.2 : 3.2;
    this.say(pick(['РАШ Б', 'rush b cyka blyat', 'ГО ГО ГО', 'не стопимся']), 2500);
    w.opts.sfx?.voice?.('rushb');
    w.busy = true;
    w.av.pos = [x0, 0, z]; w.av.yaw = Math.PI / 2; w.av.play('Sprint_Loop');
    const runners = [];
    for (let i = 0; i < 5; i++) {
      const enemy = i === 4;
      const a = await this.npc('assets/agents/' + (enemy ? foe : mate));
      a.pos = [x0 - 0.9 * (i + 1) - (enemy ? 0.6 : 0), 0, z + (i % 2 ? 0.45 : -0.45)];
      a.yaw = Math.PI / 2; a.play('Sprint_Loop');
      const c = { av: a, scene: sc, vel: [sp * (enemy ? 1.05 : 1), 0] };
      runners.push(c); this.crowd.push(c);
    }
    const t0 = performance.now(), dur = (yard ? 22 : 7.2) / sp * 1000 + 1800;
    while (performance.now() - t0 < dur && w.active) {
      await wait(30);
      w.av.pos[0] += sp * 0.03 * dir;
      if (w.av.pos[0] > (yard ? 11 : 3.6)) w.av.pos[0] = yard ? 11 : 3.6;
    }
    for (const c of runners) c.gone = true;
    w.av.play('Idle_Loop');
    w.busy = false;
    this.event = null;
    this.say(pick(['где все', 'а бомба у кого', 'ну и куда они']), 2000);
  }

  async ikonik() {
    const w = this.w;
    if (this.event) return;
    this.event = 'ikonik';
    let a;
    try { a = await this.npc('assets/chars/ikonik'); } catch (e) { this.event = null; return; }
    const p = w.av.pos, ang = w.cam.yaw + (Math.random() - 0.5);
    a.pos = [Math.max(-10, Math.min(10, p[0] + Math.sin(ang) * 3.5)), 0, Math.max(-7, Math.min(7, p[2] + Math.cos(ang) * 3.5))];
    this.face(a, p);
    a.play('Dance_Loop');
    const c = { av: a, scene: w.scene };
    this.crowd.push(c);
    await wait(900);
    this.say(pick(['кто это', 'чё он делает', 'нет. только не это']), 2200);
    await wait(5600);
    if (!w.active || w.busy) { c.gone = true; this.event = null; return; }
    w.busy = true;
    await this.shoot(c);
    await wait(500);
    w.av.play('Idle_Loop');
    this.say('...fuck fortnite...', 3200);
    w.busy = false;
    this.event = null;
  }

  async nakeds() {
    const w = this.w;
    if (this.event) return;
    this.event = 'nakeds';
    const n = 3 + (Math.random() * 3 | 0);
    this.say(pick(['наки идут', 'это голые?', 'бля рейд']), 2400);
    this.tip.hidden = false;
    this.tip.textContent = 'click his head to lock in';
    this.nk = [];
    for (let i = 0; i < n; i++) {
      const a = await this.npc('assets/guy', [1.15, 0.82, 0.68, 1]);
      const side = i % 2 ? 1 : -1;
      a.pos = [side * (9 + Math.random() * 2), 0, -6 + Math.random() * 12];
      a.play('Sprint_Loop');
      const c = { av: a, scene: w.scenes.yard, cd: 1 + Math.random() * 2 };
      c.think = (dt, c) => {
        const t = w.av.pos, dx = t[0] - c.av.pos[0], dz = t[2] - c.av.pos[2], d = Math.hypot(dx, dz);
        this.face(c.av, t);
        if (d > 6) { c.av.pos[0] += dx / d * 3.6 * dt; c.av.pos[2] += dz / d * 3.6 * dt; if (c.av.cur !== 'Sprint_Loop') c.av.play('Sprint_Loop'); }
        else {
          if (c.av.cur === 'Sprint_Loop') c.av.play('Idle_Loop');
          c.cd -= dt;
          if (c.cd <= 0) {
            c.cd = 1.6 + Math.random() * 1.8;
            c.av.play('OverhandThrow', true); c.av.onDone = () => c.av.play('Idle_Loop');
            setTimeout(() => {
              if (c.dead) return;
              const h = w.av.head(), s = [c.av.pos[0], 1.7, c.av.pos[2]], T = 0.75;
              this.rocks.push({ p: s, v: [(h[0] - s[0]) / T + (Math.random() - 0.5), (h[1] - s[1]) / T + 4.5 * T * 0.75, (h[2] - s[2]) / T + (Math.random() - 0.5)], t: 0 });
            }, 420);
          }
        }
      };
      this.crowd.push(c); this.nk.push(c);
    }
    const t0 = performance.now();
    while (this.nk.some(c => !c.dead) && performance.now() - t0 < 22000 && w.scene === w.scenes.yard) await wait(200);
    this.tip.hidden = true;
    if (this.nk.some(c => !c.dead)) {
      for (const c of this.nk) if (!c.dead) { c.gone = true; }
      const lost = Math.min(w.bank.s.scrap, 40);
      if (lost) w.bank.add(0, -lost);
      this.say(lost ? 'they stole ' + lost + ' scrap' : 'they left', 2600);
      this.ohneShow();
    }
    this.nk = null;
    this.event = null;
  }

  async clickHeli(ev) {
    const w = this.w, h = w.events.heli;
    if (!h || h.dead || w.scene !== w.scenes.yard || w.busy || this.shooting) return;
    const p = this.e.project(h.p);
    if (!p || Math.hypot(p[0] - ev.clientX, p[1] - ev.clientY) > 110) return;
    this.shooting = true;
    const av = w.av;
    av.yaw = Math.atan2(h.p[0] - av.pos[0], h.p[2] - av.pos[2]);
    av.play('Pistol_Shoot', true); av.onDone = () => av.play('Idle_Loop');
    this.gunUntil = performance.now() / 1000 + 1.2;
    this.muzzle = performance.now() / 1000 + 0.08;
    w.opts.sfx?.shot?.();
    h.hp--; h.hitAt = performance.now();
    if (h.hp <= 0) { h.dead = true; h.vy = 0; w.say('ПАДАЕТ', 1200); }
    else if (h.hp === 3) w.say(['ещё чуть-чуть', 'дымится!'], 1200);
    setTimeout(() => this.shooting = false, 280);
  }

  cansReady() { try { return Date.now() - (+localStorage.getItem('dc.cans') || 0) > 180000; } catch { return true; } }

  startCans() {
    const w = this.w;
    if (!this.cansReady()) { w.say('кончились банки. через пару минут', 2000); return; }
    w.busy = true;
    this.cans = [0, 1, 2, 3, 4, 5].map(i => ({ p: [-9, 1.68, -4.6 + i * 0.7], hit: false, v: null }));
    this.canT = 20;
    this.tip.hidden = false;
    this.tip.textContent = 'click the cans. 20 seconds';
    w.av.pos = [-6.2, 0, -2.9]; w.av.yaw = -Math.PI / 2;
    w.av.play('Pistol_Aim_Neutral');
    w.shot = [[-5.7, 1.8, -1.6], [-9, 1.6, -2.9]];
  }

  clickCan(ev) {
    if (!this.cans || this.canDone) return;
    const w = this.w;
    w.opts.sfx?.shot?.();
    this.muzzle = performance.now() / 1000 + 0.08;
    w.av.play('Pistol_Shoot', true); w.av.onDone = () => w.av.play('Pistol_Aim_Neutral');
    let best = null, bd = 60;
    for (const c of this.cans) { if (c.hit) continue; const p = this.e.project(c.p); if (!p) continue; const d = Math.hypot(p[0] - ev.clientX, p[1] - ev.clientY); if (d < bd) { bd = d; best = c; } }
    if (best) { best.hit = true; best.v = [(Math.random() - 0.5) * 2, 3 + Math.random() * 2, (Math.random() - 0.5) * 3]; }
    if (this.cans.every(c => c.hit)) this.endCans();
  }

  endCans() {
    const w = this.w;
    if (this.canDone) return;
    this.canDone = true;
    const n = this.cans.filter(c => c.hit).length;
    try { localStorage.setItem('dc.cans', String(Date.now())); } catch (e) {}
    this.tip.hidden = true;
    if (n) w.bank.add(0, n * 3 + (n === 6 ? 8 : 0), n * 2);
    w.say(n === 6 ? 'все шесть. снайпер' : n ? n + ' из 6' : 'ни одной блять', 2200);
    setTimeout(() => { this.cans = null; this.canDone = false; w.shot = null; w.busy = false; w.av.play('Idle_Loop'); }, 1600);
  }

  digReady() { try { return Date.now() - (+localStorage.getItem('dc.trash') || 0) > 480000; } catch { return true; } }

  dig() {
    const w = this.w;
    if (!this.digReady()) { w.say('там уже пусто. потом', 1800); return; }
    try { localStorage.setItem('dc.trash', String(Date.now())); } catch (e) {}
    w.av.play('PickUp_Table', true); w.av.onDone = () => w.av.play('Idle_Loop');
    const r = Math.random();
    setTimeout(() => {
      if (r < 0.12) { w.say('крыса укусила БЛЯТЬ', 2000); w.extras.ohneShow('...'); }
      else if (r < 0.2) {
        const cr = w.loot.crates();
        if (cr.length) { const it = w.loot.roll(cr[Math.random() * cr.length | 0]); w.bank.s.inv.push(it); w.bank.save(); w.say('скин в мусорке?? ' + it.hash.replace(/ \(.*\)$/, ''), 3000); }
        else w.bank.add(0, 10);
      }
      else if (r < 0.55) { const n = 3 + (Math.random() * 12 | 0); w.bank.add(0, n); w.say(['скрап!', 'норм улов', 'кто это выкинул'], 1500); }
      else { const n = 20 + (Math.random() * 60 | 0); w.bank.add(n); w.say(['мелочь', 'рубли в мусорке', 'на доширак хватит'], 1500); }
    }, 1200);
  }

  async clickHead(ev) {
    const w = this.w;
    if (!this.nk || this.locking || !w.active) return;
    const h = w.av.head(), p = this.e.project(h);
    if (!p || Math.hypot(p[0] - ev.clientX, p[1] - ev.clientY) > 80) return;
    this.locking = true;
    this.tip.hidden = true;
    w.busy = true;
    this.say('залочился', 900);
    for (const c of this.nk) if (!c.dead) await this.shoot(c);
    w.av.play('Idle_Loop');
    w.busy = false;
    this.locking = false;
    w.bank.add(0, 25, 10);
    this.say(pick(['ез', 'наки сосут', 'следующий']), 2000);
  }

  beefMenu() {
    const w = this.w;
    if (this.event) return;
    const m = document.createElement('div');
    m.className = 'beef win';
    const b = this.tally();
    m.innerHTML = `<div class="dlg-t"><span>beef: CT ${b.ct} - ${b.t} T</span><button class="x">x</button></div><div class="arm-list">
      <button class="arm-foe" data-k="slap"><b>slap contest</b><em>take turns. first one down loses</em></button>
      <button class="arm-foe" data-k="box"><b>boxing</b><em>faster, harder, more pain</em></button>
      <button class="arm-foe" data-k="knife"><b>knife fight</b><em>(rubber knives. we're not animals)</em></button></div>`;
    w.ui.append(m);
    w.busy = true;
    m.querySelector('.x').onclick = () => { m.remove(); w.busy = false; };
    m.querySelectorAll('[data-k]').forEach(el => el.onclick = () => { m.remove(); this.beef(el.dataset.k); });
  }

  async beef(kind) {
    const w = this.w, av = w.av;
    this.event = 'beef';
    w.busy = true;
    const me = w.opts.skin || 'sas', foeSkin = me === 'phoenix' ? 'sas' : 'phoenix';
    const foe = await this.npc('assets/agents/' + foeSkin);
    const C = [0.4, 0, -0.5];
    av.pos = [C[0] - 0.55, 0, C[2]]; av.yaw = Math.PI / 2; av.play(kind === 'box' ? 'Idle_FoldArms_Loop' : 'Idle_Loop');
    foe.pos = [C[0] + 0.55, 0, C[2]]; foe.yaw = -Math.PI / 2; foe.play('Idle_Loop');
    const c = { av: foe, scene: w.scene };
    this.crowd.push(c);
    this.fight = { hp: [100, 100], turn: 0, meter: 0, dir: 1, kind, over: false };
    const ui = document.createElement('div');
    ui.className = 'beef-hud';
    ui.innerHTML = `<div class="bf-hp"><div><b>you</b><i><s></s></i></div><div><b>${foeSkin === 'sas' ? 'CT' : 'T'}</b><i><s></s></i></div></div><div class="bf-meter"><s></s><b></b></div><div class="bf-tip">hit space when the bar is in the green</div>`;
    w.ui.append(ui);
    w.shot = [[C[0], 1.5, C[2] - 2.2], [C[0], 1.15, C[2]]];
    const anim = { slap: ['Spell_Simple_Shoot', 'Hit_Head'], box: ['Spell_Simple_Shoot', 'Hit_Knockback'], knife: ['Interact', 'Hit_Head'] }[kind];
    let pressed = false;
    const key = e => { if (e.key === ' ') { e.preventDefault(); pressed = true; } };
    addEventListener('keydown', key);
    ui.addEventListener('pointerdown', () => pressed = true);
    const F = this.fight;
    const hpUi = () => ui.querySelectorAll('.bf-hp s').forEach((s, i) => s.style.width = Math.max(0, F.hp[i]) + '%');
    hpUi();
    while (F.hp[0] > 0 && F.hp[1] > 0 && w.active) {
      const mine = F.turn === 0;
      ui.querySelector('.bf-tip').textContent = mine ? 'your swing: hit space in the green' : 'he swings...';
      let power = 0;
      if (mine) {
        pressed = false;
        const zone = [0.62 + Math.random() * 0.2];
        const bar = ui.querySelector('.bf-meter s'), z = ui.querySelector('.bf-meter b');
        z.style.left = (zone[0] * 100 - 6) + '%';
        let t = 0;
        while (!pressed && t < 6000) { await wait(16); t += 16; F.meter += F.dir * 0.022 * (kind === 'box' ? 1.5 : 1); if (F.meter > 1 || F.meter < 0) F.dir *= -1; F.meter = Math.max(0, Math.min(1, F.meter)); bar.style.width = (F.meter * 100) + '%'; }
        const off = Math.abs(F.meter - zone[0]);
        power = off < 0.06 ? 1 : off < 0.15 ? 0.6 : 0.25;
      } else { await wait(700 + Math.random() * 600); power = Math.random() < 0.25 ? 1 : Math.random() < 0.6 ? 0.6 : 0.25; }
      const [atk, def] = mine ? [av, foe] : [foe, av];
      atk.play(anim[0], true); atk.onDone = () => atk.play('Idle_Loop');
      await wait(380);
      def.play(anim[1], true); def.onDone = () => def.play('Idle_Loop');
      w.opts.sfx?.[kind === 'slap' ? 'poke' : 'push']?.();
      if (power === 1) w.say(mine ? pick(['ПОЛУЧАЙ', 'ВОТ ТАК', 'сука']) : pick(['АЙ', 'блять больно', 'ОЙ']), 900);
      const dmg = Math.round((kind === 'knife' ? 34 : kind === 'box' ? 24 : 18) * power * (0.85 + Math.random() * 0.3));
      F.hp[mine ? 1 : 0] -= dmg;
      hpUi();
      await wait(900);
      F.turn = 1 - F.turn;
    }
    removeEventListener('keydown', key);
    const won = F.hp[1] <= 0;
    const T = this.tally(), my = this.myTeam(), their = my === 'ct' ? 't' : 'ct';
    T[won ? my : their]++;
    try { localStorage.setItem('dc.beef', JSON.stringify(T)); } catch (e) {}
    this.paintBoard();
    (won ? foe : av).play('Death01', true);
    (won ? av : foe).play('Dance_Loop');
    this.say(won ? pick(['кто следующий', 'на доску это', 'изи']) : pick(['он мухлевал', 'я поскользнулся', 'реванш']), 2600);
    if (!won) this.ohneShow();
    won ? w.opts.sfx?.ok?.() : w.opts.sfx?.fail?.();
    if (won) w.bank.add(60, 0, 15);
    await wait(3000);
    ui.remove();
    c.gone = true;
    w.shot = null;
    av.play('Idle_Loop');
    w.busy = false;
    this.event = null;
  }
}
