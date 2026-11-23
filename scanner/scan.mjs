import { mkdir, writeFile } from 'node:fs/promises';
import { Db, wearsFor, wearSpan, hashName, normFloat, outFloat, wearIndex, netAfterFee, contractSize, TIERS, WEARS } from '../js/tradeup.js';
import { loadSkins, steamPages, steamOverview, skinport, discord, previous } from './sources.mjs';

const OUT = process.env.OUT || 'dist/data';
const SITE = process.env.SITE_URL || '';
const HOOK = process.env.DISCORD_WEBHOOK || '';
const STEAM_PAGES = +(process.env.STEAM_PAGES || 70);
const STEAM_TTL = 36 * 3600e3;
const VERIFY_MAX = +(process.env.VERIFY_MAX || 40);
const VERIFY_TTL = 6 * 3600e3;
const MIN_SELL_LISTINGS = 3;
const SP_TTL = 24 * 3600e3;
const MAX_UNKNOWN = 0.4;
const TOP = 400;

const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

const prevState = await previous(SITE && `${SITE}/data/state.json`);
const prevTrades = await previous(SITE && `${SITE}/data/tradeups.json`);

const meta = await loadSkins();
const db = new Db(meta);
log('skins', meta.skins.length);

const sources = {};

const steamCache = prevState?.steam || {};
const steamAge = prevState?.steamAge || {};
const sp = await steamPages(prevState?.steamNext || 0, STEAM_PAGES);
const now = Date.now();
for (const [k, v] of Object.entries(sp.prices)) { steamCache[k] = [v.c, v.q]; steamAge[k] = now; }
for (const k of Object.keys(steamAge)) if (now - steamAge[k] > STEAM_TTL) { delete steamAge[k]; delete steamCache[k]; }
sources.steam = Object.keys(steamCache).length;
sources.steamFresh = Object.keys(sp.prices).length;
sources.steamTotal = sp.total || 0;
const rateLimited = sp.rate;
sources.market = 'steam';
log('steam', sources.steamFresh, 'fresh,', sources.steam, 'cached', rateLimited ? '(rate limited)' : '');

const wantHashes = new Set();
for (const s of db.skins) for (const wi of wearsFor(s)) for (const st of s.st ? [false, true] : [false]) wantHashes.add(hashName(s, wi, st));
let spCache = prevState?.skinport || {}, spAt = prevState?.skinportAt || 0;
const spr = await skinport(wantHashes);
if (spr.ok && Object.keys(spr.prices).length) { spCache = spr.prices; spAt = now; }
else if (now - spAt > SP_TTL) { spCache = {}; spAt = 0; }
sources.skinport = Object.keys(spCache).length;
log('skinport', sources.skinport, spr.ok ? '' : '(failed, using last)', spr.rate ? '(rate limited)' : '');

const verified = prevState?.verified || {};
for (const k of Object.keys(verified)) if (now - verified[k].at > VERIFY_TTL) delete verified[k];

function skinportSell(h) {
  const e = spCache[h];
  if (!e) return null;
  const [m7, m30, sug, v7, v30, ask, m90, v90, qty] = e;
  if (m7 && v7 >= 2) return { net: netAfterFee('skinport', m7), market: 'skinport' };
  if (m30 && v30 >= 1) return { net: netAfterFee('skinport', m30), market: 'skinport' };
  if (m90 && v90 >= 1) return { net: netAfterFee('skinport', m90), market: 'skinport 90d', soft: true };
  if (ask && qty) return { net: netAfterFee('skinport', Math.min(ask, sug || ask)), market: 'skinport ask', soft: true };
  return null;
}

function hardSell(h) {
  const c = steamCache[h], v = verified[h];
  const ask = v?.lo || c?.[0] || 0, q = c?.[1] ?? 0;
  if (ask && (v ? v.vol >= 1 || q >= MIN_SELL_LISTINGS : q >= MIN_SELL_LISTINGS)) return netAfterFee('steam', Math.max(1, (v?.med ? Math.min(ask, v.med) : ask) - 1));
  const s = skinportSell(h);
  return s && !s.soft ? s.net : 0;
}

function capSoft(h, sell) {
  if (!sell?.soft) return sell;
  const m = h.match(/^(.*) \((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/);
  if (!m) return sell;
  const wi = WEARS.findIndex(w => w[0] === m[2]);
  for (let i = wi - 1; i >= 0; i--) {
    const better = hardSell(`${m[1]} (${WEARS[i][0]})`);
    if (better) return sell.net > better ? { ...sell, net: better, market: sell.market + ' (capped)' } : sell;
  }
  return sell;
}

function quote(h) {
  const c = steamCache[h], v = verified[h];
  const ask = v?.lo || c?.[0] || 0;
  const q = c?.[1] ?? 0;
  let sellBase = ask;
  if (v?.med) sellBase = Math.min(ask, v.med);
  const liquid = ask && (v ? v.vol >= 1 || q >= MIN_SELL_LISTINGS : q >= MIN_SELL_LISTINGS);
  const sane = !(v?.med && ask > v.med * 2.5);
  let sell = null;
  if (liquid) sell = { net: netAfterFee('steam', Math.max(1, (sane ? sellBase : v.med) - 1)), market: 'steam', ask };
  if (!sell) sell = skinportSell(h);
  if (!sell && ask) sell = { net: netAfterFee('steam', Math.max(1, ask - 1)), market: 'steam thin', ask, soft: true };
  sell = capSoft(h, sell);
  if (!sell && !ask) return null;
  return {
    buy: ask && q > 0 ? { cents: ask, market: 'steam', q } : null,
    sell,
    checked: !!v
  };
}
const price = new Map();
const P = {
  get: h => { if (!price.has(h)) price.set(h, quote(h)); return price.get(h); },
  buy: h => P.get(h)?.buy,
  sell: h => P.get(h)?.sell,
  checked: h => !!P.get(h)?.checked
};

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
  let ev = 0, win = 0, worst = Infinity, best = 0, unknown = 0, soft = false;
  const outs = [];
  for (const { skin, p } of probs.values()) {
    const f = skin.vanilla ? 0 : outFloat(nHi, skin);
    const fLo = skin.vanilla ? 0 : outFloat(nLo, skin);
    const wi = wearIndex(f);
    const h = hashName(skin, wi, st);
    const s = P.sell(h);
    if (s) {
      ev += p * s.net;
      if (s.net > cost) win += p;
      worst = Math.min(worst, s.net);
      best = Math.max(best, s.net);
      if (s.soft) soft = true;
    } else unknown += p;
    outs.push([h, +p.toFixed(4), +f.toFixed(4), s ? s.net : null, s ? s.market : '', skin.img, +fLo.toFixed(4), wearIndex(fLo) !== wi ? hashName(skin, wearIndex(fLo), st) : 0]);
  }
  if (unknown > MAX_UNKNOWN) return null;
  if (!isFinite(worst)) worst = 0;
  if (unknown) ev /= 1 - unknown;
  outs.sort((a, b) => b[1] - a[1]);
  const ids = parts.map(([c, k]) => `${k}x${c.hash}`).sort();
  return {
    id: (st ? 'st:' : '') + ids.join('+'),
    st, tier, n,
    in: parts.map(([c, k]) => [c.hash, k, c.cents, c.market, c.q, c.skin.img, c.skin.min, c.skin.max, c.wi]),
    cost, ev: Math.round(ev), roi: +((ev - cost) / cost).toFixed(4), win: +win.toFixed(4), worst, best,
    guaranteed: worst > cost && !unknown && !soft && !parts.some(([c, k]) => c.q < k),
    thin: parts.some(([c, k]) => c.q < k),
    unknown: +unknown.toFixed(4),
    soft,
    outs,
    _parts: parts
  };
}

function refresh(r) {
  const parts = r._parts.map(([c, k]) => {
    const b = P.buy(c.hash);
    return [{ ...c, cents: b?.cents ?? Infinity, q: b?.q ?? 0 }, k];
  });
  if (parts.some(([c]) => !isFinite(c.cents))) return null;
  return score(parts, r.n, r.st, r.tier);
}

function hashesOf(r) { return [...r.in.map(i => i[0]), ...r.outs.map(o => o[0])]; }

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

const byMin = (a, b) => (b.worst - b.cost) / b.cost - (a.worst - a.cost) / a.cost;
let maybe = results.filter(r => r.guaranteed).sort(byMin);
const want = [];
for (const r of maybe) {
  for (const h of hashesOf(r)) if (!verified[h] && !want.includes(h)) want.push(h);
  if (want.length >= VERIFY_MAX) break;
}
const ov = await steamOverview(want, 3200, VERIFY_MAX);
Object.assign(verified, ov.data);
price.clear();
log('verified', Object.keys(ov.data).length, 'prices on steam', ov.rate ? '(rate limited)' : '');
const confirmed = [], pending = [];
for (const r of maybe) {
  const r2 = refresh(r);
  if (!r2) continue;
  if (!r2.guaranteed) { results.push(r2); continue; }
  if (hashesOf(r2).every(h => P.checked(h))) { r2.confirmed = true; confirmed.push(r2); }
  else pending.push(r2);
}
for (const r of results) if (r.guaranteed) r.guaranteed = false;
for (const r of confirmed) r.guaranteed = true;
const allG = confirmed.sort(byMin);
const seen = new Set(allG.map(r => r.id));
const pairKey = r => (r.st ? 'st:' : '') + r.in.map(i => i[0]).sort().join('+');
const used = new Set();
const guaranteed = [];
for (const r of allG) { const k = pairKey(r); if (used.has(k)) continue; used.add(k); guaranteed.push(r); if (guaranteed.length >= 250) break; }
const pend = [];
for (const r of pending.sort(byMin)) { const k = pairKey(r); if (used.has(k)) continue; used.add(k); pend.push(r); if (pend.length >= 120) break; }
const top = [];
for (const r of results.filter(r => !r.guaranteed && !r.confirmed).sort((a, b) => b.roi - a.roi)) { const k = pairKey(r); if (used.has(k)) continue; used.add(k); top.push(r); if (top.length >= TOP) break; }
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

const skinsLite = { skins: meta.skins, collections: meta.collections, cases: meta.cases || {} };
const prices = {};
for (const h of new Set([...Object.keys(steamCache), ...Object.keys(verified), ...Object.keys(spCache)])) {
  const v = P.get(h);
  if (v) prices[h] = [v.buy?.cents || 0, 'steam', v.buy?.q || 0, v.sell?.net || 0, v.sell?.market || '', v.checked ? 1 : 0];
}
const strip = r => { const { _parts, ...o } = r; return o; };

await mkdir(OUT, { recursive: true });
await writeFile(`${OUT}/tradeups.json`, JSON.stringify({ at: now, took: Date.now() - t0, rateLimited: rateLimited || ov.rate, sources, guaranteed: guaranteed.map(strip), pending: pend.map(strip), top: top.map(strip) }));
await writeFile(`${OUT}/state.json`, JSON.stringify({ steam: steamCache, steamAge, steamNext: sp.next, firstSeen, hollow, verified, skinport: spCache, skinportAt: spAt }));
await writeFile(`${OUT}/hollow.json`, JSON.stringify({ at: now, hollow }));
await writeFile(`${OUT}/prices.json`, JSON.stringify({ at: now, prices }));
await writeFile(`${OUT}/skins.json`, JSON.stringify(skinsLite));
log(`done: ${guaranteed.length} confirmed, ${pend.length} pending, ${top.length} top, ${fresh.length} new, ${hollow.length} in the hollow`);
