import { Avatar } from './avatar.js';
import { FOES } from './arm.js';

const SUITS = ['♠', '♣', '♥', '♦'];
const RANKS = ['6', '7', '8', '9', '10', 'В', 'Д', 'К', 'Т'];
const red = s => s === '♥' || s === '♦';
const wait = ms => new Promise(r => setTimeout(r, ms));
const SMART = { quandale: 0.35, pork: 0.55, haggord: 0.7, hazmat: 0.85, enemy: 0.95 };

function deck() {
  const d = [];
  for (const s of SUITS) for (let r = 0; r < 9; r++) d.push({ s, r, id: s + r });
  for (let i = d.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}

export class Durak {
  constructor(w) {
    this.w = w;
    this.on = false;
    this.foe = new Avatar(w.e);
    const el = this.el = document.createElement('div');
    el.className = 'durak';
    el.hidden = true;
    el.innerHTML = `<div class="dk-pick win"><div class="dlg-t"><span>дурак</span><button class="x" data-x>x</button></div><div class="dk-list"></div></div>
      <div class="dk-table" hidden>
        <div class="dk-top"><span class="dk-foe"></span><div class="dk-ohand"></div></div>
        <div class="dk-mid"><div class="dk-deck"><div class="dk-trump"></div><div class="dk-pile"></div><b class="dk-left"></b></div><div class="dk-pairs"></div><div class="dk-bito"></div></div>
        <div class="dk-msg"></div>
        <div class="dk-me"><div class="dk-hand"></div><div class="dk-btns"><button class="btn" data-a="pass">бито</button><button class="btn" data-a="take">беру</button><button class="btn" data-a="quit">выйти</button></div></div>
        <div class="dk-big" hidden></div>
      </div>
      <div class="w98" hidden><div class="w98-t"><span>как_играть_в_дурака.txt - Блокнот</span><button data-ok>×</button></div><div class="w98-m">Файл&nbsp;&nbsp;Правка&nbsp;&nbsp;Формат&nbsp;&nbsp;Вид&nbsp;&nbsp;Справка</div><pre class="w98-b"></pre><div class="w98-f"><button data-ok>OK</button></div></div>
      <div class="scam" hidden><div class="scam-bar"><span>12:47</span><span>▂▄▆ 3G ▮▮▯</span></div><div class="scam-x">x</div><div class="scam-b"><div class="scam-h">ПОЗДРАВЛЯЕМ!!!</div><div class="scam-s">вы 1000000-й игрок в дурака</div><div class="scam-p">DURAK PRO 2009<br><small>без вирусов 100%</small></div><div class="scam-st">★★★★★ (9 999 отзывов)</div><button class="scam-go">DOWNLOAD &gt;</button><div class="scam-prog" hidden><i></i></div><div class="scam-f">реклама · <u>отключить рекламу</u></div></div></div>`;
    w.ui.append(el);
    this.$ = s => el.querySelector(s);
    this.$('[data-x]').onclick = () => this.close();
    el.querySelectorAll('[data-ok]').forEach(b => b.onclick = () => { this.$('.w98').hidden = true; try { localStorage.setItem('dc.durakHelp', '1'); } catch {} });
    this.$('.scam-x').onclick = () => this.$('.scam').hidden = true;
    this.$('.scam-go').onclick = () => this.scam();
    this.$('[data-a=pass]').onclick = () => this.pass();
    this.$('[data-a=take]').onclick = () => this.take();
    this.$('[data-a=quit]').onclick = () => this.open();
    addEventListener('keydown', e => { if (this.on && e.key === 'Escape') this.close(); });
    this.$('.w98-b').textContent = `ДУРАК (подкидной)

колода 36 карт, от шестёрки до туза.
нижняя карта колоды = козырь.

у всех по 6 карт. первым ходит у кого
самый маленький козырь.

ходишь картой -> он отбивается картой
той же масти но старше, или козырем.
можно подкидывать карты того же
достоинства что уже лежат на столе.

не может отбиться -> берёт всё.
отбился -> "бито", карты в сброс,
теперь ходит он.

после хода все добирают до 6.
колода кончилась и у тебя нет карт
= ты выиграл. последний с картами
= ДУРАК.

				- не потеряй этот файл`;
  }

  stats() { try { return JSON.parse(localStorage.getItem('dc.durak')) || {}; } catch { return {}; } }

  open() {
    this.on = true;
    this.g = null;
    this.w.busy = true;
    this.w.durakOn = true;
    this.el.hidden = false;
    this.$('.dk-pick').hidden = false;
    this.$('.dk-table').hidden = true;
    const st = this.stats();
    this.$('.dk-list').innerHTML = FOES.map((f, i) => `<button class="arm-foe" data-i="${i}"><b>${f.name}</b><span>${'🃏'.repeat(i + 1)}</span><em>${st[f.id] ? st[f.id].w + '-' + st[f.id].l : 'не играли'}</em></button>`).join('');
    this.$('.dk-list').querySelectorAll('button').forEach(b => b.onclick = () => this.start(FOES[+b.dataset.i]));
    let seen = false;
    try { seen = !!localStorage.getItem('dc.durakHelp'); } catch {}
    if (!seen) { this.$('.w98').hidden = false; setTimeout(() => { if (this.on) { this.$('.scam').hidden = false; this.w.opts.sfx?.beep?.(true); } }, 900); }
  }

  close() {
    this.on = false;
    this.g = null;
    this.el.hidden = true;
    this.w.busy = false;
    this.w.durakOn = false;
    this.w.av.play('Idle_Loop');
  }

  scam() {
    const b = this.$('.scam-go'), pr = this.$('.scam-prog'), bar = pr.querySelector('i');
    b.hidden = true; pr.hidden = false;
    let p = 0;
    const t = setInterval(() => {
      p += 3 + Math.random() * 9;
      if (p > 92 && p < 99) p = 99;
      bar.style.width = Math.min(p, 100) + '%';
      if (p >= 100) {
        clearInterval(t);
        this.$('.scam-b').innerHTML = '<div class="scam-h">ошибка</div><div class="scam-s">файл durak_pro_2009.apk.exe не найден</div><div class="scam-p" style="font-size:30px">ты дурак</div>';
        this.w.say(['ахахах', 'ты реально нажал', 'дурак']);
        const big = this.$('.dk-big');
        if (this.g) { big.hidden = false; big.textContent = 'ты дурак'; setTimeout(() => { if (!this.g?.over) big.hidden = true; }, 2000); }
        setTimeout(() => this.$('.scam').hidden = true, 2600);
      }
    }, 120);
  }

  async start(f) {
    const me = this.w.opts.skin || 'sas';
    await this.foe.load(f.skin || (me === 'phoenix' ? 'assets/agents/sas' : 'assets/agents/phoenix'));
    this.foe.play('Sitting_Idle_Loop');
    this.w.av.play('Sitting_Idle_Loop');
    const d = deck();
    const trump = d[0];
    const g = this.g = { f, smart: SMART[f.id] ?? 0.6, deck: d, trump: trump.s, trumpCard: trump, me: [], ai: [], table: [], bito: 0, att: 'me', over: false, busy: false };
    for (let i = 0; i < 6; i++) { g.me.push(g.deck.pop()); g.ai.push(g.deck.pop()); }
    const low = h => Math.min(...h.filter(c => c.s === g.trump).map(c => c.r), 99);
    g.att = low(g.ai) < low(g.me) ? 'ai' : 'me';
    this.$('.dk-pick').hidden = true;
    this.$('.dk-table').hidden = false;
    this.$('.dk-big').hidden = true;
    this.$('.dk-foe').textContent = f.name;
    this.msg(g.att === 'me' ? 'твой ход' : `${f.name} ходит первым`);
    this.render();
    if (g.att === 'ai') this.aiTurn();
  }

  beats(a, d) {
    const t = this.g.trump;
    if (d.s === a.s) return d.r > a.r;
    return d.s === t && a.s !== t;
  }

  ranksOnTable() { const s = new Set(); for (const p of this.g.table) { s.add(p.a.r); if (p.d) s.add(p.d.r); } return s; }
  canAdd(defHand) {
    const g = this.g, open = g.table.filter(p => !p.d).length;
    return g.table.length < 6 && open < defHand.length + 0;
  }

  msg(t) { this.$('.dk-msg').textContent = t; }

  card(c, cls = '') {
    return `<div class="card ${red(c.s) ? 'red' : ''} ${cls}" data-id="${c.id}"><span>${RANKS[c.r]}</span><b>${c.s}</b><span class="br">${RANKS[c.r]}</span></div>`;
  }

  sort(h) { const t = this.g.trump; h.sort((a, b) => ((a.s === t) - (b.s === t)) || SUITS.indexOf(a.s) - SUITS.indexOf(b.s) || a.r - b.r); }

  render() {
    const g = this.g;
    this.sort(g.me);
    this.$('.dk-ohand').innerHTML = g.ai.map(() => '<div class="card back"></div>').join('');
    this.$('.dk-hand').innerHTML = g.me.map(c => this.card(c, this.playable(c) ? 'ok' : '')).join('');
    this.$('.dk-pairs').innerHTML = g.table.map(p => `<div class="pair">${this.card(p.a)}${p.d ? this.card(p.d, 'def') : ''}</div>`).join('');
    this.$('.dk-trump').innerHTML = g.deck.length ? this.card(g.trumpCard) : `<div class="card ghost"><b>${g.trump}</b></div>`;
    this.$('.dk-pile').innerHTML = g.deck.length > 1 ? '<div class="card back"></div>' : '';
    this.$('.dk-left').textContent = g.deck.length || '';
    this.$('.dk-bito').innerHTML = g.bito ? `<div class="card back"></div><span>бито ${g.bito}</span>` : '';
    this.$('.dk-hand').querySelectorAll('.card').forEach(el => el.onclick = () => this.play(el.dataset.id));
    const myAtt = g.att === 'me';
    this.$('[data-a=pass]').disabled = !(myAtt && g.table.length && (g.table.every(p => p.d) || g.taking) && !g.busy && !g.over);
    this.$('[data-a=take]').disabled = !(!myAtt && g.table.some(p => !p.d) && !g.busy && !g.over);
  }

  playable(c) {
    const g = this.g;
    if (g.busy || g.over) return false;
    if (g.att === 'me') {
      if (!g.table.length) return true;
      if (g.taking) return this.ranksOnTable().has(c.r) && g.table.length < 6 && g.table.filter(p => !p.d).length < g.aiStart;
      return this.ranksOnTable().has(c.r) && g.table.length < 6 && g.table.filter(p => !p.d).length < g.ai.length;
    }
    return g.table.some(p => !p.d && this.beats(p.a, c));
  }

  async play(id) {
    const g = this.g;
    const i = g.me.findIndex(c => c.id === id), c = g.me[i];
    if (!c || !this.playable(c)) return;
    g.me.splice(i, 1);
    this.w.opts.sfx?.key?.();
    if (g.att === 'me') {
      if (!g.table.length) g.aiStart = g.ai.length;
      g.table.push({ a: c });
      this.render();
      if (!g.taking) await this.aiDefend();
      else this.render();
    } else {
      const p = g.table.find(p => !p.d && this.beats(p.a, c));
      p.d = c;
      this.render();
      await this.aiAdd();
    }
    this.check();
  }

  async aiDefend() {
    const g = this.g;
    g.busy = true; this.render();
    await wait(500 + Math.random() * 500);
    if (this.g !== g) return;
    for (const p of g.table.filter(p => !p.d)) {
      const opts = g.ai.filter(c => this.beats(p.a, c)).sort((a, b) => ((a.s === g.trump) - (b.s === g.trump)) || a.r - b.r);
      let pick = opts[0];
      if (pick && pick.s === g.trump && p.a.s !== g.trump && g.deck.length > 10 && pick.r > 5 && Math.random() < g.smart) pick = null;
      if (pick && Math.random() > 0.25 + g.smart) pick = opts[opts.length - 1];
      if (!pick) {
        g.taking = true;
        this.msg(`${g.f.name}: беру`);
        g.busy = false; this.render();
        await wait(300);
        this.msg('можешь подкинуть ещё, потом жми бито');
        return;
      }
      g.ai.splice(g.ai.indexOf(pick), 1);
      p.d = pick;
    }
    g.busy = false;
    this.msg(g.table.length < 6 ? 'отбился. подкидывай или бито' : 'бито?');
    this.render();
  }

  pass() {
    const g = this.g;
    if (!g || g.over) return;
    if (g.att === 'me' && g.taking) { g.ai.push(...g.table.flatMap(p => p.d ? [p.a, p.d] : [p.a])); g.table = []; g.taking = false; this.msg(`${g.f.name} забрал. снова твой ход`); this.refill('me'); this.render(); this.check(); return; }
    if (g.att !== 'me' || !g.table.every(p => p.d)) return;
    g.bito += g.table.length * 2; g.table = [];
    this.refill('me');
    g.att = 'ai';
    this.render();
    if (!this.check()) this.aiTurn();
  }

  take() {
    const g = this.g;
    if (!g || g.att === 'me' || g.over) return;
    g.taking = true;
    this.msg('беру... (он ещё подкинет)');
    this.aiAdd(true).then(() => {
      g.me.push(...g.table.flatMap(p => p.d ? [p.a, p.d] : [p.a]));
      g.table = []; g.taking = false;
      this.refill('ai');
      this.render();
      if (!this.check()) this.aiTurn();
    });
  }

  refill(first) {
    const g = this.g, order = first === 'me' ? [g.me, g.ai] : [g.ai, g.me];
    for (const h of order) while (h.length < 6 && g.deck.length) h.push(g.deck.pop());
  }

  async aiTurn() {
    const g = this.g;
    if (g.over) return;
    g.busy = true; this.render();
    await wait(700 + Math.random() * 500);
    if (this.g !== g) return;
    const nonT = g.ai.filter(c => c.s !== g.trump).sort((a, b) => a.r - b.r);
    const pick = (nonT[0] && (Math.random() < g.smart + 0.2 || !g.ai.some(c => c.s === g.trump))) ? nonT[0] : g.ai.slice().sort((a, b) => ((a.s === g.trump) - (b.s === g.trump)) || a.r - b.r)[0];
    g.ai.splice(g.ai.indexOf(pick), 1);
    g.table.push({ a: pick });
    g.meStart = g.me.length;
    g.busy = false;
    this.msg('отбивайся или бери');
    this.render();
    this.check();
  }

  async aiAdd(taking) {
    const g = this.g;
    await wait(450 + Math.random() * 400);
    if (this.g !== g) return;
    if (!taking && !g.table.every(p => p.d)) return;
    const ranks = this.ranksOnTable();
    let added = false;
    while (g.table.length < 6 && g.table.filter(p => !p.d).length < (taking ? g.meStart : g.me.length)) {
      const c = g.ai.filter(c => ranks.has(c.r) && (c.s !== g.trump || g.deck.length < 4)).sort((a, b) => a.r - b.r)[0];
      if (!c || (c.r > 6 && g.deck.length > 6 && Math.random() < g.smart)) break;
      g.ai.splice(g.ai.indexOf(c), 1);
      g.table.push({ a: c });
      added = true;
      if (!taking) break;
    }
    if (taking) return;
    if (!added) {
      g.bito += g.table.length * 2; g.table = [];
      this.refill('ai');
      g.att = 'me';
      this.msg('бито. твой ход');
      this.render();
      this.check();
      return;
    }
    this.msg('подкинул. отбивайся');
    this.render();
    this.check();
  }

  check() {
    const g = this.g;
    if (g.deck.length || g.over) return false;
    const meOut = !g.me.length;
    const aiOut = !g.ai.length;
    if (!meOut && !aiOut) return false;
    if (g.table.length && !(meOut && aiOut)) {
      if (meOut && g.att === 'me' && g.table.some(p => !p.d)) return false;
      if (aiOut && g.att === 'ai' && g.table.some(p => !p.d)) return false;
    }
    g.over = true;
    const won = meOut && !aiOut, draw = meOut && aiOut;
    const big = this.$('.dk-big');
    big.hidden = false;
    big.textContent = draw ? 'ничья' : won ? `${g.f.name} дурак` : 'ты дурак';
    const st = this.stats(), r = st[g.f.id] ||= { w: 0, l: 0 };
    if (!draw) { won ? r.w++ : r.l++; try { localStorage.setItem('dc.durak', JSON.stringify(st)); } catch {} }
    won ? this.w.opts.sfx?.ok?.() : this.w.opts.sfx?.fail?.();
    this.w.say(won ? ['дурак ты, а не я', 'изи', 'раздавай ещё'] : ['блять', 'он мухлюет', 'ещё раз']);
    this.w.opts.onEvent?.(won ? 'durak_win' : 'durak_lose', g.f.id);
    this.render();
    setTimeout(() => { if (this.g === g) this.open(); }, 3800);
    return true;
  }
}
