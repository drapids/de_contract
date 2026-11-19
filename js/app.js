import { Db, TIERS, TIER_COLORS, WEARS, wearsFor, wearSpan, hashName, outcomes, parseHash, usd, netAfterFee } from './tradeup.js';
import { Guy } from './guy.js';
import { setup as soundSetup, sfx, setMusic, setVolume } from './sound.js';
import { getLock, unlock, fetchData } from './lock.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = v => (v * 100).toFixed(v < 0.1 && v > -0.1 ? 1 : 0) + '%';
const ago = t => { const s = (Date.now() - t) / 1000; return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + 'm ago' : s < 86400 ? Math.round(s / 3600) + 'h ago' : Math.round(s / 86400) + 'd ago'; };
const span = ms => { const m = ms / 60000; return m < 60 ? Math.max(1, Math.round(m)) + ' min' : (m / 60).toFixed(1) + ' hrs'; };
const short = h => h.replace('StatTrak™ ', '').replace(/ \((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/, m => ' ' + WEARS.find(w => m.includes(w[0]))[1]);

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('dc.' + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('dc.' + k, JSON.stringify(v)); } catch {} }
};

const S = {
  data: null, db: null, prices: {}, hollow: [],
  settings: { worker: '', guy: true, music: true, bg: true, vol: 0.5, skin: 'sas', ...store.get('settings', {}) },
  tracker: store.get('tracker', []),
  calc: { st: false, rows: [] }
};
let guy = null;

function marketUrl(h, m) {
  return `https://steamcommunity.com/market/listings/730/${encodeURIComponent(h)}`;
}

function chip(h, img, tier, extra = '') {
  return `<span class="chip" style="--c:${TIER_COLORS[tier] || '#777'}" title="${esc(h)}">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ''}<span>${extra}${esc(short(h))}</span></span>`;
}

function row(t) {
  const outs = t.outs.slice(0, 4).map(o => chip(o[0], o[5], t.tier + 1)).join('') + (t.outs.length > 4 ? `<span class="dim">+${t.outs.length - 4}</span>` : '');
  const ins = t.in.map(i => chip(i[0], i[5], t.tier, `<b>${i[1]}x</b> `)).join('');
  const minP = (t.worst - t.cost) / t.cost;
  return `<div class="tu ${t.guaranteed ? 'sure' : ''}" data-id="${esc(t.id)}">
    <div class="ins">${t.st ? '<span class="tag st">ST</span>' : ''}${t.born ? `<span class="tag age">${ago(t.born)}</span>` : ''}${ins}</div>
    <div class="arrow">&rsaquo;</div>
    <div class="outs">${outs}</div>
    <div class="cell">${usd(t.cost)}<small>cost</small></div>
    <div class="cell ${t.worst > t.cost ? 'ok' : 'bad'}">${usd(t.worst)}<small>worst ${t.guaranteed ? '+' + pct(minP) : ''}</small></div>
    <div class="cell">${usd(t.ev)}<small>ev ${t.roi >= 0 ? '+' : ''}${pct(t.roi)}</small></div>
    <div class="cell ${t.win >= 0.5 ? 'ok' : ''}">${pct(t.win)}<small>win</small></div>
  </div>`;
}

const head = '<div class="listhead"><span>inputs</span><span></span><span>could get</span><span>cost</span><span>worst case</span><span>ev</span><span>chance</span></div>';

function tierOptions(sel) {
  for (let i = 1; i <= 5; i++) sel.insertAdjacentHTML('beforeend', `<option value="${i}">${TIERS[i]} &rarr; ${i === 5 ? 'knife/gloves' : TIERS[i + 1]}</option>`);
}

function renderGuaranteed() {
  const st = $('#g-st').checked, tier = $('#g-tier').value, num = id => parseFloat($(id).value);
  const cost = num('#g-cost'), pmin = num('#g-pmin'), pmax = num('#g-pmax'), pct = num('#g-pct'), thin = $('#g-thin').checked;
  const ok = t => {
    const p = t.worst - t.cost;
    return (!st || t.st) && (!tier || t.tier == tier) && (isNaN(cost) || t.cost <= cost * 100) && (isNaN(pmin) || p >= pmin * 100) &&
      (isNaN(pmax) || p <= pmax * 100) && (isNaN(pct) || p / t.cost * 100 >= pct) && (!thin || !t.thin);
  };
  const list = (S.data?.guaranteed || []).filter(ok);
  const pend = (S.data?.pending || []).filter(ok);
  const key = { pct: t => -(t.worst - t.cost) / t.cost, usd: t => -(t.worst - t.cost), ev: t => -(t.ev - t.cost), cost: t => t.cost, new: t => -(t.born || 0) }[$('#g-sort').value];
  list.sort((a, b) => key(a) - key(b));
  pend.sort((a, b) => key(a) - key(b));
  $('#g-list').innerHTML = (list.length ? head + list.map(row).join('') :
    `<div class="empty">nothing confirmed right now.<br>every one here gets double checked on steam first, so this is usually short.</div>`) +
    (pend.length ? `<div class="pend-h">still checking on steam (${pend.length}) <span class="dim">· prices look good but not confirmed yet, dont buy off these</span></div>` + pend.map(row).join('').replaceAll('class="tu sure', 'class="tu pend') : '');
}

function renderBrowse() {
  const tier = $('#f-tier').value, st = $('#f-st').value, cost = parseFloat($('#f-cost').value), win = (parseFloat($('#f-win').value) || 0) / 100;
  const roi = parseFloat($('#f-roi').value), q = $('#f-q').value.trim().toLowerCase(), thin = $('#f-thin').checked, sort = $('#f-sort').value;
  const pmin = parseFloat($('#f-pmin').value), pmax = parseFloat($('#f-pmax').value), loss = parseFloat($('#f-loss').value);
  const all = [...(S.data?.guaranteed || []), ...(S.data?.top || [])];
  let list = all.filter(t =>
    (!tier || t.tier == tier) && (st === '' || +t.st === +st) && (isNaN(cost) || t.cost <= cost * 100) &&
    t.win >= win && (isNaN(roi) || t.roi * 100 >= roi) && (!thin || !t.thin) &&
    (isNaN(pmin) || t.ev - t.cost >= pmin * 100) && (isNaN(pmax) || t.ev - t.cost <= pmax * 100) && (isNaN(loss) || t.cost - t.worst <= loss * 100) &&
    (!q || t.in.some(i => i[0].toLowerCase().includes(q)) || t.outs.some(o => o[0].toLowerCase().includes(q))));
  const key = { roi: t => -t.roi, win: t => -t.win, profit: t => -(t.ev - t.cost), best: t => -(t.best - t.cost), safe: t => t.cost - t.worst, cost: t => t.cost }[sort];
  list.sort((a, b) => key(a) - key(b));
  $('#b-list').innerHTML = list.length ? head + list.slice(0, 200).map(row).join('') + (list.length > 200 ? `<div class="dim">${list.length - 200} more, filter it down</div>` : '') : '<div class="empty">no trade ups match that</div>';
}

function find(id) { return [...(S.data?.guaranteed || []), ...(S.data?.pending || []), ...(S.data?.top || [])].find(t => t.id === id); }

function outTable(t, live) {
  const rows = t.outs.map(o => {
    const net = live?.outs?.[o[0]] ?? o[3];
    const cls = net > (live?.cost ?? t.cost) ? 'pos' : 'neg';
    const alt = o[7] ? `<br><small class="dim">best case floats: ${esc(short(o[7]))}</small>` : '';
    return `<tr class="${cls}"><td>${o[5] ? `<img src="${esc(o[5])}" alt="">` : ''}</td><td>${esc(o[0])}${alt}</td><td class="n">${pct(o[1])}</td><td class="n">${o[2].toFixed(4)}</td><td class="n">${usd(net)}<br><small class="dim">${esc(o[4])}</small></td></tr>`;
  }).join('');
  return `<table class="t"><tr><th></th><th>outcome</th><th class="n">odds</th><th class="n">float</th><th class="n">you get (after fee)</th></tr>${rows}</table>`;
}

function openTrade(t, quiet) {
  if (!t) return;
  const minP = (t.worst - t.cost) / t.cost;
  $('#m-title').textContent = `${t.st ? 'StatTrak ' : ''}${TIERS[t.tier]} → ${t.tier === 5 ? 'knife/gloves' : TIERS[t.tier + 1]}`;
  const ins = t.in.map(i => `<tr><td>${i[5] ? `<img src="${esc(i[5])}" alt="">` : ''}</td><td>${i[1]}x ${esc(i[0])}${i[4] < i[1] ? ' <span class="bad">(only ' + i[4] + ' listed)</span>' : ''}</td><td class="n">${usd(i[2])}</td><td><a href="${marketUrl(i[0], i[3])}" target="_blank" rel="noopener">${esc(i[3])}</a></td></tr>`).join('');
  $('#m-body').innerHTML = `
    <div class="summary">
      <div class="stat"><small>total cost</small><b>${usd(t.cost)}</b></div>
      <div class="stat"><small>worst case</small><b class="${t.worst > t.cost ? 'ok' : 'bad'}">${usd(t.worst)}</b></div>
      <div class="stat"><small>best case</small><b>${usd(t.best)}</b></div>
      <div class="stat"><small>expected</small><b>${usd(t.ev)}</b></div>
      <div class="stat"><small>chance of profit</small><b>${pct(t.win)}</b></div>
      <div class="stat"><small>${t.guaranteed ? 'min profit' : 'roi'}</small><b class="${t.guaranteed ? 'ok' : t.roi >= 0 ? '' : 'bad'}">${t.guaranteed ? '+' + pct(minP) : pct(t.roi)}</b></div>
    </div>
    <div class="box-t">buy these</div>
    <table class="t">${ins}</table>
    <div class="note">floats are assumed near the top of each wear so this is the safe estimate. buy lower floats = better outcome wear. if you can, check floats on csfloat before buying.</div>
    <div class="box-t">possible outcomes</div>
    <div id="m-outs">${outTable(t)}</div>
    <div id="m-live"></div>
    <div class="dlg-actions">
      <button class="btn go" id="m-send">send it to him</button>
      <button class="btn" id="m-recheck">recheck live prices</button>
      <button class="btn" id="m-log">i did this one</button>
      <button class="btn" id="m-calc">open in calculator</button>
      <button class="btn" id="m-copy">copy link</button>
    </div>`;
  $('#modal').hidden = false;
  history.replaceState(null, '', '#t=' + encodeURIComponent(t.id));
  const best = [...t.outs].sort((a, b) => b[3] - a[3])[0];
  if (guy && !quiet) {
    guy.hold(best[5], best[0], { profit: best[3] - t.cost, tier: t.tier + 1 });
    clearTimeout(S.reactTimer);
    S.reactTimer = setTimeout(() => {
      if ($('#modal').hidden) return;
      if (t.guaranteed) { guy.setDubs('+' + usd(t.worst - t.cost)); guy.set('dubs', 4500); }
      else if (t.win < 0.35) guy.set('fail', 3000);
    }, 2600);
  }
  $('#m-recheck').onclick = () => recheck(t);
  $('#m-send').onclick = () => recheck(t, true);
  $('#m-log').onclick = () => logTrade(t);
  $('#m-calc').onclick = () => toCalc(t);
  $('#m-copy').onclick = () => navigator.clipboard?.writeText(location.href);
}

function closeModal() {
  $('#modal').hidden = true;
  history.replaceState(null, '', location.pathname);
  if (guy && ['hold', 'dubs', 'fail'].includes(guy.state)) guy.set('idle');
}

async function worker(path, opts = {}) {
  const base = S.settings.worker.replace(/\/$/, '');
  if (!base) throw Object.assign(new Error('no worker url set, add it in settings'), { soft: true });
  const r = await fetch(base + path, { ...opts, headers: { 'x-key': S.key || '', ...(opts.headers || {}) } });
  if (r.status === 401) throw new Error('worker says wrong key');
  if (r.status === 429) throw Object.assign(new Error('rate limited'), { rate: true });
  if (!r.ok) throw new Error('worker said ' + r.status);
  return r.json();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function recheck(t, cine) {
  const btn = $('#m-recheck');
  if (btn) { btn.disabled = true; btn.textContent = 'checking...'; }
  const log = l => cine && guy?.log(l);
  if (cine && guy) { closeModal(); guy.terminal(true, '> recheck ' + t.in.map(i => i[1] + 'x ' + short(i[0])).join(' + ').slice(0, 26)); }
  else guy?.set('loading');
  const names = [...new Set([...t.in.map(i => i[0]), ...t.outs.map(o => o[0])])];
  try {
    log('pulling ' + names.length + ' prices...');
    if (cine) await sleep(900);
    log('asking steam...');
    const live = await worker('/prices?names=' + encodeURIComponent(JSON.stringify(names)));
    log('got em. crunching');
    if (cine) await sleep(800);
    let cost = 0, worst = Infinity, ev = 0, win = 0, missing = [];
    const outs = {};
    for (const i of t.in) {
      const m = live[i[0]] || {};
      const c = m.steam?.[0] || Infinity;
      if (!isFinite(c)) { missing.push(i[0]); cost += i[2] * i[1]; } else cost += c * i[1];
    }
    for (const o of t.outs) {
      const m = live[o[0]] || {};
      const st = m.steam, base = st ? Math.min(st[0], st[2] || st[0]) : 0;
      const net = base && (st[1] >= 1 || !st[2]) ? netAfterFee('steam', base - 1) : 0;
      outs[o[0]] = net || o[3];
      worst = Math.min(worst, outs[o[0]]); ev += o[1] * outs[o[0]];
    }
    for (const o of t.outs) if (outs[o[0]] > cost) win += o[1];
    const sure = worst > cost;
    log(`cost ${usd(cost)} worst ${usd(worst)}`);
    log(sure ? 'STILL GUARANTEED' : 'not guaranteed');
    if (cine) { await sleep(1600); guy.terminal(false); }
    if (cine) { openTrade(t, true); }
    $('#m-outs').innerHTML = outTable(t, { cost, outs });
    $('#m-live').innerHTML = `<div class="note">live: cost <b>${usd(cost)}</b> (was ${usd(t.cost)}), worst <b class="${sure ? 'ok' : 'bad'}">${usd(worst)}</b>, ev ${usd(Math.round(ev))}, win ${pct(win)}. ${sure ? '<span class="ok">still guaranteed</span>' : t.guaranteed ? '<span class="bad">not guaranteed anymore</span>' : ''}${missing.length ? `<br><span class="dim">no live price for ${missing.length} input(s), used scan price</span>` : ''}</div>`;
    if (guy) {
      if (sure) { guy.setDubs('+' + usd(worst - cost)); guy.set('dubs', 4500); }
      else guy.set('fail', 3000);
    }
  } catch (e) {
    log('ERROR: ' + e.message);
    if (cine) { await sleep(1800); guy.terminal(false); openTrade(t, true); }
    $('#m-live').innerHTML = `<div class="note bad">${esc(e.message)}</div>`;
    if (e.rate) window.dispatchEvent(new CustomEvent('dc:ratelimit', { detail: { retry: 60 } }));
    else guy?.set(e.soft ? 'no' : 'fail', 2500);
  } finally {
    const b = $('#m-recheck');
    if (b) { b.disabled = false; b.textContent = 'recheck live prices'; }
  }
}

function logTrade(t) {
  const opts = t.outs.map((o, i) => `<option value="${i}">${esc(short(o[0]))} (${pct(o[1])})</option>`).join('');
  $('#m-live').innerHTML = `<div class="note">
    <div class="row">what did you get <select class="sel" id="l-out">${opts}</select>
    worth $ <input class="inp" id="l-val" type="number" step="0.01" style="width:90px">
    paid $ <input class="inp" id="l-cost" type="number" step="0.01" value="${(t.cost / 100).toFixed(2)}" style="width:90px">
    <button class="btn go" id="l-save">save</button></div></div>`;
  const setVal = () => { $('#l-val').value = (t.outs[$('#l-out').value][3] / 100).toFixed(2); };
  setVal();
  $('#l-out').onchange = setVal;
  $('#l-save').onclick = () => {
    const o = t.outs[$('#l-out').value];
    const e = { id: Date.now(), at: Date.now(), st: t.st, tier: t.tier, in: t.in.map(i => [i[0], i[1]]), out: o[0], img: o[5], cost: Math.round($('#l-cost').value * 100), value: Math.round($('#l-val').value * 100) };
    S.tracker.unshift(e);
    store.set('tracker', S.tracker);
    renderTracker(); renderHollow();
    closeModal();
    guy?.push();
    if (e.value < e.cost) setTimeout(() => guy?.say('rip. thats going in the hollow', 2500), 600);
  };
}

function renderTracker() {
  const T = S.tracker;
  const spent = T.reduce((a, e) => a + e.cost, 0), got = T.reduce((a, e) => a + e.value, 0);
  const wins = T.filter(e => e.value > e.cost).length;
  $('#t-totals').innerHTML = `
    <div class="stat"><small>trade ups</small><b>${T.length}</b></div>
    <div class="stat"><small>spent</small><b>${usd(spent)}</b></div>
    <div class="stat"><small>got back</small><b>${usd(got)}</b></div>
    <div class="stat"><small>profit</small><b class="${got >= spent ? 'ok' : 'bad'}">${usd(got - spent)}</b> <small>${T.length ? Math.round(wins / T.length * 100) : 0}% won</small></div>`;
  $('#t-list').innerHTML = T.length ? `<table class="t"><tr><th></th><th>got</th><th>when</th><th class="n">paid</th><th class="n">worth</th><th class="n">p/l</th><th></th></tr>` +
    T.map(e => `<tr class="${e.value > e.cost ? 'pos' : 'neg'}"><td>${e.img ? `<img src="${esc(e.img)}" alt="">` : ''}</td><td>${esc(e.out)}<br><small class="dim">${e.in.map(i => i[1] + 'x ' + esc(short(i[0]))).join(', ')}</small></td><td>${new Date(e.at).toLocaleDateString()}</td><td class="n">${usd(e.cost)}</td><td class="n">${usd(e.value)}</td><td class="n ${e.value > e.cost ? 'ok' : 'bad'}">${usd(e.value - e.cost)}</td><td><button class="btn" data-del="${e.id}">x</button></td></tr>`).join('') + '</table>'
    : '<div class="empty">nothing logged yet. open a trade up and hit "i did this one"</div>';
}

function renderHollow() {
  const dead = (S.hollow || []).map(h => ({ ...h, kind: 'gone' }));
  const ls = S.tracker.filter(e => e.value < e.cost).map(e => ({ ...e, kind: 'l' }));
  const all = [...ls, ...dead].sort((a, b) => (b.died || b.at) - (a.died || a.at));
  $('#h-yard').innerHTML = all.length ? all.map((h, i) => h.kind === 'l'
    ? `<div class="stone l" data-h="${i}"><div class="rip">R.I.P</div><div class="what">${esc(h.out)}</div><div class="paid">${usd(h.value - h.cost)}</div><div class="when">your L · ${new Date(h.at).toLocaleDateString()}</div></div>`
    : `<div class="stone" data-h="${i}"><div class="rip">R.I.P</div><div class="what">${h.in.map(x => x[1] + 'x ' + esc(short(x[0]))).join(' + ')}</div><div class="paid">would've paid +${usd(h.worst - h.cost)}</div><div class="when">lived ${span(h.died - h.born)} · died ${ago(h.died)}</div></div>`).join('')
    : '<div class="empty">nothing dead yet. give it time</div>';
  S.hollowAll = all;
}

function renderStatus() {
  const d = S.data;
  if (!d) return;
  const n = d.guaranteed.length;
  const stale = Date.now() - d.at > 15 * 60000;
  $('#status').innerHTML = `scanned <b>${ago(d.at)}</b>${stale ? ' <span class="rl">(stale)</span>' : ''} · <b>${n}</b> guaranteed · <b>${d.top.length}</b> others · <b>${(d.pending || []).length}</b> checking · steam prices ${d.sources.steam ?? 0}${d.rateLimited ? ' · <span class="rl">steam rate limited us</span>' : ''}`;
  $('#tabs [data-tab=guaranteed]').textContent = `guaranteed (${n})`;
  if (stale) window.dispatchEvent(new CustomEvent('dc:stale'));
}

function calcSkins() {
  return S.db.skins.filter(s => s.r >= 1 && s.r <= 5 && s.c && S.db.pool(s, false).length);
}

function renderCalc() {
  const C = S.calc;
  const need = C.rows[0]?.skin.r === 5 ? 5 : 10;
  const count = C.rows.reduce((a, r) => a + r.k, 0);
  $('#c-count').textContent = `${count}/${need}`;
  $('#c-inputs').innerHTML = C.rows.map((r, i) => {
    const ws = wearsFor(r.skin).map(w => `<option value="${w}" ${w === r.wi ? 'selected' : ''}>${WEARS[w][1]}</option>`).join('');
    const p = S.prices[hashName(r.skin, r.wi, C.st)];
    return `<div class="cin" data-i="${i}"><span title="${esc(r.skin.n)}">${esc(r.skin.n)}<br><small class="dim">${p ? usd(p[0]) + ' ' + p[1] : 'no price'}</small></span>
      <select class="sel" data-k="wi">${ws}</select>
      <input class="inp" data-k="f" type="number" step="0.001" value="${r.f}">
      <input class="inp" data-k="k" type="number" min="1" max="${need}" value="${r.k}">
      <button class="x" data-k="del">x</button></div>`;
  }).join('') || '<div class="dim">nothing yet</div>';
  if (count !== need || !C.rows.length) { $('#c-out').innerHTML = `<span class="dim">need exactly ${need} (have ${count})</span>`; return; }
  const ins = C.rows.flatMap(r => Array(r.k).fill({ skin: r.skin, float: r.f }));
  const outs = outcomes(S.db, ins, C.st);
  if (!outs) { $('#c-out').innerHTML = '<span class="bad">one of these has nothing to trade up into</span>'; return; }
  let cost = 0, ev = 0, win = 0, worst = Infinity, miss = 0;
  for (const r of C.rows) { const p = S.prices[hashName(r.skin, r.wi, C.st)]; if (p) cost += p[0] * r.k; else miss++; }
  for (const o of outs) { const p = S.prices[o.hash]; o.net = p ? p[3] : 0; ev += o.p * o.net; worst = Math.min(worst, o.net); }
  for (const o of outs) if (o.net > cost) win += o.p;
  $('#c-out').innerHTML = `<div class="summary">
      <div class="stat"><small>cost</small><b>${usd(cost)}</b></div><div class="stat"><small>ev</small><b>${usd(Math.round(ev))}</b></div>
      <div class="stat"><small>worst</small><b class="${worst > cost ? 'ok' : 'bad'}">${usd(worst)}</b></div><div class="stat"><small>win</small><b>${pct(win)}</b></div></div>
    ${miss ? '<div class="note">missing prices for some inputs</div>' : ''}
    <table class="t"><tr><th>outcome</th><th class="n">odds</th><th class="n">float</th><th class="n">net</th></tr>${outs.map(o => `<tr class="${o.net > cost ? 'pos' : 'neg'}"><td>${esc(o.hash)}</td><td class="n">${pct(o.p)}</td><td class="n">${o.float.toFixed(4)}</td><td class="n">${o.net ? usd(o.net) : '?'}</td></tr>`).join('')}</table>`;
}

function addCalc(skin, wi, k = 1) {
  const C = S.calc;
  if (C.rows.length && C.rows[0].skin.r !== skin.r) { guy?.say('cant mix rarities bro', 2000); return; }
  const w = wi ?? wearsFor(skin)[0];
  const [lo, hi] = wearSpan(skin, w);
  C.rows.push({ skin, wi: w, f: +((lo + hi) / 2).toFixed(4), k });
  renderCalc();
}

function toCalc(t) {
  S.calc = { st: t.st, rows: [] };
  $('#c-st').checked = t.st;
  for (const i of t.in) {
    const p = parseHash(i[0]);
    const s = S.db.byName.get(p.name);
    if (s) addCalc(s, p.wi, i[1]);
  }
  closeModal();
  tab('calc');
}

async function loadInv() {
  let id = $('#inv-id').value.trim();
  const m = id.match(/profiles\/(\d+)|^(\d{17})$|id\/([^/]+)/);
  if (!m) { $('#inv-out').innerHTML = '<span class="bad">paste a steamid64 or a steamcommunity.com profile link</span>'; return; }
  id = m[1] || m[2] || m[3];
  $('#inv-out').innerHTML = 'loading...';
  guy?.set('loading');
  try {
    const inv = await worker('/inv?id=' + encodeURIComponent(id));
    const counts = {};
    for (const a of inv.assets || []) counts[a.classid + '_' + a.instanceid] = (counts[a.classid + '_' + a.instanceid] || 0) + 1;
    const items = (inv.descriptions || []).map(d => ({ h: d.market_hash_name, n: counts[d.classid + '_' + d.instanceid] || 1, img: 'https://community.cloudflare.steamstatic.com/economy/image/' + d.icon_url + '/120fx90f' }));
    const used = new Set([...(S.data?.guaranteed || []), ...(S.data?.top || [])].flatMap(t => t.in.map(i => i[0])));
    const rows = items.map(it => {
      const p = parseHash(it.h), s = S.db.byName.get(p.name), price = S.prices[it.h];
      const ok = s && s.r >= 1 && s.r <= 5 && p.wi >= 0;
      return { ...it, s, p, price, ok, used: used.has(it.h) };
    }).sort((a, b) => b.used - a.used || b.ok - a.ok || (b.price?.[0] || 0) - (a.price?.[0] || 0));
    $('#inv-out').innerHTML = `<p class="dim">${rows.length} items, ${rows.filter(r => r.ok).length} usable in trade ups, ${rows.filter(r => r.used).length} show up in current scans</p><div class="inv">${rows.map((r, i) =>
      `<div class="item" style="--c:${r.s ? TIER_COLORS[r.s.r] : '#555'}"><img src="${esc(r.img)}" alt="" loading="lazy"><span>${r.n > 1 ? r.n + 'x ' : ''}${esc(r.h)}</span><span class="dim">${r.price ? usd(r.price[0]) : '-'}</span>${r.used ? '<span class="ok">in a scanned trade up</span>' : ''}${r.ok ? `<button class="btn" data-inv="${i}">add to calc</button>` : ''}</div>`).join('')}</div>`;
    S.invRows = rows;
    guy?.set('idle');
  } catch (e) {
    $('#inv-out').innerHTML = `<span class="bad">${esc(e.message)}</span>`;
    if (e.rate) window.dispatchEvent(new CustomEvent('dc:ratelimit', { detail: { retry: 60 } }));
    else guy?.set('no', 2500);
  }
}

async function forceScan() {
  if (!guy) return;
  const b = $('#force'); b.disabled = true;
  guy.terminal(true, '> force scan');
  try {
    guy.log('waking up github...');
    await sleep(700);
    await worker('/scan', { method: 'POST' });
    guy.log('scan dispatched');
    await sleep(900);
    guy.log('scanning ~1M contracts');
    await sleep(900);
    guy.log('results in like 3 min');
    S.waitingFor = S.data?.at || 0;
    await sleep(1800);
    guy.terminal(false);
    guy.say('ill ping you when its done', 2400);
    pollScan(0);
  } catch (e) {
    guy.log('ERROR: ' + e.message);
    await sleep(2000);
    guy.terminal(false);
    guy.set(e.soft ? 'no' : 'fail', 2500);
  } finally { b.disabled = false; }
}

async function pollScan(n) {
  if (n > 16) return;
  await sleep(30000);
  await load();
  if (S.data?.at && S.data.at !== S.waitingFor) { guy?.say('fresh scan is in', 2500); return; }
  pollScan(n + 1);
}

function tab(name) {
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  $$('.pane').forEach(p => p.classList.toggle('on', p.id === 'tab-' + name));
  window.dispatchEvent(new CustomEvent('dc:tab', { detail: name }));
}

async function load(manual) {
  if (manual || !S.data) guy?.set('loading');
  try {
    const bust = '?t=' + Math.floor(Date.now() / 60000);
    const [d, sk, pr, ho] = await Promise.all(['tradeups', 'skins', 'prices', 'hollow'].map(n => fetchData(`data/${n}.json`, 'json', bust).catch(() => null)));
    if (!d) throw new Error('no scan data yet');
    S.data = d; S.prices = pr?.prices || {}; S.hollow = ho?.hollow || [];
    if (sk) S.db = new Db(sk);
    renderStatus(); renderGuaranteed(); renderBrowse(); renderHollow(); renderCalc();
    if (guy) {
      const fresh = d.guaranteed.filter(g => !S.seen?.has(g.id)).length;
      if (fresh && (manual || S.seen)) { guy.setDubs(`${fresh} new`); guy.set('dubs', 3500); }
      else if (fresh && !S.seen) { guy.setDubs(`${d.guaranteed.length} found`); guy.set('dubs', 3500); }
      else if (guy.state === 'loading') guy.set('idle');
      S.seen = new Set(d.guaranteed.map(g => g.id));
    }
    if (d.rateLimited) window.dispatchEvent(new CustomEvent('dc:ratelimit', { detail: { retry: 300, scan: true } }));
    const m = location.hash.match(/#t=(.+)/);
    if (m) openTrade(find(decodeURIComponent(m[1])));
  } catch (e) {
    $('#status').innerHTML = `<span class="rl">${esc(e.message)}</span>`;
    $('#g-list').innerHTML = '<div class="empty">no scan data yet. the scanner runs every 5 min on github, check back in a bit</div>';
    guy?.set('no', 3000);
  }
}

function bind() {
  $('#tabs').onclick = e => { const b = e.target.closest('button'); if (b) tab(b.dataset.tab); };
  for (const id of ['#g-list', '#b-list']) $(id).onclick = e => { const r = e.target.closest('.tu'); if (r) openTrade(find(r.dataset.id)); };
  for (const id of ['#g-st', '#g-tier', '#g-cost', '#g-pmin', '#g-pmax', '#g-pct', '#g-sort', '#g-thin']) $(id).addEventListener('input', renderGuaranteed);
  for (const id of ['#f-tier', '#f-st', '#f-cost', '#f-win', '#f-roi', '#f-sort', '#f-q', '#f-thin', '#f-pmin', '#f-pmax', '#f-loss']) $(id).addEventListener('input', renderBrowse);
  $('#m-close').onclick = closeModal;
  $('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });
  $('#refresh').onclick = () => load(true);
  $('#force').onclick = forceScan;
  $('#snd').onclick = () => { S.settings.bg = !S.settings.bg; $('#s-bg').checked = S.settings.bg; store.set('settings', S.settings); setMusic(S.settings.bg); $('#snd').classList.toggle('off', !S.settings.bg); };
  window.addEventListener('dc:termlog', e => { const c = $('#cine-log'); c.insertAdjacentHTML('beforeend', `<div>${esc(e.detail)}</div>`); while (c.children.length > 6) c.firstChild.remove(); });

  $('#c-search').addEventListener('input', () => {
    const q = $('#c-search').value.trim().toLowerCase();
    if (!q || !S.db) { $('#c-drop').classList.remove('on'); return; }
    const hits = calcSkins().filter(s => s.n.toLowerCase().includes(q) && (!S.calc.st || s.st)).slice(0, 40);
    $('#c-drop').innerHTML = hits.map(s => `<div data-n="${esc(s.n)}">${s.img ? `<img src="${esc(s.img)}" alt="">` : ''}<span style="color:${TIER_COLORS[s.r]}">${esc(s.n)}</span></div>`).join('') || '<div class="dim">nothing</div>';
    $('#c-drop').classList.add('on');
  });
  $('#c-drop').onclick = e => { const d = e.target.closest('[data-n]'); if (!d) return; addCalc(S.db.byName.get(d.dataset.n)); $('#c-search').value = ''; $('#c-drop').classList.remove('on'); };
  $('#c-inputs').addEventListener('change', e => {
    const r = S.calc.rows[e.target.closest('.cin')?.dataset.i]; if (!r) return;
    const k = e.target.dataset.k;
    if (k === 'wi') { r.wi = +e.target.value; const [lo, hi] = wearSpan(r.skin, r.wi); r.f = +((lo + hi) / 2).toFixed(4); }
    if (k === 'f') { r.f = Math.min(r.skin.max, Math.max(r.skin.min, +e.target.value || 0)); r.wi = Math.max(0, WEARS.findIndex(w => r.f < w[3])); }
    if (k === 'k') r.k = Math.max(1, +e.target.value || 1);
    renderCalc();
  });
  $('#c-inputs').addEventListener('click', e => { if (e.target.dataset.k === 'del') { S.calc.rows.splice(e.target.closest('.cin').dataset.i, 1); renderCalc(); } });
  $('#c-st').onchange = () => { S.calc.st = $('#c-st').checked; renderCalc(); };
  $('#c-clear').onclick = () => { S.calc.rows = []; renderCalc(); };

  $('#inv-go').onclick = loadInv;
  $('#inv-id').onkeydown = e => { if (e.key === 'Enter') loadInv(); };
  $('#inv-out').onclick = e => { const b = e.target.dataset.inv; if (b === undefined) return; const r = S.invRows[b]; addCalc(r.s, r.p.wi); S.calc.st = r.p.st; $('#c-st').checked = r.p.st; tab('calc'); };

  $('#t-list').onclick = e => { const id = e.target.dataset.del; if (!id) return; S.tracker = S.tracker.filter(x => x.id != id); store.set('tracker', S.tracker); renderTracker(); renderHollow(); };
  $('#t-export').onclick = () => {
    const csv = ['date,inputs,got,paid,worth,pl', ...S.tracker.map(e => [new Date(e.at).toISOString(), e.in.map(i => i[1] + 'x ' + i[0]).join(' + '), e.out, e.cost / 100, e.value / 100, (e.value - e.cost) / 100].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'de_contract_tracker.csv' });
    a.click();
  };

  $('#h-yard').onclick = e => {
    const s = e.target.closest('.stone'); if (!s) return;
    window.dispatchEvent(new CustomEvent('dc:grave', { detail: S.hollowAll[s.dataset.h] }));
  };

  const st = S.settings;
  $('#s-worker').value = st.worker; $('#s-guy').checked = st.guy; $('#s-music').checked = st.music;
  $('#s-skin').value = st.skin; $('#s-vol').value = st.vol; $('#s-bg').checked = st.bg;
  $('#snd').classList.toggle('off', !st.bg);
  const save = () => {
    const old = S.settings.skin;
    S.settings = { worker: $('#s-worker').value.trim(), guy: $('#s-guy').checked, music: $('#s-music').checked, skin: $('#s-skin').value, vol: +$('#s-vol').value, bg: $('#s-bg').checked };
    store.set('settings', S.settings);
    $('#guy').hidden = !S.settings.guy; document.body.classList.toggle('noguy', !S.settings.guy);
    setVolume(S.settings.vol); setMusic(S.settings.bg); $('#snd').classList.toggle('off', !S.settings.bg);
    if (old !== S.settings.skin) { applySkin(); world?.setSkin(S.settings.skin || 'sas').catch(() => {}); }
  };
  for (const id of ['#s-worker', '#s-guy', '#s-music', '#s-skin', '#s-vol', '#s-bg']) $(id).addEventListener('change', save);
  $('#s-scene').onclick = () => window.dispatchEvent(new CustomEvent('dc:ratelimit', { detail: { retry: 30, manual: true } }));
  $('#guy').hidden = !st.guy;
  document.body.classList.toggle('noguy', !st.guy);
}

tierOptions($('#g-tier'));
tierOptions($('#f-tier'));
bind();
renderTracker();
soundSetup('assets/', { music: S.settings.bg, volume: S.settings.vol });
const onEvent = e => { if (sfx[e]) sfx[e](); else sfx.voice(e); };
async function applySkin() {
  if (!guy) return;
  const sk = S.settings.skin || 'sas';
  try {
    await guy.setSkin(sk);
    if (guy.spookRig?.ghost !== false) await guy.setGhost(sk === 'phoenix' ? 'sas' : 'phoenix');
  } catch (e) { await guy.setSkin('orange'); }
}
const loader = (url, type) => fetchData(url, type);
try { guy = new Guy($('#guy'), { base: 'assets/', loader, onEvent }); window.guy = guy; } catch (e) { guy = null; }
window.dc = { S, get guy() { return guy; } };
await guy?.ready;
if (await getLock()) {
  try { await guy?.setSkin('sas'); } catch (e) {}
  S.key = await unlock(guy, sfx);
}
await applySkin();
load();
setInterval(() => { if (!document.hidden) load(); }, 5 * 60000);
let world = null;
const worldStatus = () => {
  const d = S.data;
  if (!d) return {};
  const best = d.guaranteed.reduce((m, g) => Math.max(m, (g.worst - g.cost) / g.cost), -1);
  return { sure: d.guaranteed.length, best: best > -1 ? '+' + (best * 100).toFixed(0) + '%' : '--', age: ago(d.at) };
};
function toSite() {
  world?.leave();
  document.body.classList.remove('inworld');
  guy?.pause(!S.settings.guy);
}
async function toWorld() {
  if (!world) {
    const { World } = await import('./world/world.js');
    world = new World($('#world'), { loader, skin: S.settings.skin || 'sas', status: worldStatus, volume: () => S.settings.vol, onTerminal: () => { sfx.beep?.(true); toSite(); }, onEvent: e => { if (e === 'terminal') sfx.key?.(); } });
    window.dc.world = world;
    await world.ready;
  }
  guy?.pause(true);
  document.body.classList.add('inworld');
  world.enter();
}
$('#home').onclick = () => toWorld();
toWorld().catch(e => { console.error(e); toSite(); });
setInterval(renderStatus, 30000);
import('./specter.js').then(m => m.init?.(guy, S)).catch(() => {});
