import { TIER_COLORS, WEARS, hashName, usd } from './tradeup.js';

const ODDS = [[2, 0.7992], [3, 0.1598], [4, 0.032], [5, 0.0064], [6, 0.0026]];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = s => document.querySelector(s);

export function lifeOf(hollow) {
  const l = (hollow || []).filter(h => h.born && h.died && h.died > h.born).map(h => h.died - h.born).sort((a, b) => a - b);
  if (l.length < 3) return 0;
  return l[l.length >> 1];
}

function sell(prices, h) {
  const p = prices[h];
  if (!p) return null;
  return p[3] || Math.round(p[0] * 0.87);
}

function outcomesOf(s, prices) {
  const out = [];
  const span = s.max - s.min || 1;
  WEARS.forEach((w, wi) => {
    const lo = Math.max(w[2], s.min), hi = Math.min(w[3], s.max);
    if (hi <= lo && !(s.max === s.min && wi === 0)) return;
    const pw = s.max === s.min ? 1 : (hi - lo) / span;
    for (const st of s.st ? [false, true] : [false]) {
      const v = sell(prices, hashName(s, wi, st));
      if (v == null) continue;
      out.push({ p: pw * (s.st ? (st ? 0.1 : 0.9) : 1), v });
    }
  });
  const tot = out.reduce((a, o) => a + o.p, 0);
  return tot ? out.map(o => ({ p: o.p / tot, v: o.v })) : [];
}

export function caseEv(S) {
  const db = S.db, prices = S.prices || {};
  if (!db) return [];
  const m = new Map();
  for (const s of db.skins) {
    if (s.r < 2 || s.r > 5) continue;
    for (const k of s.k || []) {
      if (!m.has(k)) m.set(k, { name: k, tiers: { 2: [], 3: [], 4: [], 5: [], 6: db.goldByCrate.get(k) || [] } });
      m.get(k).tiers[s.r].push(s);
    }
  }
  const cost = Math.round(((parseFloat($('#ev-key')?.value) || 0) + (parseFloat($('#ev-case')?.value) || 0)) * 100);
  const rows = [];
  for (const c of m.values()) {
    if (!c.tiers[2].length || !c.tiers[5].length) continue;
    let ev = 0, win = 0, cov = 0, best = null;
    const odds = c.tiers[6].length ? ODDS : [[2, 0.7992], [3, 0.1598], [4, 0.032], [5, 0.0064 + 0.0026]];
    for (const [t, p] of odds) {
      const pool = c.tiers[t];
      if (!pool.length) continue;
      let tv = 0, tw = 0, n = 0;
      for (const s of pool) {
        const o = outcomesOf(s, prices);
        if (!o.length) continue;
        n++;
        for (const x of o) { tv += x.p * x.v; if (x.v > cost) tw += x.p; if (!best || x.v > best.v) best = { v: x.v, s }; }
      }
      if (!n) continue;
      cov += p;
      ev += p * tv / n;
      win += p * tw / n;
    }
    if (cov < 0.5) continue;
    ev /= cov; win /= cov;
    rows.push({ name: c.name, ev, win, best, cov, img: c.tiers[5][0]?.img });
  }
  rows.sort((a, b) => b.ev - a.ev);
  return { rows, cost };
}

export function renderEv(S) {
  const el = $('#ev-out');
  if (!el) return;
  const r = caseEv(S);
  if (!r.rows?.length) { el.innerHTML = '<p class="dim">no case data yet</p>'; return; }
  el.classList.remove('dim');
  el.innerHTML = `<table class="t ev-t"><tr><th></th><th>case</th><th class="n">avg you get</th><th class="n">vs key+case</th><th class="n">chance to profit</th><th>best pull</th></tr>` +
    r.rows.map(x => `<tr><td>${x.img ? `<img src="${esc(x.img)}" alt="">` : ''}</td><td>${esc(x.name)}${x.cov < 0.95 ? ' <small class="dim">(some prices missing)</small>' : ''}</td><td class="n">${usd(Math.round(x.ev))}</td><td class="n ${x.ev >= r.cost ? 'pos' : 'neg'}">${x.ev >= r.cost ? '+' : ''}${usd(Math.round(x.ev - r.cost))}</td><td class="n">${(x.win * 100).toFixed(1)}%</td><td>${x.best ? `<span style="color:${TIER_COLORS[x.best.s.r]}">${esc(x.best.s.n)}</span> <small class="dim">${usd(x.best.v)}</small>` : ''}</td></tr>`).join('') + '</table>';
}

export function renderAlerts(S, store) {
  const el = $('#al-out');
  if (!el) return;
  const al = store.get('alerts', []);
  if (!al.length) { el.innerHTML = '<p class="dim">no alerts yet</p>'; return; }
  const img = h => { const n = h.replace(/^StatTrak™ /, '').replace(/ \((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/, ''); return S.db?.byName.get(n)?.img || ''; };
  el.innerHTML = al.map(a => {
    const p = S.prices?.[a.h], now = p ? p[0] : 0, hit = now && now <= a.c;
    return `<div class="alert-row ${hit ? 'hit' : ''}">${img(a.h) ? `<img src="${esc(img(a.h))}" alt="">` : ''}<b>${esc(a.h)}</b><span>want ${usd(a.c)}</span><span class="${hit ? 'ok' : 'dim'}">now ${now ? usd(now) : '?'}</span><a href="https://steamcommunity.com/market/listings/730/${encodeURIComponent(a.h)}" target="_blank" rel="noopener">market</a><button class="btn" data-del="${esc(a.h)}">x</button></div>`;
  }).join('');
}

export function checkAlerts(S, store, { guy, sfx }) {
  const al = store.get('alerts', []);
  let changed = false;
  for (const a of al) {
    const p = S.prices?.[a.h];
    if (!p || !p[0] || p[0] > a.c) { if (a.fired) { a.fired = 0; changed = true; } continue; }
    if (a.fired === p[0]) continue;
    a.fired = p[0]; changed = true;
    const msg = `${a.h} is ${usd(p[0])} (you wanted ${usd(a.c)})`;
    try { if (Notification?.permission === 'granted') new Notification('de_contract price alert', { body: msg, icon: 'assets/icon.png' }); } catch (e) {}
    sfx?.dubs?.();
    if (guy) { guy.setDubs?.('price hit'); guy.set?.('dubs', 3000); guy.say?.(msg, 4000); }
  }
  if (changed) store.set('alerts', al);
}
