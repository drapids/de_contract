import { TIER_COLORS, WEARS, hashName, wearIndex } from '../tradeup.js';
import { weaponKey } from './cs2.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const GLOVE = /Gloves|Hand Wraps|Wraps/;
const kind = s => s.r === 6 ? (GLOVE.test(s.n) ? 'gloves' : 'knives') : 'guns';
const TIERS = ['consumer', 'industrial', 'mil-spec', 'restricted', 'classified', 'covert', '★'];

export class Dev {
  constructor(w) {
    this.w = w;
    this.sel = null;
    this.f = 0.01;
    this.st = false;
    this.log = [];
    const el = this.el = document.createElement('div');
    el.className = 'devc';
    el.hidden = true;
    el.innerHTML = `<div class="win dv-win"><div class="dlg-t"><span>console</span><button class="x" data-x>x</button></div>
      <div class="dv-top"><input class="inp dv-q" placeholder="search every skin"><select class="sel dv-k"><option value="">everything</option><option value="knives">knives</option><option value="gloves">gloves</option><option value="guns">guns</option></select><select class="sel dv-r"><option value="">any rarity</option>${TIERS.map((t, i) => `<option value="${i}">${t}</option>`).join('')}</select><span class="dim dv-n"></span></div>
      <div class="dv-main"><div class="dv-list"></div><div class="dv-pick"></div></div>
      <div class="dv-out"></div><input class="inp dv-cmd" placeholder="type help"></div>`;
    w.ui.append(el);
    this.$ = s => el.querySelector(s);
    this.$('[data-x]').onclick = () => this.close();
    this.$('.dv-q').oninput = this.$('.dv-k').onchange = this.$('.dv-r').onchange = () => this.list();
    this.$('.dv-cmd').onkeydown = e => { if (e.key === 'Enter') { this.run(e.target.value); e.target.value = ''; } };
    addEventListener('keydown', e => {
      if (e.code !== 'Backquote') return;
      if (e.target.closest?.('input, textarea') && !e.target.closest('.devc')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      this.on ? this.close() : this.open();
    }, true);
    addEventListener('keydown', e => { if (this.on && e.key === 'Escape') { e.stopImmediatePropagation(); this.close(); } }, true);
  }

  skins() { return this.w.opts.data?.()?.db?.skins || []; }

  img(u) { return this.w.opts.imgProxy?.(u) || u || ''; }

  open() {
    this.on = true;
    this.el.hidden = false;
    this.wasBusy = this.w.busy;
    this.w.busy = true;
    if (this.w.surfOn) this.w.surfOn.keys.clear();
    document.exitPointerLock?.();
    this.list();
    this.pick(this.sel);
    this.out();
    setTimeout(() => this.$('.dv-q').focus(), 0);
  }

  close() {
    this.on = false;
    this.el.hidden = true;
    this.w.busy = !!this.wasBusy;
  }

  matches() {
    const q = this.$('.dv-q').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const k = this.$('.dv-k').value, r = this.$('.dv-r').value;
    return this.skins().filter(s => (!k || kind(s) === k) && (r === '' || s.r === +r) && q.every(w => s.n.toLowerCase().includes(w)));
  }

  list() {
    const all = this.matches();
    const rows = all.slice(0, 250);
    this.$('.dv-n').textContent = all.length + (all.length > rows.length ? ' (showing 250)' : '');
    const box = this.$('.dv-list');
    if (!this.skins().length) { box.innerHTML = '<p class="dim">skins havent loaded yet</p>'; return; }
    box.innerHTML = rows.map(s => `<button class="dv-row${s === this.sel ? ' on' : ''}" data-n="${esc(s.n)}" style="--c:${TIER_COLORS[s.r]}">${s.img ? `<img src="${esc(this.img(s.img))}" alt="" loading="lazy">` : '<i></i>'}<span>${esc(s.n)}</span>${weaponKey(hashName(s, 0, false)) ? '<em>3d</em>' : ''}</button>`).join('');
    box.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { this.pick(this.skins().find(s => s.n === b.dataset.n)); box.querySelectorAll('.on').forEach(x => x.classList.remove('on')); b.classList.add('on'); });
  }

  hash() { const s = this.sel; return s ? hashName(s, wearIndex(this.f), this.st && s.st) : ''; }

  pick(s) {
    const p = this.$('.dv-pick');
    this.sel = s || null;
    if (!s) { p.innerHTML = '<p class="dim">pick a skin on the left</p>'; return; }
    this.f = Math.min(s.max, Math.max(s.min, this.f));
    if (!s.st) this.st = false;
    const wears = WEARS.map((w, i) => [w, i, Math.max(w[2], s.min), Math.min(w[3], s.max)]);
    p.innerHTML = `${s.img ? `<img class="dv-big" src="${esc(this.img(s.img))}" alt="">` : ''}
      <b class="dv-name" style="color:${TIER_COLORS[s.r]}"></b>
      <div class="dim">${TIERS[s.r]} · float ${s.min.toFixed(2)} - ${s.max.toFixed(2)}</div>
      ${s.vanilla ? '' : `<div class="dv-wears">${wears.map(([w, i, lo, hi]) => `<button class="btn" data-w="${i}" ${lo >= hi ? 'disabled' : ''}>${w[1]}</button>`).join('')}</div>
      <div class="dv-fl"><input type="range" min="${s.min}" max="${s.max}" step="0.0001" class="dv-fr"><input class="inp dv-fn" type="number" step="0.0001" min="${s.min}" max="${s.max}"></div>`}
      ${s.st ? '<label class="chk"><input type="checkbox" class="dv-st"> stattrak</label>' : ''}
      <div class="row"><button class="btn" data-add>add to inventory</button><button class="btn" data-hold>add + hold it</button></div>`;
    const sync = () => {
      p.querySelector('.dv-name').textContent = this.hash();
      const fr = p.querySelector('.dv-fr'), fn = p.querySelector('.dv-fn');
      if (fr) fr.value = this.f;
      if (fn && document.activeElement !== fn) fn.value = this.f.toFixed(4);
      p.querySelectorAll('[data-w]').forEach(b => b.classList.toggle('on', +b.dataset.w === wearIndex(this.f)));
    };
    p.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { const [, , lo, hi] = wears[+b.dataset.w]; this.f = +(lo + (hi - lo) * 0.02).toFixed(4); sync(); });
    const fr = p.querySelector('.dv-fr'), fn = p.querySelector('.dv-fn');
    if (fr) fr.oninput = () => { this.f = +fr.value; sync(); };
    if (fn) fn.oninput = () => { const v = parseFloat(fn.value); if (v >= 0 && v <= 1) { this.f = Math.min(s.max, Math.max(s.min, v)); sync(); } };
    const st = p.querySelector('.dv-st');
    if (st) { st.checked = this.st; st.onchange = () => { this.st = st.checked; sync(); }; }
    p.querySelector('[data-add]').onclick = () => this.give(s, this.f, this.st, false);
    p.querySelector('[data-hold]').onclick = () => this.give(s, this.f, this.st, true);
    sync();
  }

  give(s, f, st, hold) {
    const bank = this.w.bank;
    f = Math.min(s.max, Math.max(s.min, f));
    const it = { hash: hashName(s, wearIndex(f), st && s.st), img: s.img, r: s.r, f: +f.toFixed(6), st: !!(st && s.st), at: Date.now() };
    bank.s.inv.push(it);
    bank.save();
    if (hold) this.w.surf.equip(bank.s.inv.length - 1);
    this.out(`added ${it.hash} · ${it.f.toFixed(4)}${hold ? ' (holding it)' : ''}`);
    return it;
  }

  out(line) {
    if (line) this.log.push(line);
    this.log = this.log.slice(-60);
    const o = this.$('.dv-out');
    o.innerHTML = this.log.map(l => `<div>${esc(l)}</div>`).join('');
    o.scrollTop = 1e9;
  }

  find(q) {
    const w = q.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = this.skins().filter(s => w.every(x => s.n.toLowerCase().includes(x)));
    return hits.sort((a, b) => a.n.length - b.n.length)[0];
  }

  run(line) {
    const [cmd, ...rest] = line.trim().split(/\s+/);
    if (!cmd) return;
    this.out('> ' + line.trim());
    const bank = this.w.bank, c = cmd.toLowerCase();
    const num = () => parseFloat(rest[0]);
    let args = rest.join(' '), fl = null, st = false;
    if (/\bst\b|stattrak/i.test(args)) { st = true; args = args.replace(/\bst\b|stattrak/ig, ' ').trim(); }
    const m = args.match(/(?:^|\s)([01]?\.\d+|0|1)$/);
    if (m) { fl = parseFloat(m[1]); args = args.slice(0, m.index).trim(); }
    if (c === 'help') return this.out('give <skin> [float] [st] · hold <skin> [float] · rub <n> · scrap <n> · xp <n> · clear · inv');
    if (c === 'give' || c === 'hold') {
      const s = this.find(args);
      if (!s) return this.out('no skin like that');
      const f = fl ?? (this.sel === s ? this.f : s.min + Math.min(0.01, (s.max - s.min) / 2));
      this.give(s, f, st, c === 'hold');
      return;
    }
    if (c === 'rub' || c === 'scrap' || c === 'xp') {
      const v = num();
      if (!isFinite(v)) return this.out('need a number');
      bank.s[c] = Math.max(0, Math.round(v));
      bank.save();
      return this.out(`${c} = ${bank.s[c]}`);
    }
    if (c === 'clear') { bank.s.inv = []; bank.s.hold = -1; bank.save(); this.w.surf.equip(-1); return this.out('inventory cleared'); }
    if (c === 'inv') { bank.s.inv.forEach((it, i) => this.out(`${i}: ${it.hash} · ${(it.f ?? 0).toFixed(4)}${bank.s.hold === i ? ' (holding)' : ''}`)); if (!bank.s.inv.length) this.out('empty'); return; }
    this.out('dont know that one, type help');
  }
}
