import { readFile } from 'node:fs/promises';

const UA = { 'User-Agent': 'de_contract/1.0', 'Accept-Encoding': 'br, gzip' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const RARITY = {
  rarity_common_weapon: 0, rarity_uncommon_weapon: 1, rarity_rare_weapon: 2,
  rarity_mythical_weapon: 3, rarity_legendary_weapon: 4, rarity_ancient_weapon: 5
};

async function getJson(url, opts = {}) {
  if (process.env.FIXTURES) {
    const key = url.includes('skinport') ? 'skinport' : url.includes('steamcommunity') ? 'steam' : url.includes('CSGO-API') ? 'skins' : 'other';
    return JSON.parse(await readFile(`${process.env.FIXTURES}/${key}.json`, 'utf8'));
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
  return { skins, collections };
}

export async function skinportPrices() {
  const list = await getJson('https://api.skinport.com/v1/items?app_id=730&currency=USD&tradable=0');
  const out = {};
  for (const i of list) if (i.min_price) out[i.market_hash_name] = { c: Math.round(i.min_price * 100), q: i.quantity || 0 };
  return out;
}

export async function steamPages(start, pages, delay = 3500) {
  const out = {};
  let at = start, total = Infinity, rate = false;
  for (let i = 0; i < pages; i++) {
    try {
      const j = await getJson(`https://steamcommunity.com/market/search/render/?query=&start=${at}&count=100&search_descriptions=0&sort_column=name&sort_dir=asc&appid=730&norender=1`);
      total = j.total_count ?? total;
      for (const r of j.results || []) if (r.sell_price) out[r.hash_name] = { c: r.sell_price, q: r.sell_listings || 0 };
      at += 100;
      if (at >= total) { at = 0; break; }
      if (process.env.FIXTURES) break;
    } catch (e) {
      if (e.rate) { rate = true; break; }
      throw e;
    }
    await sleep(delay);
  }
  return { prices: out, next: at, total, rate };
}

export async function discord(hook, payload) {
  if (!hook || process.env.FIXTURES) return;
  await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

export async function previous(url) {
  if (!url) return null;
  try { const r = await fetch(url, { headers: UA }); return r.ok ? r.json() : null; } catch { return null; }
}
