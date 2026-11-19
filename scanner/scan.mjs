import { mkdir, writeFile } from 'node:fs/promises';
import { Db, wearsFor, wearSpan, hashName, normFloat, outFloat, wearIndex, netAfterFee, contractSize, TIERS, WEARS } from '../js/tradeup.js';
import { loadSkins, skinportPrices, steamPages, discord, previous } from './sources.mjs';

const OUT = process.env.OUT || 'dist/data';
const SITE = process.env.SITE_URL || '';
const HOOK = process.env.DISCORD_WEBHOOK || '';
const STEAM_PAGES = +(process.env.STEAM_PAGES || 30);
const TOP = 400;

const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

const prevState = await previous(SITE && `${SITE}/data/state.json`);
const prevTrades = await previous(SITE && `${SITE}/data/tradeups.json`);

const meta = await loadSkins();
const db = new Db(meta);
log('skins', meta.skins.length);

let skinport = {}, sources = {};
try { skinport = await skinportPrices(); sources.skinport = Object.keys(skinport).length; }
catch (e) { sources.skinport = 'error: ' + e.message; }
log('skinport', sources.skinport);

const steamCache = prevState?.steam || {};
const steamAge = prevState?.steamAge || {};
const sp = await steamPages(prevState?.steamNext || 0, STEAM_PAGES);
const now = Date.now();
for (const [k, v] of Object.entries(sp.prices)) { steamCache[k] = [v.c, v.q]; steamAge[k] = now; }
for (const k of Object.keys(steamAge)) if (now - steamAge[k] > 3 * 3600e3) { delete steamAge[k]; delete steamCache[k]; }
sources.steam = Object.keys(steamCache).length;
sources.steamFresh = Object.keys(sp.prices).length;
const rateLimited = sp.rate;
log('steam', sources.steamFresh, 'fresh,', sources.steam, 'cached', rateLimited ? '(rate limited)' : '');

const price = new Map();
const add = (h, market, c, q) => {
  if (!c) return;
  const cur = price.get(h) || { buy: null, sell: null };
  if (q > 0 && (!cur.buy || c < cur.buy.cents)) cur.buy = { cents: c, market, q };
  const net = netAfterFee(market, Math.max(1, c - 1));
  if (!cur.sell || net > cur.sell.net) cur.sell = { net, market, ask: c };
  price.set(h, cur);
};
for (const [h, v] of Object.entries(skinport)) add(h, 'skinport', v.c, v.q);
for (const [h, v] of Object.entries(steamCache)) add(h, 'steam', v[0], v[1]);
const P = { buy: h => price.get(h)?.buy, sell: h => price.get(h)?.sell };

function candidates(tier, st) {
  const byCol = new Map();
  for (const s of db.skins) {
    if (s.r !== tier || !s.c || (st && !s.st)) continue;
    const pool = db.pool(s, st);
    if (!pool.length) continue;
    for (const wi of wearsFor(s)) {
      const h = hashName(s, wi, st);
      const b = P.buy(h);
      if (!b) continue;
      const [lo, hi] = wearSpan(s, wi);
      const cand = { skin: s, wi, hash: h, cents: b.cents, market: b.market, q: b.q, pool, nHi: normFloat(s, hi - (hi - lo) * 0.02), nLo: normFloat(s, lo + (hi - lo) * 0.05) };
      const key = s.c + '|' + wi;
      const cur = byCol.get(key);
      if (!cur || cand.cents < cur.cents) byCol.set(key, cand);
    }
  }
  return [...byCol.values()];
}

function score(parts, n, st, tier) {
  let cost = 0, nHi = 0, nLo = 0;
  for (const [c, k] of parts) { cost += c.cents * k; nHi += c.nHi * k; nLo += c.nLo * k; }
  nHi /= n; nLo /= n;
  const probs = new Map();
  for (const [c, k] of parts) for (const o of c.pool) {
    const e = probs.get(o.n) || { skin: o, p: 0 };
    e.p += k / n / c.pool.length;
    probs.set(o.n, e);
  }
  let ev = 0, win = 0, worst = Infinity, best = 0;
  const outs = [];
  for (const { skin, p } of probs.values()) {
    const f = skin.vanilla ? 0 : outFloat(nHi, skin);
    const fLo = skin.vanilla ? 0 : outFloat(nLo, skin);
    const wi = wearIndex(f);
    const h = hashName(skin, wi, st);
    const s = P.sell(h);
    if (!s) return null;
    ev += p * s.net;
    if (s.net > cost) win += p;
    worst = Math.min(worst, s.net);
    best = Math.max(best, s.net);
    outs.push([h, +p.toFixed(4), +f.toFixed(4), s.net, s.market, skin.img, +fLo.toFixed(4), wearIndex(fLo) !== wi ? hashName(skin, wearIndex(fLo), st) : 0]);
  }
  outs.sort((a, b) => b[1] - a[1]);
  const ids = parts.map(([c, k]) => `${k}x${c.hash}`).sort();
  return {
    id: (st ? 'st:' : '') + ids.join('+'),
    st, tier, n,
    in: parts.map(([c, k]) => [c.hash, k, c.cents, c.market, c.q, c.skin.img, c.skin.min, c.skin.max, c.wi]),
    cost, ev: Math.round(ev), roi: +((ev - cost) / cost).toFixed(4), win: +win.toFixed(4), worst, best,
    guaranteed: worst > cost,
    thin: parts.some(([c, k]) => c.q < k),
    outs
  };
}

const results = [];
for (const st of [false, true]) {
  for (let tier = 1; tier <= 5; tier++) {
    const n = contractSize(tier);
    const cands = candidates(tier, st);
    let count = 0;
    for (let i = 0; i < cands.length; i++) {
      const r = score([[cands[i], n]], n, st, tier);
      if (r) { results.push(r); count++; }
      for (let j = i + 1; j < cands.length; j++) {
        if (cands[i].skin.c === cands[j].skin.c) continue;
        for (let k = 1; k < n; k++) {
          const m = score([[cands[i], k], [cands[j], n - k]], n, st, tier);
          if (m && (m.roi > -0.05 || m.guaranteed)) { results.push(m); count++; }
        }
      }
    }
    log(`${st ? 'ST ' : ''}${TIERS[tier]} -> ${TIERS[tier + 1]}: ${cands.length} inputs, ${count} contracts`);
  }
}

const allG = results.filter(r => r.guaranteed).sort((a, b) => (b.worst - b.cost) / b.cost - (a.worst - a.cost) / a.cost);
const seen = new Set(allG.map(r => r.id));
const pairKey = r => (r.st ? 'st:' : '') + r.in.map(i => i[0]).sort().join('+');
const used = new Set();
const guaranteed = [];
for (const r of allG) { const k = pairKey(r); if (used.has(k)) continue; used.add(k); guaranteed.push(r); if (guaranteed.length >= 250) break; }
const top = [];
for (const r of results.filter(r => !r.guaranteed).sort((a, b) => b.roi - a.roi)) { const k = pairKey(r); if (used.has(k)) continue; used.add(k); top.push(r); if (top.length >= TOP) break; }
const lucky = results.filter(r => !r.guaranteed && r.win >= 0.5).sort((a, b) => b.win - a.win || b.roi - a.roi).slice(0, 150);
for (const r of lucky) { const k = pairKey(r); if (used.has(k)) continue; used.add(k); top.push(r); }

const firstSeen = {};
for (const g of guaranteed) g.born = firstSeen[g.id] = prevState?.firstSeen?.[g.id] || now;
const hollow = prevState?.hollow || [];
for (const old of prevTrades?.guaranteed || []) {
  if (seen.has(old.id) || !prevState?.firstSeen?.[old.id]) continue;
  hollow.unshift({ id: old.id, st: old.st, tier: old.tier, in: old.in, cost: old.cost, worst: old.worst, ev: old.ev, born: prevState.firstSeen[old.id], died: now });
}
hollow.splice(300);

const fresh = guaranteed.filter(g => !(prevTrades?.guaranteed || []).some(o => o.id === g.id));
for (const g of fresh.slice(0, 5)) {
  const usd = c => '$' + (c / 100).toFixed(2);
  await discord(HOOK, {
    username: 'de_contract',
    embeds: [{
      title: `new guaranteed ${g.st ? 'StatTrak ' : ''}${TIERS[g.tier]} -> ${TIERS[g.tier + 1]}`,
      description: g.in.map(i => `${i[1]}x ${i[0]} @ ${usd(i[2])} (${i[3]})`).join('\n') + `\n\ncost ${usd(g.cost)} | worst ${usd(g.worst)} | ev ${usd(g.ev)} | +${(((g.worst - g.cost) / g.cost) * 100).toFixed(1)}% min`,
      color: 0x4fb33a,
      url: SITE ? `${SITE}/#t=${encodeURIComponent(g.id)}` : undefined
    }]
  });
}

const skinsLite = { skins: meta.skins, collections: meta.collections };
const prices = {};
for (const [h, v] of price) prices[h] = [v.buy?.cents || 0, v.buy?.market || '', v.buy?.q || 0, v.sell?.net || 0, v.sell?.market || ''];

await mkdir(OUT, { recursive: true });
await writeFile(`${OUT}/tradeups.json`, JSON.stringify({ at: now, took: Date.now() - t0, rateLimited, sources, guaranteed, top }));
await writeFile(`${OUT}/state.json`, JSON.stringify({ steam: steamCache, steamAge, steamNext: sp.next, firstSeen, hollow }));
await writeFile(`${OUT}/hollow.json`, JSON.stringify({ at: now, hollow }));
await writeFile(`${OUT}/prices.json`, JSON.stringify({ at: now, prices }));
await writeFile(`${OUT}/skins.json`, JSON.stringify(skinsLite));
log(`done: ${guaranteed.length} guaranteed, ${top.length} top, ${fresh.length} new, ${hollow.length} in the hollow`);
