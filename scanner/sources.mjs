import { readFile } from 'node:fs/promises';

const UA = { 'User-Agent': 'de_contract/1.0', 'Accept-Encoding': 'br, gzip' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const RARITY = {
  rarity_common_weapon: 0, rarity_uncommon_weapon: 1, rarity_rare_weapon: 2,
  rarity_mythical_weapon: 3, rarity_legendary_weapon: 4, rarity_ancient_weapon: 5
};

async function getJson(url, opts = {}) {
  if (process.env.FIXTURES) {
    const key = url.includes('priceoverview') ? 'overview' : url.includes('steamcommunity') ? 'steam' : url.includes('crates.json') ? 'crates' : url.includes('CSGO-API') ? 'skins' : url.includes('sales/history') ? 'sp_sales' : url.includes('skinport') ? 'sp_items' : 'other';
    const data = JSON.parse(await readFile(`${process.env.FIXTURES}/${key}.json`, 'utf8'));
    if (key === 'overview') {
      const name = decodeURIComponent(url.split('market_hash_name=')[1]);
      return data[name] || { success: false };
    }
    return data;
  }
  const r = await fetch(url, { headers: { ...UA, ...(opts.headers || {}) } });
  if (r.status === 429) { const e = new Error('rate limited'); e.rate = true; throw e; }
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}

export async function loadSkins() {
  const raw = await getJson('https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json');
  const skins = [], collections = {};
  for (const s of raw) {
    const star = s.name.startsWith('★');
    const r = star ? 6 : RARITY[s.rarity?.id];
    if (r === undefined) continue;
    const c = s.collections?.[0];
    if (c) collections[c.id] = c.name;
    skins.push({
      n: s.name, r,
      min: s.min_float ?? 0, max: s.max_float ?? 1,
      c: c?.id || null,
      k: (s.crates || []).map(x => x.id),
      st: !!s.stattrak,
      img: s.image || '',
      ...(star && !s.name.includes(' | ') ? { vanilla: true } : {})
    });
  }
  const cases = {};
  try {
    const cr = await getJson('https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/crates.json');
    for (const c of cr || []) if (c.type === 'Case') cases[c.id] = [c.name, c.image || ''];
  } catch {}
  return { skins, collections, cases };
}

const cents = s => s ? Math.round(parseFloat(String(s).replace(/[^0-9.]/g, '')) * 100) : 0;

export async function steamOverview(names, delay = 3200, max = 40) {
  const out = {};
  let rate = false;
  for (const n of names.slice(0, max)) {
    try {
      const j = await getJson(`https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent(n)}`);
      out[n] = j.success ? { lo: cents(j.lowest_price), med: cents(j.median_price), vol: parseInt(String(j.volume || '0').replace(/,/g, '')) || 0, at: Date.now() } : { lo: 0, med: 0, vol: 0, at: Date.now() };
    } catch (e) {
      if (e.rate) { rate = true; break; }
    }
    if (!process.env.FIXTURES) await sleep(delay);
  }
  return { data: out, rate };
}

const SEGMENTS = ['&category_730_Weapon%5B%5D=any', '&category_730_Type%5B%5D=tag_Type_Hands', '&category_730_Type%5B%5D=tag_CSGO_Type_WeaponCase'];

export async function steamPages(cursor, pages, delay = 3500) {
  const out = {};
  let seg = typeof cursor === 'object' && cursor ? cursor.seg % SEGMENTS.length : 0;
  let at = typeof cursor === 'object' && cursor ? cursor.at : 0;
  let total = Infinity, rate = false, fails = 0, wrapped = false;
  const totals = (cursor && cursor.totals) || {};
  for (let i = 0; i < pages; i++) {
    try {
      const j = await getJson(`https://steamcommunity.com/market/search/render/?query=&start=${at}&count=100&search_descriptions=0&sort_column=name&sort_dir=asc&appid=730&norender=1${SEGMENTS[seg]}`);
      if (!j || j.success === false) throw new Error('steam said no');
      total = j.total_count ?? total;
      totals[seg] = total;
      for (const r of j.results || []) if (r.sell_price) out[r.hash_name] = { c: r.sell_price, q: r.sell_listings || 0 };
      at += 100;
      fails = 0;
      if (at >= total) { at = 0; seg = (seg + 1) % SEGMENTS.length; if (seg === 0) wrapped = true; }
      if (process.env.FIXTURES) break;
    } catch (e) {
      if (e.rate) { rate = true; break; }
      if (++fails >= 3) break;
    }
    await sleep(delay * (fails ? 2 : 1));
  }
  return { prices: out, next: { seg, at, totals }, total: Object.values(totals).reduce((a, b) => a + b, 0), rate, wrapped };
}

const PHASE = /^Phase \d$/;
const lowest = vals => { const v = vals.filter(x => x > 0); return v.length ? Math.min(...v) : 0; };

export async function skinport(want) {
  const base = 'https://api.skinport.com/v1';
  const hdr = { headers: { 'Accept-Encoding': 'br' } };
  const [items, sales] = await Promise.all([
    getJson(`${base}/items?app_id=730&currency=USD&tradable=0`, hdr).catch(e => ({ err: e })),
    getJson(`${base}/sales/history?app_id=730&currency=USD`, hdr).catch(e => ({ err: e }))
  ]);
  const rate = !!(items?.err?.rate || sales?.err?.rate);
  const group = new Map();
  const add = (h, v, kind, row) => {
    if (want && !want.has(h)) return;
    if (!group.has(h)) group.set(h, []);
    group.get(h).push({ v, kind, row });
  };
  if (Array.isArray(items)) for (const r of items) add(r.market_hash_name, r.version, 'i', r);
  if (Array.isArray(sales)) for (const r of sales) add(r.market_hash_name, r.version, 's', r);
  const out = {};
  const c = x => x ? Math.round(x * 100) : 0;
  for (const [h, rows] of group) {
    const plain = rows.filter(r => !r.v), phases = rows.filter(r => r.v && PHASE.test(r.v));
    const use = plain.length ? plain : phases;
    if (!use.length) continue;
    const ss = use.filter(r => r.kind === 's').map(r => r.row), ii = use.filter(r => r.kind === 'i').map(r => r.row);
    const one = phases.length && !plain.length;
    const vol = k => one ? Math.min(...ss.map(r => r[k]?.volume || 0)) : ss.reduce((a, r) => a + (r[k]?.volume || 0), 0);
    const e = [
      lowest(ss.map(r => c(r.last_7_days?.median))),
      lowest(ss.map(r => c(r.last_30_days?.median))),
      lowest(ii.map(r => c(r.suggested_price))),
      ss.length ? vol('last_7_days') : 0,
      ss.length ? vol('last_30_days') : 0,
      lowest(ii.map(r => c(r.min_price))),
      lowest(ss.map(r => c(r.last_90_days?.median))),
      ss.length ? vol('last_90_days') : 0,
      ii.reduce((a, r) => a + (r.quantity || 0), 0)
    ];
    if (e[0] || e[1] || e[6] || (e[5] && e[8])) out[h] = e;
  }
  return { prices: out, rate, ok: Array.isArray(items) || Array.isArray(sales) };
}

export async function discord(hook, payload) {
  if (!hook || process.env.FIXTURES) return;
  await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

let sealKey = null;
export async function previous(url) {
  if (!url) return null;
  try {
    const r = await fetch(url, { headers: UA });
    if (r.ok) return r.json();
    if (!process.env.SITE_KEY) return null;
    const e = await fetch(url + '.enc', { headers: UA });
    if (!e.ok) return null;
    const { deriveKey, open } = await import('../js/seal.js');
    sealKey ||= await deriveKey(process.env.SITE_KEY);
    return JSON.parse(new TextDecoder().decode(await open(sealKey, await e.arrayBuffer())));
  } catch { return null; }
}
