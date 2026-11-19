import { deriveKey, open, CHECK } from './seal.js';

let lock = null, key = null;
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export async function getLock() {
  try {
    const r = await fetch('lock.json?t=' + Math.floor(Date.now() / 60000));
    lock = r.ok ? await r.json() : null;
  } catch { lock = null; }
  return lock;
}

async function check(pass) {
  if (!pass) return false;
  try {
    const k = await deriveKey(pass);
    const t = new TextDecoder().decode(await open(k, b64(lock.check)));
    if (t === CHECK) { key = k; return true; }
  } catch {}
  return false;
}

export async function fetchData(path, type = 'json', bust = '') {
  const clean = path.replace(/\?.*$/, '');
  if (!lock?.files?.includes(clean)) {
    if (type === 'img') return path;
    const r = await fetch(path + bust);
    if (!r.ok) throw new Error(path + ' ' + r.status);
    return type === 'json' ? r.json() : r.arrayBuffer();
  }
  const r = await fetch(clean + '.enc' + bust);
  if (!r.ok) throw new Error(path + ' ' + r.status);
  const bytes = await open(key, await r.arrayBuffer());
  if (type === 'img') return URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
  if (type === 'json') return JSON.parse(new TextDecoder().decode(bytes));
  return bytes;
}

export async function unlock(guy, sfx) {
  if (!lock) return '';
  const saved = localStorage.getItem('dc.key');
  if (saved && await check(saved)) return saved;
  return new Promise(resolve => {
    const ui = document.createElement('div');
    ui.className = 'defuse';
    ui.innerHTML = `
      <div class="key">
        <div class="key-t">bomb has been planted</div>
        <div class="key-s">type the code to defuse</div>
        <input class="key-in" type="password" autocomplete="off" spellcheck="false" maxlength="64">
        <div class="key-row"><span class="key-tries">3 tries</span><button class="btn go key-go" type="button">defuse</button></div>
      </div>
      <div class="key-big"></div>`;
    document.body.append(ui);
    document.body.classList.add('defusing');
    guy?.defuse(true);
    const inp = ui.querySelector('.key-in'), big = ui.querySelector('.key-big');
    let tries = 3, busy = false;
    setTimeout(() => inp.focus(), 300);
    inp.addEventListener('input', () => { if (guy?.c4) { guy.c4.text = inp.value; guy.c4.bad = false; } sfx?.key?.(); });
    const go = async () => {
      if (busy) return;
      busy = true;
      const pass = inp.value;
      ui.classList.add('checking');
      const ok = await check(pass);
      ui.classList.remove('checking');
      if (ok) {
        localStorage.setItem('dc.key', pass);
        sfx?.ok?.(); sfx?.voice?.('defused');
        big.textContent = 'bomb has been defused';
        ui.classList.add('won');
        if (guy) { guy.c4.text = ''; guy.set('rise'); }
        setTimeout(() => {
          ui.classList.add('gone');
          guy?.defuse(false);
          document.body.classList.remove('defusing');
          setTimeout(() => ui.remove(), 600);
          resolve(pass);
        }, 2600);
        return;
      }
      tries--;
      sfx?.buzz?.();
      guy?.flinch();
      if (guy?.c4) guy.c4.bad = true;
      ui.classList.add('shake'); setTimeout(() => ui.classList.remove('shake'), 400);
      inp.value = '';
      if (tries <= 0) {
        sfx?.boom?.(); sfx?.voice?.('terrorists_win');
        big.textContent = 'terrorists win';
        ui.classList.add('boom');
        setTimeout(() => { ui.classList.remove('boom'); big.textContent = ''; tries = 3; ui.querySelector('.key-tries').textContent = '3 tries'; if (guy?.c4) guy.c4.t0 = guy.now; busy = false; inp.focus(); }, 3200);
        return;
      }
      ui.querySelector('.key-tries').textContent = tries + (tries === 1 ? ' try' : ' tries');
      busy = false;
    };
    ui.querySelector('.key-go').onclick = go;
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  });
}
