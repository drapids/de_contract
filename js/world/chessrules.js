const N = [17, 15, 10, 6, -6, -10, -15, -17];
const KD = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const ND = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const VAL = { p: 100, n: 310, b: 330, r: 500, q: 900, k: 0 };

export const isW = p => p && p === p.toUpperCase();
export const sq = (f, r) => r * 8 + f;
export const name = s => 'abcdefgh'[s % 8] + (Math.floor(s / 8) + 1);

export function start() {
  const b = Array(64).fill('');
  const back = 'rnbqkbnr';
  for (let f = 0; f < 8; f++) { b[f] = back[f].toUpperCase(); b[8 + f] = 'P'; b[48 + f] = 'p'; b[56 + f] = back[f]; }
  return { b, turn: 'w', castle: { K: 1, Q: 1, k: 1, q: 1 }, ep: -1, half: 0, full: 1, hist: [] };
}

export function clone(s) { return { b: s.b.slice(), turn: s.turn, castle: { ...s.castle }, ep: s.ep, half: s.half, full: s.full, hist: s.hist }; }

function own(p, w) { return p && isW(p) === w; }

export function attacked(b, s, byW) {
  const f = s % 8, r = s >> 3;
  const pr = byW ? r - 1 : r + 1, P = byW ? 'P' : 'p';
  if (pr >= 0 && pr < 8) for (const df of [-1, 1]) { const ff = f + df; if (ff >= 0 && ff < 8 && b[sq(ff, pr)] === P) return true; }
  for (const [a, c] of ND) { const ff = f + a, rr = r + c; if (ff >= 0 && ff < 8 && rr >= 0 && rr < 8 && b[sq(ff, rr)] === (byW ? 'N' : 'n')) return true; }
  for (const [a, c] of KD) { const ff = f + a, rr = r + c; if (ff >= 0 && ff < 8 && rr >= 0 && rr < 8 && b[sq(ff, rr)] === (byW ? 'K' : 'k')) return true; }
  for (const [a, c] of KD) {
    let ff = f + a, rr = r + c;
    const diag = a && c;
    while (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) {
      const p = b[sq(ff, rr)];
      if (p) {
        if (isW(p) === byW) { const t = p.toLowerCase(); if (t === 'q' || (diag ? t === 'b' : t === 'r')) return true; }
        break;
      }
      ff += a; rr += c;
    }
  }
  return false;
}

export function inCheck(s, w = s.turn === 'w') {
  const k = s.b.indexOf(w ? 'K' : 'k');
  return k >= 0 && attacked(s.b, k, !w);
}

function pseudo(s) {
  const b = s.b, w = s.turn === 'w', out = [];
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!own(p, w)) continue;
    const t = p.toLowerCase(), f = i % 8, r = i >> 3;
    const add = (to, extra = {}) => out.push({ from: i, to, p, cap: b[to], ...extra });
    if (t === 'p') {
      const d = w ? 1 : -1, r2 = r + d, last = w ? 7 : 0;
      const push = (to, x) => { if (r2 === last) for (const pr of 'qrbn') add(to, { ...x, promo: w ? pr.toUpperCase() : pr }); else add(to, x); };
      if (r2 >= 0 && r2 < 8 && !b[sq(f, r2)]) {
        push(sq(f, r2));
        const r3 = r + 2 * d;
        if ((w ? r === 1 : r === 6) && !b[sq(f, r3)]) add(sq(f, r3), { dbl: 1 });
      }
      for (const df of [-1, 1]) {
        const ff = f + df; if (ff < 0 || ff > 7 || r2 < 0 || r2 > 7) continue;
        const to = sq(ff, r2);
        if (b[to] && !own(b[to], w)) push(to);
        else if (to === s.ep) add(to, { epc: sq(ff, r), cap: b[sq(ff, r)] });
      }
    } else if (t === 'n' || t === 'k') {
      for (const [a, c] of t === 'n' ? ND : KD) { const ff = f + a, rr = r + c; if (ff >= 0 && ff < 8 && rr >= 0 && rr < 8 && !own(b[sq(ff, rr)], w)) add(sq(ff, rr)); }
      if (t === 'k') {
        const home = w ? 4 : 60;
        if (i === home && !attacked(b, i, !w)) {
          const C = s.castle;
          if ((w ? C.K : C.k) && !b[home + 1] && !b[home + 2] && b[home + 3] === (w ? 'R' : 'r') && !attacked(b, home + 1, !w) && !attacked(b, home + 2, !w)) add(home + 2, { castle: 'k' });
          if ((w ? C.Q : C.q) && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === (w ? 'R' : 'r') && !attacked(b, home - 1, !w) && !attacked(b, home - 2, !w)) add(home - 2, { castle: 'q' });
        }
      }
    } else {
      const dirs = t === 'b' ? KD.slice(4) : t === 'r' ? KD.slice(0, 4) : KD;
      for (const [a, c] of dirs) {
        let ff = f + a, rr = r + c;
        while (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) {
          const to = sq(ff, rr);
          if (own(b[to], w)) break;
          add(to);
          if (b[to]) break;
          ff += a; rr += c;
        }
      }
    }
  }
  return out;
}

export function make(s, m) {
  const n = clone(s), b = n.b, w = s.turn === 'w';
  b[m.to] = m.promo || m.p; b[m.from] = '';
  if (m.epc != null) b[m.epc] = '';
  if (m.castle) {
    const home = w ? 4 : 60;
    if (m.castle === 'k') { b[home + 1] = b[home + 3]; b[home + 3] = ''; } else { b[home - 1] = b[home - 4]; b[home - 4] = ''; }
  }
  const t = m.p.toLowerCase();
  if (t === 'k') { if (w) n.castle.K = n.castle.Q = 0; else n.castle.k = n.castle.q = 0; }
  for (const [sqr, k] of [[0, 'Q'], [7, 'K'], [56, 'q'], [63, 'k']]) if (m.from === sqr || m.to === sqr) n.castle[k] = 0;
  n.ep = m.dbl ? (m.from + m.to) / 2 : -1;
  n.half = t === 'p' || m.cap ? 0 : s.half + 1;
  if (!w) n.full++;
  n.turn = w ? 'b' : 'w';
  return n;
}

export function moves(s) {
  const w = s.turn === 'w';
  return pseudo(s).filter(m => !inCheck(make(s, m), w));
}

export function status(s) {
  const ms = moves(s);
  if (!ms.length) return inCheck(s) ? 'mate' : 'stalemate';
  if (s.half >= 100) return 'fifty';
  const left = s.b.filter(p => p && p.toLowerCase() !== 'k');
  if (!left.length || (left.length === 1 && 'nbNB'.includes(left[0]))) return 'material';
  return null;
}

export function fen(s) {
  let out = '';
  for (let r = 7; r >= 0; r--) {
    let e = 0;
    for (let f = 0; f < 8; f++) { const p = s.b[sq(f, r)]; if (!p) e++; else { if (e) out += e; e = 0; out += p; } }
    if (e) out += e;
    if (r) out += '/';
  }
  const c = Object.entries(s.castle).filter(([, v]) => v).map(([k]) => k).join('') || '-';
  return `${out} ${s.turn} ${c} ${s.ep >= 0 ? name(s.ep) : '-'} ${s.half} ${s.full}`;
}

export function uci(m) { return name(m.from) + name(m.to) + (m.promo ? m.promo.toLowerCase() : ''); }
export function fromUci(s, u) { return moves(s).find(m => uci(m) === u) || moves(s).find(m => uci(m).slice(0, 4) === u.slice(0, 4)); }

export function san(s, m) {
  const t = m.p.toLowerCase();
  if (m.castle) return m.castle === 'k' ? 'O-O' : 'O-O-O';
  let o = t === 'p' ? (m.cap ? name(m.from)[0] : '') : m.p.toUpperCase();
  if (t !== 'p') {
    const twins = moves(s).filter(x => x.p === m.p && x.to === m.to && x.from !== m.from);
    if (twins.length) o += twins.some(x => x.from % 8 === m.from % 8) ? name(m.from)[1] : name(m.from)[0];
  }
  if (m.cap) o += 'x';
  o += name(m.to);
  if (m.promo) o += '=' + m.promo.toUpperCase();
  const n = make(s, m);
  if (inCheck(n)) o += status(n) === 'mate' ? '#' : '+';
  return o;
}

const PST = {
  p: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, -20, -20, 10, 10, 5, 5, -5, -10, 0, 0, -10, -5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, 5, 10, 25, 25, 10, 5, 5, 10, 10, 20, 30, 30, 20, 10, 10, 50, 50, 50, 50, 50, 50, 50, 50, 0, 0, 0, 0, 0, 0, 0, 0],
  n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 5, 5, 0, -20, -40, -30, 5, 10, 15, 15, 10, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 10, 15, 15, 10, 0, -30, -40, -20, 0, 0, 0, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 5, 0, 0, 0, 0, 5, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 0, 0, 0, 0, 0, 0, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  r: [0, 0, 0, 5, 5, 0, 0, 0, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 5, 10, 10, 10, 10, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  q: Array(64).fill(0),
  k: [20, 30, 10, 0, 0, 10, 30, 20, 20, 20, 0, 0, 0, 0, 20, 20, -10, -20, -20, -20, -20, -20, -20, -10, -20, -30, -30, -40, -40, -30, -30, -20, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30]
};

function evaluate(s) {
  let v = 0;
  for (let i = 0; i < 64; i++) {
    const p = s.b[i]; if (!p) continue;
    const t = p.toLowerCase(), w = isW(p);
    const ps = PST[t][w ? i : (7 - (i >> 3)) * 8 + (i % 8)];
    v += (w ? 1 : -1) * (VAL[t] + ps);
  }
  return s.turn === 'w' ? v : -v;
}

function order(ms) { return ms.sort((a, b) => (b.cap ? VAL[b.cap.toLowerCase()] * 10 - VAL[b.p.toLowerCase()] : 0) + (b.promo ? 800 : 0) - ((a.cap ? VAL[a.cap.toLowerCase()] * 10 - VAL[a.p.toLowerCase()] : 0) + (a.promo ? 800 : 0))); }

function quiesce(s, a, bt, d) {
  const sp = evaluate(s);
  if (sp >= bt) return bt;
  if (sp > a) a = sp;
  if (d <= 0) return a;
  for (const m of order(moves(s).filter(m => m.cap || m.promo))) {
    const v = -quiesce(make(s, m), -bt, -a, d - 1);
    if (v >= bt) return bt;
    if (v > a) a = v;
  }
  return a;
}

function negamax(s, d, a, bt, ctx) {
  if (ctx.n++ > ctx.max) return evaluate(s);
  const ms = moves(s);
  if (!ms.length) return inCheck(s) ? -100000 - d : 0;
  if (d === 0) return quiesce(s, a, bt, 3);
  for (const m of order(ms)) {
    const v = -negamax(make(s, m), d - 1, -bt, -a, ctx);
    if (v >= bt) return bt;
    if (v > a) a = v;
  }
  return a;
}

export function think(s, depth, noise = 0) {
  const ms = order(moves(s));
  if (!ms.length) return null;
  let best = null, bv = -Infinity;
  const ctx = { n: 0, max: 60000 };
  for (const m of ms) {
    const v = -negamax(make(s, m), depth - 1, -Infinity, Infinity, ctx) + (Math.random() - 0.5) * noise;
    if (v > bv) { bv = v; best = m; }
  }
  return best;
}

export function levelFor(elo) {
  if (elo < 600) return { depth: 1, blunder: 0.4, noise: 300, skill: 0 };
  if (elo < 1000) return { depth: 2, blunder: 0.2, noise: 120, skill: 0 };
  if (elo < 1500) return { depth: 2, blunder: 0.07, noise: 40, skill: 3 };
  if (elo < 2100) return { depth: 3, blunder: 0.02, noise: 10, skill: 10 };
  return { depth: 3, blunder: 0, noise: 0, skill: 20 };
}

export class Fish {
  constructor() {
    this.ok = false;
    try {
      const src = `importScripts('https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js');`;
      this.w = new Worker(URL.createObjectURL(new Blob([src], { type: 'application/javascript' })));
      this.w.onmessage = e => this.on(String(e.data));
      this.w.onerror = () => { this.ok = false; };
      this.w.postMessage('uci');
    } catch (e) { this.w = null; }
    this.cb = null;
  }
  on(line) {
    if (line === 'uciok') { this.ok = true; this.w.postMessage('isready'); }
    if (line.startsWith('bestmove') && this.cb) { const f = this.cb; this.cb = null; f(line.split(' ')[1]); }
  }
  go(fenStr, skill, ms) {
    return new Promise((res) => {
      if (!this.ok) return res(null);
      const t = setTimeout(() => { this.cb = null; res(null); }, ms + 4000);
      this.cb = m => { clearTimeout(t); res(m); };
      this.w.postMessage('setoption name Skill Level value ' + skill);
      this.w.postMessage('position fen ' + fenStr);
      this.w.postMessage('go movetime ' + ms);
    });
  }
}
