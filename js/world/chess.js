import { M4, Q, merge } from './engine.js';
import { boxG } from './engine.js';
import { Avatar } from './avatar.js';
import { paint, grain, blot } from './tex.js';
import * as R from './chessrules.js';

export const RIVALS = [
  { id: 'quandale', name: 'Quandale Dingle', elo: 400, skin: 'assets/chars/quandale', lines: ['what is up guys', 'это шах?', 'goofy ahh move'] },
  { id: 'pork', name: 'John Pork', elo: 900, skin: 'assets/chars/pork', lines: ['*хрю*', 'john pork is calling', 'хм'] },
  { id: 'haggord', name: 'Haggord', elo: 1300, skin: 'assets/chars/haggord', lines: ['yer a wizard', 'хороший ход', 'ну ну'] },
  { id: 'speed', name: 'IShowSpeed', elo: 1800, skin: null, lines: ['SEWEY', 'WHAT', 'bro is NOT him'] },
  { id: 'yakub', name: 'Yakub', elo: 2600, skin: 'orange', lines: ['предсказуемо', 'я это видел за 12 ходов', '...'] }
];

export function lathe(prof, seg = 8) {
  const P = [], N = [], U = [], I = [];
  for (let i = 0; i < prof.length; i++) {
    const [r, y] = prof[i];
    for (let k = 0; k <= seg; k++) {
      const a = k / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      P.push(r * c, y, r * s);
      const p0 = prof[Math.max(0, i - 1)], p1 = prof[Math.min(prof.length - 1, i + 1)];
      const dy = p1[1] - p0[1], dr = p1[0] - p0[0], l = Math.hypot(dy, dr) || 1;
      N.push(dy / l * c, -dr / l, dy / l * s);
      U.push(k / seg, y * 8);
    }
  }
  for (let i = 0; i < prof.length - 1; i++) for (let k = 0; k < seg; k++) {
    const a = i * (seg + 1) + k, b = a + seg + 1;
    I.push(a, b, a + 1, a + 1, b, b + 1);
  }
  return { P, N, U, I };
}

function pieceGeo(t) {
  const base = [[0, 0], [0.026, 0], [0.026, 0.006], [0.021, 0.009]];
  if (t === 'p') return lathe([...base, [0.012, 0.014], [0.009, 0.03], [0.014, 0.033], [0.012, 0.04], [0.006, 0.046], [0, 0.047]], 7);
  if (t === 'r') return lathe([...base, [0.016, 0.014], [0.014, 0.042], [0.02, 0.046], [0.02, 0.056], [0.013, 0.056], [0.013, 0.052], [0, 0.052]], 6);
  if (t === 'b') return lathe([...base, [0.013, 0.015], [0.009, 0.044], [0.014, 0.048], [0.011, 0.062], [0.005, 0.07], [0.003, 0.075], [0, 0.075]], 7);
  if (t === 'q') return lathe([...base, [0.015, 0.016], [0.01, 0.055], [0.017, 0.06], [0.019, 0.07], [0.012, 0.072], [0.006, 0.078], [0, 0.08]], 8);
  if (t === 'k') return merge(lathe([...base, [0.016, 0.016], [0.011, 0.06], [0.018, 0.064], [0.016, 0.074], [0, 0.076]], 8), boxG(0.005, 0.022, 0.005, 0, 0.085, 0), boxG(0.016, 0.005, 0.005, 0, 0.088, 0));
  if (t === 'n') {
    const h = boxG(0.016, 0.03, 0.03, 0, 0.042, 0.002), m = boxG(0.014, 0.014, 0.022, 0, 0.05, 0.02), e = boxG(0.012, 0.008, 0.006, 0, 0.06, -0.004);
    return merge(lathe([...base, [0.015, 0.014], [0.012, 0.028], [0, 0.03]], 7), h, m, e);
  }
}

export class Chess {
  constructor(w) {
    this.w = w;
    this.e = w.e;
    this.on = false;
    this.foe = new Avatar(w.e);
    this.fish = null;
    const el = this.el = document.createElement('div');
    el.className = 'chess';
    el.hidden = true;
    el.innerHTML = `<div class="ch-pick win"><div class="dlg-t"><span>chess</span><button class="x" data-x>x</button></div><div class="ch-list"></div>
      <div class="ch-custom"><label>custom elo <input type="range" min="200" max="3000" step="50" value="1200"> <b>1200</b></label><button class="btn" data-custom>play</button></div></div>
      <div class="ch-hud" hidden><div class="ch-who"><b class="ch-name"></b><span class="ch-elo"></span></div><div class="ch-moves"></div><div class="ch-st"></div>
      <div class="ch-btns"><button class="btn" data-a="flip">switch color</button><button class="btn" data-a="resign">resign</button><button class="btn" data-a="quit">leave</button></div></div>
      <div class="ch-big" hidden></div>`;
    w.ui.append(el);
    this.$ = s => el.querySelector(s);
    this.$('[data-x]').onclick = () => this.close();
    const rng = this.$('.ch-custom input');
    rng.oninput = () => this.$('.ch-custom b').textContent = rng.value;
    this.$('[data-custom]').onclick = () => this.start({ id: 'custom', name: 'guy from the block', elo: +rng.value, skin: null, lines: ['хм', 'ну давай', 'ага'] });
    this.$('[data-a=resign]').onclick = () => this.g && !this.g.over && this.finish('resign');
    this.$('[data-a=quit]').onclick = () => this.open();
    this.$('[data-a=flip]').onclick = () => { if (this.g) { this.white = !this.white; this.start(this.g.f); } };
    this.white = true;
    addEventListener('keydown', e => { if (this.on && e.key === 'Escape') this.close(); });
    w.canvas.addEventListener('pointerdown', e => { if (this.on && this.g) this.click(e); });
    this.built = false;
  }

  build() {
    if (this.built) return;
    this.built = true;
    const e = this.e;
    const bt = paint(256, 256, (x, Rn) => {
      x.fillStyle = '#3a2716'; x.fillRect(0, 0, 256, 256);
      for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { x.fillStyle = (r + f) % 2 ? '#5b3c22' : '#c9b48a'; x.fillRect(16 + f * 28, 16 + r * 28, 28, 28); }
      blot(x, Rn, 256, 256, 14, 'rgba(30,20,8,.35)', 30);
      blot(x, Rn, 256, 256, 3, 'rgba(90,60,20,.4)', 16);
      grain(x, Rn, 256, 256, 3000, 0.25);
      x.fillStyle = 'rgba(230,210,170,.6)'; x.font = '9px monospace';
      for (let i = 0; i < 8; i++) { x.fillText('abcdefgh'[i], 26 + i * 28, 252); x.fillText(String(8 - i), 4, 34 + i * 28); }
    }, 77);
    this.boardTex = e.texCanvas(bt);
    const pt = (base, dark) => paint(32, 32, (x, Rn) => { x.fillStyle = base; x.fillRect(0, 0, 32, 32); blot(x, Rn, 32, 32, 5, dark, 8); grain(x, Rn, 32, 32, 300, 0.3); }, 91);
    this.texW = e.texCanvas(pt('#d9cfb4', 'rgba(70,50,20,.5)'));
    this.texB = e.texCanvas(pt('#2b1f17', 'rgba(120,90,50,.35)'));
    this.geo = {};
    for (const t of 'prnbqk') this.geo[t] = e.shape(pieceGeo(t), this.texW);
    const S = this.S = 0.066, H = S * 4 + 0.016;
    const C = this.C = this.w.chessTable;
    this.board = e.shape({ P: [-H, 0, -H, H, 0, -H, H, 0, H, -H, 0, H], N: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], U: [1, 1, 0, 1, 0, 0, 1, 0], I: [0, 1, 2, 0, 2, 3] }, this.boardTex);
    this.frame = e.shape(boxG(H * 2 + 0.01, 0.018, H * 2 + 0.01, 0, -0.013, 0), this.texB);
    this.dot = e.shape(boxG(S * 0.9, 0.002, S * 0.9), null, [1, 1, 1, 1]);
  }

  stats() { try { return JSON.parse(localStorage.getItem('dc.chess')) || {}; } catch { return {}; } }

  open() {
    this.on = true;
    this.g = null;
    this.w.busy = true;
    this.w.chessOn = true;
    this.el.hidden = false;
    this.$('.ch-pick').hidden = false;
    this.$('.ch-hud').hidden = true;
    this.$('.ch-big').hidden = true;
    const st = this.stats();
    this.$('.ch-list').innerHTML = RIVALS.map((f, i) => `<button class="arm-foe" data-i="${i}"><b>${f.name}</b><span class="elo">${f.elo}</span><em>${st[f.id] ? st[f.id].w + '-' + st[f.id].l + (st[f.id].d ? '-' + st[f.id].d : '') : 'never played'}</em></button>`).join('');
    this.$('.ch-list').querySelectorAll('button').forEach(b => b.onclick = () => this.start(RIVALS[+b.dataset.i]));
    if (!this.fish) this.fish = new R.Fish();
  }

  close() {
    this.on = false;
    this.g = null;
    this.el.hidden = true;
    this.w.busy = false;
    this.w.chessOn = false;
    this.w.av.play('Idle_Loop');
  }

  async start(f) {
    this.build();
    const me = this.w.opts.skin || 'sas';
    await this.foe.load(f.skin || (me === 'phoenix' ? 'assets/agents/sas' : 'assets/agents/phoenix'));
    this.foe.play('Sitting_Idle_Loop');
    this.w.av.play('Sitting_Idle_Loop');
    const s = R.start();
    const g = this.g = { f, s, lvl: R.levelFor(f.elo), sel: -1, targets: [], over: false, thinking: false, san: [], anim: null, last: null, me: this.white ? 'w' : 'b' };
    this.$('.ch-pick').hidden = true;
    this.$('.ch-hud').hidden = false;
    this.$('.ch-big').hidden = true;
    this.$('.ch-name').textContent = f.name;
    this.$('.ch-elo').textContent = f.elo + ' elo';
    this.ui();
    if (g.me !== 'w') this.ai();
  }

  ui() {
    const g = this.g;
    const pairs = [];
    for (let i = 0; i < g.san.length; i += 2) pairs.push(`${i / 2 + 1}. ${g.san[i]} ${g.san[i + 1] || ''}`);
    const mv = this.$('.ch-moves');
    mv.textContent = pairs.join('\n');
    mv.scrollTop = 1e6;
    const st = R.status(g.s);
    this.$('.ch-st').textContent = g.over ? '' : g.thinking ? `${g.f.name} is thinking...` : st ? '' : (g.s.turn === g.me ? 'your move' : '') + (R.inCheck(g.s) ? ' · check!' : '');
  }

  sqPos(i) {
    const f = i % 8, r = i >> 3, S = this.S, C = this.C;
    const ff = this.g?.me === 'b' ? 7 - f : f, rr = this.g?.me === 'b' ? 7 - r : r;
    return [C[0] - (ff - 3.5) * S, C[1], C[2] - 3.5 * S + rr * S];
  }

  click(ev) {
    const g = this.g;
    if (g.over || g.thinking || g.anim || g.s.turn !== g.me) return;
    const rc = this.w.canvas.getBoundingClientRect();
    let best = -1, bd = 1e9;
    for (let i = 0; i < 64; i++) {
      const p = this.e.project(this.sqPos(i));
      if (!p) continue;
      const d = Math.hypot(p[0] - ev.clientX, p[1] - ev.clientY);
      if (d < bd) { bd = d; best = i; }
    }
    const a = this.e.project(this.sqPos(0)), b = this.e.project(this.sqPos(9));
    if (best < 0 || !a || !b || bd > Math.hypot(a[0] - b[0], a[1] - b[1]) * 0.75) { g.sel = -1; g.targets = []; return; }
    const p = g.s.b[best];
    const mine = p && R.isW(p) === (g.me === 'w');
    if (g.sel >= 0) {
      const m = g.targets.find(m => m.to === best);
      if (m) { const pm = g.targets.filter(x => x.to === best); this.move(pm.find(x => !x.promo || x.promo.toLowerCase() === 'q') || m); return; }
    }
    if (mine) { g.sel = best; g.targets = R.moves(g.s).filter(m => m.from === best); this.w.opts.sfx?.key?.(); }
    else { g.sel = -1; g.targets = []; }
  }

  move(m) {
    const g = this.g;
    g.san.push(R.san(g.s, m));
    g.anim = { m, t: 0, from: this.sqPos(m.from), to: this.sqPos(m.to), p: m.p, prev: g.s };
    g.s = R.make(g.s, m);
    g.sel = -1; g.targets = []; g.last = m;
    this.w.opts.sfx?.[m.cap ? 'shot' : 'key']?.();
    this.ui();
  }

  afterMove() {
    const g = this.g;
    const st = R.status(g.s);
    if (st) return this.finish(st);
    if (g.s.turn !== g.me) this.ai();
    else if (R.inCheck(g.s)) this.w.say(['шах блять', 'ой', 'он меня шахнул']);
  }

  async ai() {
    const g = this.g;
    g.thinking = true; this.ui();
    const t0 = performance.now();
    await new Promise(r => setTimeout(r, 30));
    let m = null;
    const ms = R.moves(g.s);
    if (Math.random() < g.lvl.blunder) m = ms[Math.random() * ms.length | 0];
    else if (g.f.elo >= 1500 && this.fish?.ok) {
      const u = await this.fish.go(R.fen(g.s), g.lvl.skill, g.f.elo >= 2200 ? 1200 : 400);
      if (u && this.g === g) m = R.fromUci(g.s, u);
    }
    if (!m) m = R.think(g.s, g.lvl.depth, g.lvl.noise);
    const wait = 600 + Math.random() * 900 - (performance.now() - t0);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    if (this.g !== g) return;
    g.thinking = false;
    if (Math.random() < 0.12 && g.f.lines.length) this.w.say(g.f.lines[Math.random() * g.f.lines.length | 0], 1500);
    this.move(m);
  }

  finish(st) {
    const g = this.g;
    g.over = true;
    let res;
    if (st === 'mate') res = g.s.turn === g.me ? 'l' : 'w';
    else if (st === 'resign') res = 'l';
    else res = 'd';
    const big = this.$('.ch-big');
    big.hidden = false;
    big.textContent = res === 'w' ? 'CHECKMATE. you won' : res === 'l' ? (st === 'resign' ? 'you resigned' : 'you got mated') : st === 'stalemate' ? 'stalemate' : 'draw';
    const s = this.stats(), r = s[g.f.id] ||= { w: 0, l: 0, d: 0 };
    r[res]++;
    try { localStorage.setItem('dc.chess', JSON.stringify(s)); } catch {}
    res === 'w' ? this.w.opts.sfx?.ok?.() : this.w.opts.sfx?.fail?.();
    this.w.say(res === 'w' ? ['гг изи', 'шахматист от бога', 'magnus who'] : res === 'l' ? ['доска кривая', 'я специально', 'реванш блять'] : ['ну ок']);
    this.w.opts.onEvent?.('chess_' + res, g.f.id);
    this.ui();
  }

  update(dt) {
    const g = this.g;
    if (!g?.anim) return;
    g.anim.t += dt / 0.32;
    if (g.anim.t >= 1) { g.anim = null; this.afterMove(); }
  }

  draw() {
    if (!this.built) return;
    const g = this.g || (this.idle ||= { s: R.start(), me: 'w', targets: [], sel: -1, last: null, anim: null }), e = this.e, C = this.C;
    const T = M4.fromQT([0, 0, 0, 1], C);
    e.draw(this.frame, T);
    e.draw(this.board, M4.mul(M4.mul(T, M4.fromQT([0, 0, 0, 1], [0, 0.001, 0])), M4.rotY(g.me === 'b' ? Math.PI : 0)));
    const b = g.s.b, a = g.anim;
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (!p) continue;
      let pos = this.sqPos(i);
      if (a && a.m.to === i) { const k = Math.min(1, a.t), s = k * k * (3 - 2 * k); pos = [a.from[0] + (a.to[0] - a.from[0]) * s, C[1] + Math.sin(k * Math.PI) * 0.04, a.from[2] + (a.to[2] - a.from[2]) * s]; }
      this.piece(p, pos, i);
    }
    if (a && a.m.cap && a.t < 1) { const k = a.t; const cp = a.m.epc != null ? this.sqPos(a.m.epc) : a.to; this.piece(a.m.cap, [cp[0] + k * 0.25, C[1] + k * 0.1 - k * k * 0.2, cp[2] - k * 0.1], 99, k * 6); }
    const mark = (i, col) => e.draw(this.dot, M4.fromQT([0, 0, 0, 1], [this.sqPos(i)[0], C[1] + 0.003, this.sqPos(i)[2]]), { unlit: 1, tint: col });
    if (g.last && !a) { mark(g.last.from, [0.6, 0.55, 0.2, 1]); mark(g.last.to, [0.75, 0.7, 0.25, 1]); }
    if (g.sel >= 0) mark(g.sel, [0.3, 0.8, 0.3, 1]);
    for (const m of g.targets) mark(m.to, m.cap ? [0.9, 0.3, 0.2, 1] : [0.25, 0.55, 0.85, 1]);
  }

  piece(p, pos, i, spin = 0) {
    const t = p.toLowerCase(), wt = R.isW(p);
    const ry = (t === 'n' ? (wt ? 0 : Math.PI) : 0) + ((i * 37) % 10 - 5) * 0.03 + spin + ((this.g || this.idle).me === 'b' ? Math.PI : 0);
    const m = M4.mul(M4.fromQT([0, 0, 0, 1], pos), M4.mul(M4.rotY(ry), M4.fromQT(Q.axis([1, 0, 0], spin * 0.3), [0, 0, 0])));
    this.e.draw(this.geo[t], m, { tex: wt ? this.texW : this.texB });
  }
}
