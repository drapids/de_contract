import { M4, Q, merge, boxG } from './engine.js';
import { Avatar } from './avatar.js';
import { lathe } from './chess.js';
import { TIER_COLORS, WEARS } from '../tradeup.js';

const at = (x, y, z, s = 1) => M4.fromQT([0, 0, 0, 1], [x, y, z], s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const short = h => h.replace(/ \((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/, m => ' ' + WEARS.find(w => m.includes(w[0]))[1]);

export function holiday(d = new Date()) {
  const m = d.getMonth() + 1, day = d.getDate();
  if ((m === 12 && day >= 29) || (m === 1 && day <= 2)) return 'newyear';
  if ((m === 11 && day >= 25) || (m === 12 && day <= 28)) return 'xmas';
  if ((m === 10 && day >= 24) || (m === 11 && day <= 1)) return 'halloween';
  if (m === 4 && day === 1) return 'april';
  return null;
}

export class Events {
  constructor(w) {
    this.w = w;
    this.e = w.e;
    this.heliT = 140 + Math.random() * 200;
    this.heli = null;
    this.pokes = 0;
    this.flake = [];
    this.fw = [];
    this.flash = document.createElement('div');
    this.flash.className = 'flashbang';
    w.ui.append(this.flash);
    const mk = document.createElement('div');
    mk.className = 'nmarket';
    mk.hidden = true;
    mk.innerHTML = `<div class="nm-win"><div class="nm-t"><b>NIGHT MARKET</b><span class="nm-left"></span><button class="x">x</button></div><p class="nm-sub">the ghost sells stuff while he sleeps. new stock every night. flip the cards</p><div class="nm-cards"></div></div>`;
    w.ui.append(mk);
    this.mk = mk;
    mk.querySelector('.x').onclick = () => this.closeMarket();
    w.canvas.addEventListener('pointerdown', e => this.poke(e));
  }

  async build() {
    const e = this.e;
    const dark = [0.18, 0.22, 0.16, 1];
    this.heliBody = e.shape(merge(boxG(1.6, 1.3, 3.4, 0, 0, 0), boxG(1.3, 0.9, 1.1, 0, 0.1, 2.0), boxG(0.35, 0.35, 4.2, 0, 0.25, -3.6), boxG(0.12, 1.1, 0.6, 0, 0.7, -5.5), boxG(2.6, 0.12, 0.4, 0, -0.75, 0.6), boxG(0.12, 0.6, 0.12, 0.9, -0.5, 0.6), boxG(0.12, 0.6, 0.12, -0.9, -0.5, 0.6), boxG(3.6, 0.15, 0.5, 0, -0.1, 0.2)), null, dark);
    this.heliGlass = e.shape(boxG(1.2, 0.6, 0.05, 0, 0.25, 2.56), null, [0.2, 0.3, 0.35, 1]);
    this.rotor = e.shape(merge(boxG(9, 0.06, 0.3, 0, 0, 0), boxG(0.3, 0.06, 9, 0, 0, 0)), null, [0.08, 0.08, 0.08, 1]);
    this.tailRotor = e.shape(boxG(0.06, 1.8, 0.18, 0, 0, 0), null, [0.08, 0.08, 0.08, 1]);
    this.flakeObj = e.shape(boxG(0.035, 0.035, 0.035), null, [1, 1, 1, 1]);
    this.spark = e.shape(boxG(0.12, 0.12, 0.12), null, [1, 1, 1, 1]);
    this.tree = e.shape(merge(lathe([[0, 0], [0.45, 0.25], [0.12, 0.3], [0.38, 0.7], [0.1, 0.75], [0.3, 1.1], [0.0, 1.6]], 7), boxG(0.12, 0.3, 0.12, 0, -0.1, 0)), null, [0.12, 0.34, 0.16, 1]);
    this.star = e.shape(boxG(0.1, 0.1, 0.03), null, [1, 0.85, 0.2, 1]);
    this.bulb = e.shape(boxG(0.04, 0.05, 0.04), null, [1, 1, 1, 1]);
    this.pumpkin = e.shape(lathe([[0, 0], [0.12, 0.03], [0.17, 0.12], [0.15, 0.22], [0.05, 0.26], [0.0, 0.26]], 8), null, [0.9, 0.45, 0.08, 1]);
    this.bookObj = e.shape(merge(boxG(0.13, 0.18, 0.035), boxG(0.12, 0.17, 0.037, 0.006, 0, 0)), null, [0.42, 0.08, 0.1, 1]);
    const me = this.w.opts.skin || 'sas';
    this.ghost = new Avatar(e);
    try { await this.ghost.load(me === 'phoenix' ? 'assets/agents/sas' : 'assets/agents/phoenix'); this.ghost.play('Idle_FoldArms_Loop'); this.ghost.pos = [2.75, 0, -1.25]; this.ghost.yaw = -Math.PI * 0.7; } catch (e) { this.ghost = null; }
    const sc = this.w.scenes.basement;
    sc.acts.push({ p: [2.75, 1.2, -1.25], r: 1.4, label: 'night market', cond: () => this.marketOpen(), act: () => this.openMarket() });
  }

  hour() { const d = new Date(); return d.getHours() + d.getMinutes() / 60; }
  marketOpen() { const h = this.hour(); return h >= 21 || h < 6 || this.forceNight; }

  update(dt, now) {
    const w = this.w;
    this.heliT -= dt;
    if (this.heliT <= 0 && !this.heli && !w.busy) { this.heliT = 240 + Math.random() * 360; this.fly(); }
    if (this.heli) this.heliStep(dt);
    if (this.ghost && this.marketOpen()) this.ghost.update(dt);
    const sleepy = this.marketOpen() && w.scene === w.scenes.basement;
    if (sleepy && !w.busy && !w.seated && !this.sleeping && w.idle > 30) this.sleep();
    if (this.sleeping) { this.zz = (this.zz || 0) - dt; if (this.zz <= 0) { this.zz = 3.5; w.say('z z z', 2400); } }
    const hol = this.hol = this.forceHol ?? holiday();
    if ((hol === 'xmas' || hol === 'newyear') && w.scene === w.scenes.yard) {
      while (this.flake.length < 260) this.flake.push([(Math.random() - 0.5) * 24, Math.random() * 12, (Math.random() - 0.5) * 18, Math.random()]);
      for (const f of this.flake) { f[1] -= dt * (0.7 + f[3] * 0.5); f[0] += Math.sin(now + f[3] * 9) * dt * 0.3; if (f[1] < 0) { f[1] = 10 + Math.random() * 2; f[0] = (Math.random() - 0.5) * 24; f[2] = (Math.random() - 0.5) * 18; } }
    }
    if (hol === 'newyear' && w.scene === w.scenes.yard && w.timeOfDay() < 0.5) {
      if (Math.random() < dt * 0.8) { const c = [[1, 0.3, 0.2], [0.3, 1, 0.4], [0.4, 0.6, 1], [1, 0.9, 0.3]][Math.random() * 4 | 0], o = [(Math.random() - 0.5) * 16, 10 + Math.random() * 6, -4 + Math.random() * 10]; for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, b = Math.random() * 3.14; this.fw.push({ p: o.slice(), v: [Math.cos(a) * Math.sin(b) * 5, Math.cos(b) * 5, Math.sin(a) * Math.sin(b) * 5], c, t: 1.6 }); } }
      for (const p of this.fw) { p.t -= dt; p.v[1] -= 4 * dt; for (let k = 0; k < 3; k++) p.p[k] += p.v[k] * dt; }
      this.fw = this.fw.filter(p => p.t > 0);
    }
  }

  draw(now) {
    const w = this.w, e = this.e, sc = w.scene;
    if (this.heli && sc === w.scenes.yard) {
      const h = this.heli, M = M4.mul(at(...h.p), M4.rotY(h.yaw));
      const tilt = M4.mul(M, M4.fromQT(Q.axis([1, 0, 0], 0.14), [0, 0, 0]));
      e.draw(this.heliBody, tilt); e.draw(this.heliGlass, tilt, { unlit: 1 });
      e.draw(this.rotor, M4.mul(tilt, M4.mul(at(0, 0.85, 0.2), M4.rotY(now * 31))));
      e.draw(this.tailRotor, M4.mul(tilt, M4.mul(at(0.15, 0.7, -5.6), M4.fromQT(Q.axis([1, 0, 0], now * 40), [0, 0, 0]))));
    }
    if (this.ghost && this.marketOpen() && sc === w.scenes.basement) this.ghost.draw({ unlit: 1, tint: [0.55 + Math.sin(now * 3) * 0.08, 0.8, 1.0, 1] });
    const hol = this.hol;
    if ((hol === 'xmas' || hol === 'newyear') && sc === w.scenes.yard) for (const f of this.flake) e.draw(this.flakeObj, at(f[0], f[1], f[2]), { unlit: 1, tint: [0.9, 0.92, 1, 1] });
    if ((hol === 'xmas' || hol === 'newyear') && sc === w.scenes.basement) {
      e.draw(this.tree, at(-3.4, 0.1, 2.5));
      e.draw(this.star, at(-3.4, 1.72, 2.5), { unlit: 1 });
      const cols = [[1, 0.2, 0.2, 1], [0.2, 1, 0.3, 1], [0.3, 0.5, 1, 1], [1, 0.85, 0.2, 1]];
      for (let i = 0; i < 26; i++) {
        const on = ((now * 2 | 0) + i) % 3 !== 0;
        e.draw(this.bulb, at(-3.9 + i * 0.3, 2.33 + Math.sin(i * 1.3) * 0.04, -2.84), { unlit: 1, tint: on ? cols[i % 4] : [0.15, 0.15, 0.15, 1] });
        if (i < 10) e.draw(this.bulb, at(-3.4 + Math.cos(i * 1.7) * (0.35 - i * 0.025), 0.35 + i * 0.12, 2.5 + Math.sin(i * 1.7) * (0.35 - i * 0.025)), { unlit: 1, tint: on ? cols[(i + 1) % 4] : [0.15, 0.15, 0.15, 1] });
      }
    }
    if (hol === 'newyear') for (const p of this.fw) e.draw(this.spark, at(...p.p), { unlit: 1, tint: [...p.c.map(v => v * Math.min(1, p.t)), 1] });
    if (hol === 'halloween') for (const [x, z, s] of sc === w.scenes.yard ? [[-2, 2, 1.4], [5, -6, 1], [-8, 6, 1.2], [1, -6.8, 0.9]] : [[-2.6, -2.5, 0.9], [3.6, 1.2, 0.7]]) e.draw(this.pumpkin, at(x, 0, z, s));
    if (w.av.cur === 'Idle_TalkingPhone_Loop' && w.av.W && !w.chessOn) {
      const R = w.av.rig, H = w.av.W[R.byName['hand.r']];
      if (H) {
        const o = Float32Array.from(H);
        for (const c of [0, 4, 8]) { const l = Math.hypot(o[c], o[c + 1], o[c + 2]) || 1; o[c] /= l; o[c + 1] /= l; o[c + 2] /= l; }
        e.draw(this.bookObj, M4.mul(M4.mul(w.av.model(), o), at(0, 0.09, 0.05)));
      }
    }
  }

  fly() {
    const w = this.w, side = Math.random() < 0.5 ? 1 : -1, z = -3 + Math.random() * 6;
    this.heli = { p: [-40 * side, 8, z], v: [11 * side, 0, (Math.random() - 0.5) * 1.5], yaw: side > 0 ? Math.PI / 2 : -Math.PI / 2, t: 0, scared: false };
    this.noise();
    if (w.scene === w.scenes.basement) setTimeout(() => { w.flick.until = performance.now() / 1000 + 1.2; w.say(['это что вертолёт?', 'опять летают', 'тихо...'], 2500); }, 3200);
  }

  heliStep(dt) {
    const h = this.heli, w = this.w;
    h.t += dt;
    for (let k = 0; k < 3; k++) h.p[k] += h.v[k] * dt;
    h.p[1] = 8 + Math.sin(h.t * 0.8) * 0.6;
    const d = Math.hypot(h.p[0] - w.av.pos[0], h.p[2] - w.av.pos[2]);
    if (this.snd) {
      const g = Math.max(0.02, 1 - d / 45) * 0.28 * (w.opts.volume?.() ?? 0.5) * (w.scene === w.scenes.yard ? 1 : 0.35);
      this.snd.g.gain.setTargetAtTime(g, this.snd.ac.currentTime, 0.1);
    }
    if (w.scene === w.scenes.yard && d < 16 && !h.scared && !w.busy) {
      h.scared = true;
      w.say(['ЛОЖИСЬ', 'ВЕРТОЛЁТ БЛЯТЬ', 'не стреляйте я свой'], 2200);
      w.av.play('Crouch_Idle_Loop');
      const dx = w.av.pos[0] - h.p[0], dz = w.av.pos[2] - h.p[2], l = Math.hypot(dx, dz) || 1;
      w.scared = { t: 2.6, v: [dx / l * 1.2, dz / l * 1.2] };
      const c = w.chicken; if (c && !c.fly) c.tgt = [c.pos[0] - h.v[0] * 0.4, 0, c.pos[2] + 3];
      for (const n of w.npcs) n.av.play('Crouch_Idle_Loop');
      setTimeout(() => { for (const n of w.npcs) n.av.play('Idle_Loop'); }, 4000);
    }
    if (Math.abs(h.p[0]) > 45) { this.heli = null; if (this.snd) { this.snd.g.gain.setTargetAtTime(0, this.snd.ac.currentTime, 0.3); const s = this.snd; setTimeout(() => { try { s.src.stop(); } catch (e) {} }, 1500); this.snd = null; } }
  }

  noise() {
    try {
      const ac = this.w.ac ||= new AudioContext();
      const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) { const t = i / ac.sampleRate; d[i] = (Math.random() * 2 - 1) * (0.35 + 0.65 * Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 11)), 6)); }
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      const g = ac.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(ac.destination); src.start();
      this.snd = { ac, src, g };
    } catch (e) {}
  }

  sleep() {
    const w = this.w;
    this.sleeping = true;
    w.sit([0.3, 0, -2.45]);
    w.sleeping = true;
  }

  wake() {
    if (!this.sleeping) return;
    this.sleeping = false;
    this.w.sleeping = false;
    this.pokes = 0;
  }

  poke(ev) {
    const w = this.w;
    if (!this.sleeping || !w.active) return;
    const h = w.av.head(), p = this.e.project(h);
    if (!p || Math.hypot(p[0] - ev.clientX, p[1] - ev.clientY) > 90) return;
    this.pokes++;
    w.opts.sfx?.poke?.();
    if (this.pokes > 2 && Math.random() < 0.03) { this.flashbang(); return; }
    w.say(['ммм', 'отстань', 'ещё пять минут', 'я тебя найду', 'сука дай поспать', 'ммф'][Math.min(5, this.pokes - 1 + (Math.random() * 2 | 0))], 1400);
    this.zz = 2;
  }

  flashbang() {
    const w = this.w;
    w.say('ПОЛУЧАЙ', 900);
    w.opts.sfx?.key?.();
    setTimeout(() => {
      const f = this.flash;
      f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
      try {
        const ac = w.ac ||= new AudioContext(), t = ac.currentTime, v = (w.opts.volume?.() ?? 0.5);
        const bang = ac.createBufferSource(), len = ac.sampleRate * 0.4, b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
        bang.buffer = b; const bg = ac.createGain(); bg.gain.value = 0.9 * v; bang.connect(bg); bg.connect(ac.destination); bang.start(t);
        const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 3600; o.type = 'sine';
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18 * v, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
        o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 4.6);
      } catch (e) {}
      this.wake();
      w.stand();
    }, 700);
  }

  seed() { const d = new Date(); if (d.getHours() < 6) d.setDate(d.getDate() - 1); return d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate(); }

  stock() {
    const b = this.w.bank.s, sd = this.seed();
    if (b.market?.day === sd && b.market.v === 2) return b.market;
    const cr = this.w.loot.crates();
    if (!cr.length) return null;
    let a = sd;
    const rnd = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
    const keep = Math.random;
    Math.random = rnd;
    const items = [];
    for (let i = 0; i < 6; i++) {
      const c = cr[Math.floor(rnd() * cr.length)];
      let it; for (let k = 0; k < 12; k++) { it = this.w.loot.roll(c); if (it.r >= 3 && this.w.loot.priced(it)) break; }
      items.push({ ...it, off: 30 + Math.floor(rnd() * 45) });
    }
    Math.random = keep;
    b.market = { day: sd, v: 2, items, seen: [], bought: [] };
    this.w.bank.save();
    return b.market;
  }

  openMarket() {
    const w = this.w, m = this.stock();
    w.busy = true;
    this.mk.hidden = false;
    this.ghost?.play('Idle_Talking_Loop');
    w.say(['пс. иди сюда', 'только сегодня', 'не говори ему'][Math.random() * 3 | 0], 1800);
    const c = this.mk.querySelector('.nm-cards');
    if (!m) { c.innerHTML = '<p class="nm-sub">nothing tonight. no skins loaded yet</p>'; return; }
    const h = this.hour(), left = h >= 21 ? 30 - h : h < 6 ? 6 - h : 0;
    this.mk.querySelector('.nm-left').textContent = left > 0 ? 'closes in ' + Math.floor(left) + 'h ' + Math.floor(left % 1 * 60) + 'm' : '';
    c.innerHTML = m.items.map((it, i) => {
      const v = this.w.loot.value(it), price = Math.max(5, Math.round(v * (100 - it.off) / 100));
      const open = m.seen.includes(i), got = m.bought.includes(i);
      return `<div class="nm-card ${open ? 'open' : ''} ${got ? 'got' : ''}" data-i="${i}" style="--c:${TIER_COLORS[it.r]}">${open ? `${it.img ? `<img src="${esc(it.img)}" alt="">` : ''}<b>${esc(short(it.hash))}</b><s>${v} ₽</s><em>-${it.off}%</em><button class="btn" ${got ? 'disabled' : ''}>${got ? 'bought' : price + ' ₽'}</button>` : '<span>?</span>'}</div>`;
    }).join('');
    c.querySelectorAll('.nm-card').forEach(el => el.onclick = ev => {
      const i = +el.dataset.i;
      if (!m.seen.includes(i)) { m.seen.push(i); this.w.bank.save(); this.w.opts.sfx?.beep?.(true); this.openMarket(); return; }
      if (ev.target.closest('button') && !m.bought.includes(i)) {
        const it = m.items[i], price = Math.max(5, Math.round(this.w.loot.value(it) * (100 - it.off) / 100));
        if (!this.w.bank.spend(price)) { this.w.say('not enough rubles'); return; }
        m.bought.push(i);
        const { off, ...item } = it;
        this.w.bank.s.inv.push({ ...item, at: Date.now() });
        this.w.bank.save();
        this.w.say(['приятно иметь дело', 'хе-хе'], 1500);
        this.openMarket();
      }
    });
  }

  closeMarket() { this.mk.hidden = true; this.w.busy = false; this.ghost?.play('Idle_FoldArms_Loop'); }
}
