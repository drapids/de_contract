export const TIERS = ['Consumer', 'Industrial', 'Mil-Spec', 'Restricted', 'Classified', 'Covert', 'Gold'];
export const TIER_COLORS = ['#b0c3d9', '#5e98d9', '#4b69ff', '#8847ff', '#d32ce6', '#eb4b4b', '#e4ae39'];
export const WEARS = [
  ['Factory New', 'FN', 0, 0.07],
  ['Minimal Wear', 'MW', 0.07, 0.15],
  ['Field-Tested', 'FT', 0.15, 0.38],
  ['Well-Worn', 'WW', 0.38, 0.45],
  ['Battle-Scarred', 'BS', 0.45, 1]
];

export const FEES = { steam: null, skinport: 0.08, csfloat: 0.02 };

export function wearIndex(f) {
  for (let i = 0; i < WEARS.length; i++) if (f < WEARS[i][3]) return i;
  return 4;
}

export function wearsFor(skin) {
  const out = [];
  WEARS.forEach((w, i) => { if (skin.max > w[2] && skin.min < w[3]) out.push(i); });
  return out;
}

export function wearSpan(skin, wi) {
  const w = WEARS[wi];
  return [Math.max(w[2], skin.min), Math.min(w[3], skin.max)];
}

export function steamNet(cents) {
  cents = Math.round(cents);
  let lo = 0, hi = cents;
  const paid = r => r + Math.max(1, Math.floor(r * 0.05)) + Math.max(1, Math.floor(r * 0.1));
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (paid(m) <= cents) lo = m; else hi = m - 1; }
  return lo;
}

export function netAfterFee(market, cents) {
  if (market === 'steam') return steamNet(cents);
  return Math.floor(cents * (1 - (FEES[market] ?? 0.1)));
}

export function hashName(skin, wi, st) {
  const star = skin.r === 6;
  let base = skin.n;
  if (st) base = star ? base.replace('★ ', '★ StatTrak™ ') : 'StatTrak™ ' + base;
  if (skin.vanilla) return base;
  return `${base} (${WEARS[wi][0]})`;
}

export function normFloat(skin, f) {
  return skin.max > skin.min ? (f - skin.min) / (skin.max - skin.min) : 0;
}

export function outFloat(avg, skin) {
  return skin.min + avg * (skin.max - skin.min);
}

export class Db {
  constructor(data) {
    this.skins = data.skins;
    this.collections = data.collections || {};
    this.byName = new Map(this.skins.map(s => [s.n, s]));
    this.byColTier = new Map();
    this.goldByCrate = new Map();
    this.goldByCol = new Map();
    for (const s of this.skins) {
      if (s.r === 6) {
        for (const k of s.k || []) this.push(this.goldByCrate, k, s);
        if (s.c) this.push(this.goldByCol, s.c, s);
      } else if (s.c) this.push(this.byColTier, s.c + '|' + s.r, s);
    }
  }
  push(m, k, v) { if (!m.has(k)) m.set(k, []); m.get(k).push(v); }
  pool(skin, st) {
    if (skin.r === 5) {
      let p = [];
      for (const k of skin.k || []) if (this.goldByCrate.has(k)) { p = this.goldByCrate.get(k); break; }
      if (!p.length && skin.c) p = this.goldByCol.get(skin.c) || [];
      return st ? p.filter(g => g.st) : p;
    }
    const p = this.byColTier.get(skin.c + '|' + (skin.r + 1)) || [];
    return st ? p.filter(g => g.st) : p;
  }
  inputsAt(col, tier) { return this.byColTier.get(col + '|' + tier) || []; }
}

export function contractSize(tier) { return tier === 5 ? 5 : 10; }

export function outcomes(db, inputs, st) {
  const n = inputs.length;
  let avg = 0;
  for (const i of inputs) avg += normFloat(i.skin, i.float);
  avg /= n;
  const map = new Map();
  for (const i of inputs) {
    const pool = db.pool(i.skin, st);
    if (!pool.length) return null;
    for (const o of pool) {
      const cur = map.get(o.n) || { skin: o, p: 0 };
      cur.p += 1 / n / pool.length;
      map.set(o.n, cur);
    }
  }
  return [...map.values()].map(o => {
    const f = o.skin.vanilla ? 0 : outFloat(avg, o.skin);
    const wi = wearIndex(f);
    return { ...o, float: f, wi, hash: hashName(o.skin, wi, st) };
  }).sort((a, b) => b.p - a.p);
}

export function evaluate(db, inputs, st, price) {
  const outs = outcomes(db, inputs, st);
  if (!outs) return null;
  let cost = 0;
  for (const i of inputs) {
    const p = price.buy(i.hash);
    if (!p) return null;
    cost += p.cents;
  }
  let ev = 0, win = 0, worst = Infinity, best = 0, unknown = 0;
  for (const o of outs) {
    const s = price.sell(o.hash);
    o.sell = s;
    if (!s) { unknown += o.p; worst = 0; continue; }
    ev += o.p * s.net;
    if (s.net > cost) win += o.p;
    worst = Math.min(worst, s.net);
    best = Math.max(best, s.net);
  }
  const guaranteed = unknown === 0 && worst > cost;
  return { inputs, outs, st, cost, ev, roi: cost ? (ev - cost) / cost : 0, win, worst, best, unknown, guaranteed };
}

export function parseHash(h) {
  const st = h.includes('StatTrak™');
  let n = h.replace('StatTrak™ ', '');
  const m = n.match(/^(.*) \((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/);
  const wi = m ? WEARS.findIndex(w => w[0] === m[2]) : -1;
  if (m) n = m[1];
  return { name: n, st, wi };
}

export function usd(c) { return (c < 0 ? '-$' : '$') + (Math.abs(c) / 100).toFixed(2); }
