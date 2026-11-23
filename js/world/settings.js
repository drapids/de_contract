const KEY = 'dc.set';
const DEF = { sens: 2.2, fov: 90, vmfov: 68, fps: true, invert: false };

export const set = (() => {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}
  return { ...DEF, ...s };
})();

export const save = () => { try { localStorage.setItem(KEY, JSON.stringify(set)); } catch {} };

export const lookK = () => set.sens * 0.022 * Math.PI / 180;

export const vfov = (h, asp) => 2 * Math.atan(Math.tan(h * Math.PI / 360) * 0.75) * Math.max(1, (4 / 3) / asp);

export class Settings {
  constructor(w) {
    this.w = w;
    const el = this.el = document.createElement('div');
    el.className = 'setw';
    el.hidden = true;
    el.innerHTML = `<div class="win set-win"><div class="dlg-t"><span>settings</span><button class="x" data-x>x</button></div>
      <div class="set-body">
        <label>sensitivity <input class="inp" type="number" step="0.01" min="0.05" max="20" data-k="sens"></label>
        <input type="range" min="0.1" max="8" step="0.01" data-r="sens">
        <p class="dim">same scale as cs2 so just put your cs sens</p>
        <label>fov <input class="inp" type="number" step="1" min="70" max="130" data-k="fov"></label>
        <input type="range" min="70" max="130" step="1" data-r="fov">
        <label>viewmodel fov <input class="inp" type="number" step="1" min="54" max="90" data-k="vmfov"></label>
        <input type="range" min="54" max="90" step="1" data-r="vmfov">
        <label class="chk"><input type="checkbox" data-c="fps"> show fps</label>
        <label class="chk"><input type="checkbox" data-c="invert"> invert mouse</label>
        <div class="row"><button class="btn" data-def>reset</button><button class="btn" data-ok>done</button></div>
      </div></div>`;
    w.ui.append(el);
    const $ = s => el.querySelectorAll(s);
    const sync = () => {
      $('[data-k]').forEach(i => { if (document.activeElement !== i) i.value = set[i.dataset.k]; });
      $('[data-r]').forEach(i => i.value = set[i.dataset.r]);
      $('[data-c]').forEach(i => i.checked = !!set[i.dataset.c]);
    };
    this.sync = sync;
    $('[data-k]').forEach(i => i.oninput = () => { const v = parseFloat(i.value); if (v > 0) { set[i.dataset.k] = v; save(); sync(); } });
    $('[data-r]').forEach(i => i.oninput = () => { set[i.dataset.r] = parseFloat(i.value); save(); sync(); });
    $('[data-c]').forEach(i => i.onchange = () => { set[i.dataset.c] = i.checked; save(); });
    el.querySelector('[data-def]').onclick = () => { Object.assign(set, DEF); save(); sync(); };
    el.querySelector('[data-x]').onclick = el.querySelector('[data-ok]').onclick = () => this.close();
    addEventListener('keydown', e => { if (e.key === 'Escape' && this.on) { e.stopImmediatePropagation(); this.close(); } }, true);
  }

  open() {
    this.on = true;
    this.el.hidden = false;
    this.sync();
    document.exitPointerLock?.();
  }

  close() {
    this.on = false;
    this.el.hidden = true;
  }
}
