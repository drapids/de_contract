export const RANKS = ['Silver I', 'Silver II', 'Silver III', 'Silver IV', 'Silver Elite', 'Silver Elite Master', 'Gold Nova I', 'Gold Nova II', 'Gold Nova III', 'Gold Nova Master', 'Master Guardian I', 'Master Guardian II', 'Master Guardian Elite', 'Distinguished Master Guardian', 'Legendary Eagle', 'Legendary Eagle Master', 'Supreme Master First Class', 'The Global Elite'];
export const RANK_XP = RANKS.map((_, i) => Math.round(60 * Math.pow(i, 1.6)));
const DAY = 24 * 3600 * 1000;

const REWARD = {
  arm: { quandale: 60, pork: 90, haggord: 130, hazmat: 180, enemy: 250 },
  durak: { quandale: 80, pork: 120, haggord: 170, hazmat: 230, enemy: 300 }
};

export class Bank {
  constructor(w) {
    this.w = w;
    this.s = this.load();
    const el = this.el = document.createElement('div');
    el.className = 'bank';
    el.innerHTML = `<div class="bk-row"><span class="bk-rub"></span><span class="bk-scrap"></span><button class="bk-inv" title="инвентарь (i)">инвентарь</button><button class="bk-inv bk-book" title="блятлинго (b)">блятлинго</button></div><div class="bk-rank"></div><div class="bk-drop"><i></i><span></span></div>`;
    w.ui.append(el);
    this.$ = s => el.querySelector(s);
    this.$('.bk-inv').onclick = () => !w.busy && w.loot?.inventory();
    this.$('.bk-book').onclick = () => !w.busy && w.blyat?.open();
    this.render();
    setInterval(() => this.render(), 30000);
  }

  load() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem('dc.bank')) || {}; } catch {}
    return { rub: 300, scrap: 25, xp: 0, inv: [], drop: Date.now() - DAY * 0.6, ...s };
  }

  save() { try { localStorage.setItem('dc.bank', JSON.stringify(this.s)); } catch {} this.render(); }

  rank(xp = this.s.xp) { let r = 0; while (r < RANKS.length - 1 && xp >= RANK_XP[r + 1]) r++; return r; }

  add(rub = 0, scrap = 0, xp = 0) {
    const before = this.rank();
    this.s.rub = Math.max(0, Math.round(this.s.rub + rub));
    this.s.scrap = Math.max(0, Math.round(this.s.scrap + scrap));
    this.s.xp += xp;
    this.save();
    if (rub || scrap) this.pop((rub ? (rub > 0 ? '+' : '') + rub + ' ₽ ' : '') + (scrap ? (scrap > 0 ? '+' : '') + scrap + ' scrap' : ''));
    const after = this.rank();
    if (after > before) setTimeout(() => { this.w.say('новое звание: ' + RANKS[after], 3500); this.w.opts.sfx?.dubs?.(); }, 900);
  }

  spend(rub = 0, scrap = 0) {
    if (this.s.rub < rub || this.s.scrap < scrap) return false;
    this.add(-rub, -scrap);
    return true;
  }

  reward(game, foe, res) {
    let rub = 0, xp = res === 'w' ? 30 : res === 'd' ? 15 : 8;
    if (res === 'w') rub = game === 'chess' ? Math.round((this.w.chess.g?.f.elo || 800) / 4) : REWARD[game]?.[foe] || 80;
    if (res === 'd') rub = game === 'chess' ? Math.round((this.w.chess.g?.f.elo || 800) / 8) : 0;
    if (rub || xp) this.add(rub, 0, xp);
  }

  dropReady() { return Date.now() - this.s.drop >= DAY; }
  claimDrop() { this.s.drop = Date.now(); this.save(); }

  pop(t) {
    const p = document.createElement('div');
    p.className = 'bk-pop';
    p.textContent = t;
    this.el.append(p);
    setTimeout(() => p.remove(), 1600);
  }

  render() {
    const s = this.s, r = this.rank();
    this.$('.bk-rub').textContent = s.rub.toLocaleString('ru-RU') + ' ₽';
    this.$('.bk-scrap').textContent = s.scrap + ' scrap';
    const nx = RANK_XP[r + 1];
    this.$('.bk-rank').innerHTML = `<b>${RANKS[r]}</b>${nx ? ` <span>${s.xp}/${nx} xp</span>` : ''}`;
    const k = Math.min(1, (Date.now() - s.drop) / DAY);
    this.$('.bk-drop i').style.width = (k * 100) + '%';
    const left = DAY - (Date.now() - s.drop);
    this.$('.bk-drop span').textContent = k >= 1 ? 'аирдроп во дворе!' : 'аирдроп через ' + Math.floor(left / 3600000) + 'ч ' + Math.floor(left / 60000 % 60) + 'м';
    this.el.classList.toggle('ready', k >= 1);
  }
}
