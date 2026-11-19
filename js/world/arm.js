import { M4, Q } from '../guy.js';
import { Avatar } from './avatar.js';

const D = Math.PI / 180;
const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
const rotv = (q, v) => { const p = Q.mul(Q.mul(q, [v[0], v[1], v[2], 0]), Q.conj(q)); return [p[0], p[1], p[2]]; };
function fromTo(a, b) {
  a = norm(a); b = norm(b);
  const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  if (d < -0.9999) return [0, 1, 0, 0];
  return norm([c[0], c[1], c[2], 1 + d]);
}

export const FOES = [
  { id: 'quandale', name: 'Quandale Dingle', skin: 'assets/chars/quandale', push: 0.05, spd: 150, surge: 0, lines: ['what is up guys', 'нет нет нет', 'goofy ahh arm'] },
  { id: 'pork', name: 'John Pork', skin: 'assets/chars/pork', push: 0.065, spd: 175, surge: 0.05, lines: ['*хрю*', 'john pork is calling', 'ты слабый'] },
  { id: 'haggord', name: 'Haggord', skin: 'assets/chars/haggord', push: 0.08, spd: 195, surge: 0.1, lines: ['yer a wizard', 'ХАХАХА', 'слабак'] },
  { id: 'hazmat', name: 'арктический', skin: 'assets/chars/hazmat', push: 0.095, spd: 215, surge: 0.14, lines: ['...', 'дыши глубже', 'scrap мой'] },
  { id: 'enemy', name: 'с района', skin: null, push: 0.11, spd: 235, surge: 0.18, lines: ['иди сюда', 'cyka', 'это мой барабан'] }
];

export class Arm {
  constructor(w) {
    this.w = w;
    this.e = w.e;
    this.on = false;
    this.foe = new Avatar(w.e);
    this.ui = document.createElement('div');
    this.ui.className = 'arm';
    this.ui.hidden = true;
    this.ui.innerHTML = `<div class="arm-pick win"><div class="dlg-t"><span>армрестлинг</span><button class="x" data-x>x</button></div><div class="arm-list"></div></div>
      <div class="arm-hud" hidden><div class="arm-names"><span class="a-me"></span><span class="a-vs">vs</span><span class="a-foe"></span></div>
      <div class="arm-bar"><i></i><b></b></div><div class="arm-dials"><canvas class="d1" width="180" height="180"></canvas><canvas class="d2" width="180" height="180" hidden></canvas></div>
      <div class="arm-tip"></div><div class="arm-big" hidden></div></div>`;
    w.ui.append(this.ui);
    this.$ = s => this.ui.querySelector(s);
    this.$('[data-x]').onclick = () => this.close();
    this.ui.addEventListener('pointerdown', e => {
      if (!this.m || this.m.over) return;
      const c = e.target.closest('canvas');
      if (c) { e.preventDefault(); this.press(c.classList.contains('d2') ? 1 : 0); }
    });
    addEventListener('keydown', e => {
      if (!this.on) return;
      if (e.key === 'Escape') { this.close(); return; }
      if (!this.m || this.m.over || e.repeat) return;
      if (e.key === ' ') { e.preventDefault(); this.press(0); }
      if (e.key === 'Enter' && this.m.friend) { e.preventDefault(); this.press(1); }
    });
  }

  stats() { try { return JSON.parse(localStorage.getItem('dc.arm')) || {}; } catch { return {}; } }

  open() {
    this.on = true;
    this.w.busy = true;
    this.ui.hidden = false;
    this.$('.arm-pick').hidden = false;
    this.$('.arm-hud').hidden = true;
    const st = this.stats();
    const list = this.$('.arm-list');
    list.innerHTML = FOES.map((f, i) => `<button class="arm-foe" data-i="${i}"><b>${f.name}</b><span>${'💪'.repeat(i + 1)}</span><em>${st[f.id] ? st[f.id].w + '-' + st[f.id].l : 'не играли'}</em></button>`).join('') +
      `<button class="arm-foe" data-i="friend"><b>с другом (один комп)</b><span>space vs enter</span><em></em></button>`;
    list.querySelectorAll('button').forEach(b => b.onclick = () => this.start(b.dataset.i === 'friend' ? 'friend' : FOES[+b.dataset.i]));
  }

  close() {
    this.on = false;
    this.m = null;
    this.ui.hidden = true;
    this.w.busy = false;
    this.w.match = null;
    this.w.av.play('Idle_Loop');
  }

  async start(foe) {
    const friend = foe === 'friend';
    const me = this.w.opts.skin || 'sas';
    const f = friend ? { id: 'friend', name: 'игрок 2', skin: me === 'phoenix' ? 'sas' : 'phoenix', push: 0, spd: 170, surge: 0, lines: [] } : { ...foe, skin: foe.skin || (me === 'phoenix' ? 'sas' : 'phoenix') };
    await this.foe.load(f.skin);
    this.foe.play('Idle_Loop');
    this.$('.arm-pick').hidden = true;
    this.$('.arm-hud').hidden = false;
    this.$('.a-me').textContent = friend ? 'игрок 1' : 'ты';
    this.$('.a-foe').textContent = f.name;
    this.$('.d2').hidden = !friend;
    this.$('.arm-tip').textContent = friend ? 'игрок 1 жмёт space, игрок 2 жмёт enter, когда стрелка в зелёном' : 'жми space (или клик) когда стрелка в зелёном';
    this.$('.arm-big').hidden = true;
    const dial = (spd) => ({ a: Math.random() * 360, dir: 1, spd, z: 0, zw: 70, flash: 0, combo: 0 });
    this.m = { f, friend, v: 0, t: 0, d: [dial(f.spd), dial(f.spd)], over: false, count: 2.2, surge: 0, shake: 0 };
    for (const d of this.m.d) this.zone(d);
    this.w.match = this;
    this.w.say('го');
  }

  zone(d) {
    let z;
    do z = Math.random() * 360; while (Math.abs(((z - d.a + 540) % 360) - 180) < 70);
    d.z = z;
  }

  press(i) {
    const m = this.m, d = m.d[i];
    if (m.count > 0) return;
    const off = Math.abs(((d.a - d.z + 540) % 360) - 180);
    const sg = i === 0 ? 1 : -1;
    if (off <= d.zw / 2) {
      d.combo++;
      m.v += sg * (0.085 + Math.min(d.combo, 6) * 0.012);
      d.dir *= -1;
      d.spd = Math.min(d.spd * 1.05 + 4, 420);
      d.zw = Math.max(26, d.zw * 0.94);
      d.flash = 1;
      this.zone(d);
      this.w.opts.sfx?.beep?.(d.combo > 3);
      m.shake = 0.15;
    } else {
      d.combo = 0;
      m.v -= sg * 0.07;
      d.flash = -1;
      d.zw = Math.min(70, d.zw + 6);
      this.w.opts.sfx?.key?.();
    }
  }

  update(dt) {
    const m = this.m;
    if (!m) return;
    m.t += dt;
    if (m.count > 0) { m.count -= dt; this.$('.arm-big').hidden = false; this.$('.arm-big').textContent = m.count > 1.4 ? 'ready' : m.count > 0.6 ? 'set' : 'GO'; if (m.count <= 0) this.$('.arm-big').hidden = true; }
    else if (!m.over) {
      for (const [i, d] of m.d.entries()) {
        if (i === 1 && !m.friend) continue;
        d.a = (d.a + d.dir * d.spd * dt + 360) % 360;
        d.flash *= 0.9;
      }
      if (!m.friend) {
        const ramp = 1 + Math.min(m.t / 40, 0.6);
        m.v -= m.f.push * ramp * dt;
        if (m.surge > 0) { m.v -= 0.22 * dt; m.surge -= dt; }
        else if (Math.random() < m.f.surge * dt) { m.surge = 0.7 + Math.random() * 0.6; if (m.f.lines.length) this.w.say(m.f.lines[Math.random() * m.f.lines.length | 0], 1400); }
      }
      if (Math.abs(m.v) >= 1) this.end(m.v > 0);
    }
    m.shake = Math.max(0, m.shake - dt);
    m.vs = (m.vs ?? 0) + (m.v - (m.vs ?? 0)) * Math.min(1, dt * 8);
    this.draw();
  }

  end(won) {
    const m = this.m;
    m.over = true;
    m.v = won ? 1 : -1;
    if (!m.friend) {
      const st = this.stats(), r = st[m.f.id] ||= { w: 0, l: 0 };
      won ? r.w++ : r.l++;
      try { localStorage.setItem('dc.arm', JSON.stringify(st)); } catch {}
      this.w.opts.onEvent?.(won ? 'arm_win' : 'arm_lose', m.f.id);
    }
    const big = this.$('.arm-big');
    big.hidden = false;
    big.textContent = m.friend ? (won ? 'игрок 1 победил' : 'игрок 2 победил') : won ? 'ПОБЕДА' : 'проиграл лол';
    this.w.say(won ? ['изи', 'сука да', 'кто следующий'] : ['рука болит блять', 'он читер', 'реванш']);
    won ? this.w.opts.sfx?.ok?.() : this.w.opts.sfx?.fail?.();
    setTimeout(() => {
      if (!this.on) return;
      this.w.av.play(won ? 'Dance_Loop' : 'Hit_Head', !won);
      this.foe.play(won ? 'Hit_Knockback' : 'Dance_Loop', won);
    }, 500);
    setTimeout(() => { if (this.on && this.m === m) this.open(); }, 4200);
  }

  draw() {
    const m = this.m;
    const bar = this.$('.arm-bar i');
    bar.style.width = ((m.vs + 1) / 2 * 100) + '%';
    for (const [i, d] of m.d.entries()) {
      if (i === 1 && !m.friend) continue;
      const c = this.$(i ? '.d2' : '.d1'), x = c.getContext('2d'), R = 74, cx = 90, cy = 90;
      x.clearRect(0, 0, 180, 180);
      x.fillStyle = 'rgba(20,22,16,.85)'; x.beginPath(); x.arc(cx, cy, R + 12, 0, 7); x.fill();
      x.lineWidth = 14; x.strokeStyle = '#2d3226'; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.stroke();
      const z0 = (d.z - d.zw / 2 - 90) * D, z1 = (d.z + d.zw / 2 - 90) * D;
      x.strokeStyle = d.flash > 0.3 ? '#e8f0a0' : '#7fd05a'; x.beginPath(); x.arc(cx, cy, R, z0, z1); x.stroke();
      x.lineWidth = 2; x.strokeStyle = '#11140d'; x.beginPath(); x.arc(cx, cy, R + 7, 0, 7); x.stroke(); x.beginPath(); x.arc(cx, cy, R - 7, 0, 7); x.stroke();
      const a = (d.a - 90) * D;
      x.strokeStyle = d.flash < -0.3 ? '#e05040' : '#e8e2c8'; x.lineWidth = 5;
      x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * (R + 6), cy + Math.sin(a) * (R + 6)); x.stroke();
      x.fillStyle = '#e8e2c8'; x.beginPath(); x.arc(cx, cy, 7, 0, 7); x.fill();
      x.fillStyle = '#c4b550'; x.font = 'bold 13px Tahoma'; x.textAlign = 'center';
      if (d.combo > 1) x.fillText('x' + d.combo, cx, cy + 30);
    }
  }

  pose(av, phi, side) {
    const R = av.rig, bn = n => M4.pos(R.rest[R.byName[n]]);
    const S0 = bn('upperArm.r'), C0 = bn('chest'), E0 = bn('lowerArm.r'), H0 = bn('hand.r');
    const Lu = Math.hypot(E0[0] - S0[0], E0[1] - S0[1], E0[2] - S0[2]), Lf = Math.hypot(H0[0] - E0[0], H0[1] - E0[1], H0[2] - E0[2]);
    const top = this.top;
    let lean = 10, qc, S;
    for (; lean <= 32; lean += 3) {
      qc = Q.axis([1, 0, 0], lean * D);
      const r = rotv(qc, [S0[0] - C0[0], S0[1] - C0[1], S0[2] - C0[2]]);
      S = [C0[0] + r[0], C0[1] + r[1], C0[2] + r[2]];
      if (S[1] - Lu * 0.92 <= top + 0.04) break;
    }
    const vy = Math.max(-0.92, Math.min(0.2, (top + 0.04 - S[1]) / Lu));
    const hz = Math.sqrt(Math.max(0, 1 - vy * vy));
    const du = norm([0.38 * hz, vy, 0.92 * hz]);
    const qu = fromTo([-1, 0, 0], rotv(Q.conj(qc), du));
    const s = Math.sin(phi * side), c = Math.cos(phi * side);
    const df = norm([s * 0.9, c, 0.95]);
    const qf = fromTo([-1, 0, 0], rotv(Q.conj(Q.mul(qc, qu)), df));
    const dl = norm([0.45, -0.75, 0.55]);
    const ql = fromTo([1, 0, 0], rotv(Q.conj(qc), dl));
    const qn = Q.axis([1, 0, 0], -lean * 0.5 * D);
    const base = av.pose?.p || {};
    const p = { ...base, chest: Q.mul(qc, Q.axis([0, 1, 0], -8 * D)), 'upperArm.r': qu, 'lowerArm.r': qf, 'hand.r': Q.axis([0, 0, 1], -20 * D), 'upperArm.l': ql, 'lowerArm.l': Q.axis([0, 0, 1], 30 * D), neck: qn, head: Q.axis([1, 0, 0], -lean * 0.4 * D) };
    const E = [S[0] + du[0] * Lu, S[1] + du[1] * Lu, S[2] + du[2] * Lu];
    return { p, root: av.pose?.root || [0, R.hip, 0], elbow: E, Lf };
  }

  place(av, phi, side, C, yaw) {
    const ps = this.pose(av, phi, side);
    av.pose = { p: ps.p, root: ps.root };
    const cs = Math.cos(yaw), sn = Math.sin(yaw), E = ps.elbow;
    const wx = E[0] * cs + E[2] * sn, wz = -E[0] * sn + E[2] * cs;
    const back = 0.19, tx = C[0] + Math.sin(yaw) * -back, tz = C[2] + Math.cos(yaw) * -back;
    av.pos = [tx - wx, 0, tz - wz];
    av.yaw = yaw;
    av.bones();
    const w = av.W[av.rig.byName['lowerArm.r']], m = av.model();
    const ax = m[0] * w[12] + m[4] * w[13] + m[8] * w[14] + m[12], az = m[2] * w[12] + m[6] * w[13] + m[10] * w[14] + m[14];
    av.pos[0] += tx - ax; av.pos[2] += tz - az;
  }
}
