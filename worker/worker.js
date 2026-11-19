const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'x-key, content-type' };
const UA = { 'User-Agent': 'Mozilla/5.0 de_contract' };

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const cents = s => s ? Math.round(parseFloat(String(s).replace(/[^0-9.]/g, '')) * 100) : 0;

async function skinport(ctx) {
  const key = new Request('https://cache.local/skinport');
  const hit = await caches.default.match(key);
  if (hit) return hit.json();
  const r = await fetch('https://api.skinport.com/v1/items?app_id=730&currency=USD&tradable=0', { headers: { ...UA, 'Accept-Encoding': 'br' } });
  if (!r.ok) return {};
  const map = {};
  for (const i of await r.json()) if (i.min_price) map[i.market_hash_name] = [Math.round(i.min_price * 100), i.quantity || 0];
  ctx.waitUntil(caches.default.put(key, new Response(JSON.stringify(map), { headers: { 'Cache-Control': 'max-age=300' } })));
  return map;
}

async function steam(name) {
  const r = await fetch(`https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent(name)}`, { headers: UA });
  if (r.status === 429) return { rate: true };
  if (!r.ok) return null;
  const j = await r.json();
  return j.success && j.lowest_price ? [cents(j.lowest_price), parseInt(String(j.volume || '0').replace(/,/g, '')) || 0] : null;
}

async function prices(url, ctx) {
  let names;
  try { names = JSON.parse(url.searchParams.get('names') || '[]'); } catch { return json({ error: 'bad names' }, 400); }
  names = names.slice(0, 30);
  const sp = await skinport(ctx);
  const out = {};
  let rate = 0;
  for (const n of names) {
    const s = await steam(n);
    if (s?.rate) rate++;
    out[n] = { steam: s && !s.rate ? s : null, skinport: sp[n] || null };
    await new Promise(r => setTimeout(r, 250));
  }
  if (rate && rate === names.length && !Object.values(out).some(v => v.skinport)) return json({ error: 'steam rate limited' }, 429);
  return json(out);
}

async function inventory(url) {
  let id = url.searchParams.get('id') || '';
  if (!/^\d{17}$/.test(id)) {
    const r = await fetch(`https://steamcommunity.com/id/${encodeURIComponent(id)}/?xml=1`, { headers: UA });
    const m = (await r.text()).match(/<steamID64>(\d+)<\/steamID64>/);
    if (!m) return json({ error: 'couldnt find that profile' }, 404);
    id = m[1];
  }
  const r = await fetch(`https://steamcommunity.com/inventory/${id}/730/2?l=english&count=2000`, { headers: UA });
  if (r.status === 429) return json({ error: 'steam rate limited' }, 429);
  if (r.status === 403) return json({ error: 'inventory is private' }, 403);
  if (!r.ok) return json({ error: 'steam said ' + r.status }, 502);
  return json(await r.json());
}

async function scan(env) {
  if (!env.GH_TOKEN) return json({ error: 'no GH_TOKEN on the worker' }, 500);
  const repo = env.GH_REPO || 'drapids/de_contract';
  const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/scan.yml/dispatches`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'de_contract', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: 'main' })
  });
  if (r.status === 204) return json({ ok: true });
  return json({ error: 'github said ' + r.status }, 502);
}

export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    if (env.SITE_KEY && req.headers.get('x-key') !== env.SITE_KEY) return json({ error: 'wrong key' }, 401);
    try {
      if (url.pathname === '/scan' && req.method === 'POST') return await scan(env);
      if (url.pathname === '/prices') return await prices(url, ctx);
      if (url.pathname === '/inv') return await inventory(url);
      return json({ ok: true, routes: ['/prices?names=[...]', '/inv?id=steamid', 'POST /scan'] });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }
};
