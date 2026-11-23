import { TIER_COLORS, WEARS, hashName, wearIndex } from '../tradeup.js';

const ODDS = [[2, 0.7992], [3, 0.1598], [4, 0.032], [5, 0.0064], [6, 0.0026]];
const RUB = 0.9;
const CASE_PRICE = 220;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const short = h => h.replace(/ \((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/, m => ' ' + WEARS.find(w => m.includes(w[0]))[1]);

export class Loot {
  constructor(w) {
    this.w = w;
    const el = this.el = document.createElement('div');
    el.className = 'loot';
    el.hidden = true;
    el.innerHTML = `<div class="lt-win win"><div class="dlg-t"><span class="lt-title"></span><button class="x" data-x>x</button></div><div class="lt-body"></div></div>
      <div class="reel" hidden><div class="reel-win"><div class="reel-strip"></div><div class="reel-mark"></div></div><div class="reel-got" hidden></div></div>`;
    w.ui.append(el);
    this.$ = s => el.querySelector(s);
    this.$('[data-x]').onclick = () => this.close();
    addEventListener('keydown', e => {
      if (e.target.closest?.('input, textarea, select')) return;
      if (e.key === 'Escape' && this.on) this.close();
      if (e.key.toLowerCase() === 'i' && w.active && !w.busy) this.inventory();
      else if (e.key.toLowerCase() === 'i' && this.on && this.mode === 'inv') this.close();
    });
  }

  get bank() { return this.w.bank; }

  data() { return this.w.opts.data?.() || {}; }

  value(item) {
    const p = this.data().prices?.[item.hash];
    let c = p && (p[3] || p[0]) ? (p[3] || Math.round(p[0] * 0.87)) : item.c || 0;
    if (!c) c = [0, 0, 8, 45, 220, 900, 18000][item.r] || 10;
    return Math.max(1, Math.round(c * RUB));
  }

  priced(item) { const p = this.data().prices?.[item.hash]; return !!(p && (p[3] || p[0])); }

  crates() {
    const { db } = this.data();
    if (!db) return [];
    if (this.cr && this.crDb === db) return this.cr;
    const m = new Map(), known = Object.keys(db.cases || {}).length;
    for (const s of db.skins) {
      if (s.r < 2 || s.r > 5) continue;
      for (const k of s.k || []) {
        if (known && !db.cases[k]) continue;
        if (!m.has(k)) m.set(k, { id: k, name: db.cases?.[k]?.[0] || k, img: db.cases?.[k]?.[1] || '', tiers: { 2: [], 3: [], 4: [], 5: [] }, gold: db.goldByCrate.get(k) || [] });
        m.get(k).tiers[s.r].push(s);
      }
    }
    const list = [...m.values()].filter(c => c.tiers[2].length && c.tiers[3].length && c.tiers[4].length && c.tiers[5].length);
    list.sort((a, b) => (b.gold.length > 0) - (a.gold.length > 0) || b.id.localeCompare(a.id, undefined, { numeric: true }));
    this.crDb = db;
    return (this.cr = list);
  }

  roll(c) {
    let x = Math.random(), tier = 2;
    for (const [t, p] of ODDS) { if (x < p) { tier = t; break; } x -= p; }
    let pool = tier === 6 ? c.gold : c.tiers[tier];
    if (!pool?.length) { tier = 5; pool = c.tiers[5]; }
    const s = pool[Math.random() * pool.length | 0];
    const f = s.min + Math.random() * (s.max - s.min);
    const wi = wearIndex(f);
    const st = s.st && Math.random() < 0.1;
    const hash = hashName(s, wi, st);
    return { hash, img: s.img, r: s.r, f: +f.toFixed(6), st, at: Date.now() };
  }

  open(kind) {
    this.on = true;
    this.mode = kind;
    this.w.busy = true;
    this.el.hidden = false;
    this.$('.lt-win').hidden = false;
    this.$('.reel').hidden = true;
    if (kind === 'vend') this.vend();
    if (kind === 'inv') this.inv();
  }

  close() {
    if (this.spinning) return;
    this.on = false;
    this.el.hidden = true;
    this.w.busy = false;
  }

  inventory() { this.open('inv'); }

  vend() {
    this.$('.lt-title').textContent = 'vending machine';
    const cr = this.crates();
    const b = this.$('.lt-body');
    if (!cr.length) { b.innerHTML = '<p class="dim">no cases yet. the scanner hasnt loaded skins, check back later</p>'; return; }
    b.innerHTML = `<p class="dim">cases are ${CASE_PRICE} ₽. same odds as cs: 79.9% blue, 16% purple, 3.2% pink, 0.64% red, 0.26% knife/gloves.</p><div class="lt-cases">` +
      cr.map((c, i) => { const img = c.img || c.tiers[5][0]?.img; return `<button class="lt-case" data-i="${i}" title="${esc(c.tiers[5].map(s => s.n).join(', '))}">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : '<div class="lt-noimg">?</div>'}<b>${esc(c.name)}</b><span>${CASE_PRICE} ₽${c.gold.length ? ' · ★' : ''}</span></button>`; }).join('') +
      `</div><div class="lt-snack"><button class="btn" data-snack>doshirak noodles · 40 ₽</button><button class="btn" data-kvass>kvass · 25 ₽</button></div>`;
    b.querySelectorAll('.lt-case').forEach(el => el.onclick = () => this.buy(cr[+el.dataset.i]));
    b.querySelector('[data-snack]').onclick = () => { if (this.bank.spend(40)) { this.close(); this.w.say(['ммм доширак', 'ужин чемпиона', 'острый блять']); this.w.av.play('Interact', true); this.w.av.onDone = () => this.w.av.play('Idle_Loop'); } else this.w.say('not enough rubles'); };
    b.querySelector('[data-kvass]').onclick = () => { if (this.bank.spend(25)) { this.close(); this.w.say(['квас топ', 'ахх', '*отрыжка*']); } else this.w.say('not enough rubles'); };
  }

  buy(c) {
    if (!this.bank.spend(CASE_PRICE)) { this.w.say('not enough rubles. go win some games'); return; }
    const won = this.roll(c);
    this.spin(c, won);
  }

  tile(it) {
    const col = it.r === 6 ? TIER_COLORS[6] : TIER_COLORS[it.r];
    return `<div class="rt" style="--c:${col}">${it.img ? `<img src="${esc(it.img)}" alt="">` : ''}<span>${esc(short(it.hash).replace('StatTrak™ ', 'ST '))}</span></div>`;
  }

  spin(c, won) {
    this.spinning = true;
    this.$('.lt-win').hidden = true;
    const rl = this.$('.reel');
    rl.hidden = false;
    this.$('.reel-got').hidden = true;
    const N = 46, W = 132, at = 38;
    const items = Array.from({ length: N }, (_, i) => i === at ? won : this.roll(c));
    const strip = this.$('.reel-strip');
    strip.innerHTML = items.map(it => this.tile(it)).join('');
    strip.style.transition = 'none';
    strip.style.transform = 'translateX(0)';
    const box = this.$('.reel-win').getBoundingClientRect();
    const off = at * W + W / 2 - box.width / 2 + (Math.random() - 0.5) * (W - 20);
    const T = 5600, t0 = performance.now();
    let last = -1;
    const ease = t => 1 - Math.pow(1 - t, 4);
    const tick = now => {
      const k = Math.min(1, (now - t0) / T), x = ease(k) * off;
      strip.style.transform = `translateX(${-x}px)`;
      const idx = Math.floor((x + box.width / 2) / W);
      if (idx !== last) { last = idx; this.w.opts.sfx?.key?.(); }
      if (k < 1) requestAnimationFrame(tick);
      else this.land(won);
    };
    requestAnimationFrame(tick);
  }

  land(won) {
    this.spinning = false;
    this.bank.s.inv.push(won);
    this.bank.save();
    const v = this.value(won);
    const g = this.$('.reel-got');
    g.hidden = false;
    g.innerHTML = `<div class="rg-name" style="color:${TIER_COLORS[won.r]}">${esc(won.hash)}</div><div class="dim">float ${won.f.toFixed(4)} · ~${v} ₽</div><div class="row"><button class="btn" data-again>open another</button><button class="btn" data-sell>sell for ${Math.round(v * 0.7)} ₽</button><button class="btn" data-keep>keep</button></div>`;
    g.querySelector('[data-again]').onclick = () => this.open('vend');
    g.querySelector('[data-keep]').onclick = () => this.close();
    g.querySelector('[data-sell]').onclick = () => { this.sell(this.bank.s.inv.length - 1, 'rub'); this.close(); };
    const great = won.r >= 5;
    if (great) { this.w.opts.sfx?.dubs?.(); this.w.say(['ЕБАТЬ', 'КРАСНЫЙ', 'мама я богат'], 3000); }
    else if (won.r >= 4) { this.w.opts.sfx?.ok?.(); this.w.say(['розовый!', 'неплохо']); }
    else this.w.say(['синька', 'опять синька блять', 'ну такое', 'мусор'][Math.random() * 4 | 0]);
    this.w.opts.onEvent?.('case', won.r);
  }

  sell(i, cur) {
    const it = this.bank.s.inv[i];
    if (!it) return;
    const v = this.value(it);
    this.bank.s.inv.splice(i, 1);
    const sf = this.w.surf, h = this.bank.s.hold ?? -1;
    if (h === i) { this.bank.s.hold = -1; if (sf) { sf.held = null; sf.gun = null; sf.card = null; sf.holdIdx = -1; } }
    else if (h > i) { this.bank.s.hold = h - 1; if (sf && sf.holdIdx > i) sf.holdIdx--; }
    if (sf && sf.lastIdx >= i) sf.lastIdx = sf.lastIdx === i ? -1 : sf.lastIdx - 1;
    if (cur === 'rub') this.bank.add(Math.round(v * 0.7));
    else this.bank.add(0, Math.max(1, Math.round(v / 9)));
  }

  inv() {
    this.$('.lt-title').textContent = 'inventory';
    const inv = this.bank.s.inv;
    const b = this.$('.lt-body');
    const tot = inv.reduce((a, it) => a + this.value(it), 0);
    b.innerHTML = `<p class="dim">${inv.length} items · worth about ${tot.toLocaleString('en-US')} ₽. ₽ button = sell to the vending machine for 70%, scrap button = sell to hazmat for scrap.</p><div class="lt-grid">` +
      (inv.length ? inv.map((it, i) => `<div class="lt-item" style="--c:${TIER_COLORS[it.r]}">${it.img ? `<img src="${esc(it.img)}" alt="" loading="lazy">` : '<div class="lt-noimg">?</div>'}<b>${esc(short(it.hash))}</b><span>${it.f.toFixed(4)} · ${this.value(it)} ₽</span><div class="row"><button class="btn${this.bank.s.hold === i ? ' on' : ''}" data-h="${i}">${this.bank.s.hold === i ? 'holding' : 'hold'}</button><button class="btn" data-r="${i}">₽</button><button class="btn" data-s="${i}">scrap</button></div></div>`).reverse().join('') : '<p class="dim">empty. the vending machine in the basement sells cases</p>') + '</div>';
    b.querySelectorAll('[data-h]').forEach(el => el.onclick = () => { const i = +el.dataset.h; this.w.surf.equip(this.bank.s.hold === i ? -1 : i); this.inv(); });
    b.querySelectorAll('[data-r]').forEach(el => el.onclick = () => { this.sell(+el.dataset.r, 'rub'); this.inv(); });
    b.querySelectorAll('[data-s]').forEach(el => el.onclick = () => { this.sell(+el.dataset.s, 'scrap'); this.inv(); });
  }
}
