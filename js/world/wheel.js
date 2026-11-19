const ORDER = [1, 3, 1, 5, 1, 3, 1, 10, 1, 3, 1, 5, 1, 20, 1, 3, 1, 5, 1, 3, 1, 10, 1, 5, 3];
const COL = { 1: '#c9b37e', 3: '#5f9e48', 5: '#3a78b8', 10: '#8a46a8', 20: '#c23b2b' };
const NUMS = [1, 3, 5, 10, 20];

export class Wheel {
  constructor(w) {
    this.w = w;
    const el = this.el = document.createElement('div');
    el.className = 'wheel';
    el.hidden = true;
    el.innerHTML = `<div class="wh-win win"><div class="dlg-t"><span>колесо · scrap</span><button class="x" data-x>x</button></div>
      <div class="wh-body"><canvas width="300" height="300"></canvas><div class="wh-side">
      <div class="wh-chips">${[5, 10, 25, 50].map((c, i) => `<button class="btn${i === 1 ? ' on' : ''}" data-c="${c}">${c}</button>`).join('')}</div>
      <div class="wh-nums">${NUMS.map(n => `<button class="wh-n" data-n="${n}" style="--c:${COL[n]}"><b>${n}x</b><span>0</span></button>`).join('')}</div>
      <div class="row"><button class="btn go" data-spin>крутить</button><button class="btn" data-clear>сброс</button></div>
      <div class="wh-msg dim"></div></div></div></div>`;
    w.ui.append(el);
    this.$ = s => el.querySelector(s);
    this.cv = this.$('canvas');
    this.chip = 10;
    this.bets = {};
    this.rot = 0;
    this.$('[data-x]').onclick = () => this.close();
    el.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { this.chip = +b.dataset.c; el.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x === b)); });
    el.querySelectorAll('[data-n]').forEach(b => b.onclick = () => this.bet(+b.dataset.n));
    this.$('[data-spin]').onclick = () => this.spin();
    this.$('[data-clear]').onclick = () => { if (this.spinning) return; const t = Object.values(this.bets).reduce((a, b) => a + b, 0); if (t) this.w.bank.add(0, t); this.bets = {}; this.ui(); };
    addEventListener('keydown', e => { if (this.on && e.key === 'Escape') this.close(); });
  }

  open() {
    this.on = true; this.w.busy = true; this.el.hidden = false;
    this.ui(); this.draw();
    this.msg('ставь скрап на число. выпало — получаешь x ставку + ставку назад');
  }

  close() {
    if (this.spinning) return;
    const t = Object.values(this.bets).reduce((a, b) => a + b, 0);
    if (t) this.w.bank.add(0, t);
    this.bets = {};
    this.on = false; this.w.busy = false; this.el.hidden = true;
  }

  msg(t) { this.$('.wh-msg').textContent = t; }

  bet(n) {
    if (this.spinning) return;
    if (!this.w.bank.spend(0, this.chip)) { this.msg('скрапа нет. продай что-нибудь хазмату или жди аирдроп'); return; }
    this.bets[n] = (this.bets[n] || 0) + this.chip;
    this.w.opts.sfx?.key?.();
    this.ui();
  }

  ui() {
    this.el.querySelectorAll('[data-n]').forEach(b => b.querySelector('span').textContent = this.bets[b.dataset.n] || 0);
  }

  draw() {
    const x = this.cv.getContext('2d'), c = 150, R = 140, n = ORDER.length, a0 = this.rot;
    x.clearRect(0, 0, 300, 300);
    x.fillStyle = '#2a2a24'; x.beginPath(); x.arc(c, c, R + 8, 0, 7); x.fill();
    for (let i = 0; i < n; i++) {
      const s = a0 + i / n * Math.PI * 2 - Math.PI / 2, e = s + Math.PI * 2 / n;
      x.fillStyle = COL[ORDER[i]]; x.beginPath(); x.moveTo(c, c); x.arc(c, c, R, s, e); x.closePath(); x.fill();
      x.strokeStyle = '#1a1a14'; x.lineWidth = 2; x.stroke();
      x.save(); x.translate(c, c); x.rotate((s + e) / 2); x.fillStyle = '#111'; x.font = 'bold 15px Impact, sans-serif'; x.textAlign = 'right'; x.fillText(ORDER[i], R - 10, 5); x.restore();
    }
    x.fillStyle = '#3b3b33'; x.beginPath(); x.arc(c, c, 30, 0, 7); x.fill();
    x.strokeStyle = '#6b6b5c'; x.lineWidth = 4; x.stroke();
    x.fillStyle = '#e8e2c8'; x.beginPath(); x.moveTo(c - 11, 2); x.lineTo(c + 11, 2); x.lineTo(c, 24); x.closePath(); x.fill();
  }

  spin() {
    if (this.spinning) return;
    const total = Object.values(this.bets).reduce((a, b) => a + b, 0);
    if (!total) { this.msg('сначала поставь'); return; }
    this.spinning = true;
    const n = ORDER.length, win = Math.random() * n | 0;
    const target = -(win + 0.5) / n * Math.PI * 2 + (Math.random() - 0.5) * (Math.PI * 2 / n) * 0.7;
    const from = this.rot % (Math.PI * 2), to = target - Math.PI * 2 * 6;
    const T = 6500, t0 = performance.now();
    let lastSeg = -1;
    const step = now => {
      const k = Math.min(1, (now - t0) / T), e = 1 - Math.pow(1 - k, 3);
      this.rot = from + (to - from) * e;
      const seg = Math.floor(((-this.rot / (Math.PI * 2)) * n % n + n) % n);
      if (seg !== lastSeg) { lastSeg = seg; this.w.opts.sfx?.key?.(); }
      this.draw();
      if (k < 1) requestAnimationFrame(step);
      else this.done(ORDER[win]);
    };
    requestAnimationFrame(step);
  }

  done(num) {
    this.spinning = false;
    const b = this.bets[num] || 0, pay = b ? b * (num + 1) : 0;
    const lost = Object.values(this.bets).reduce((a, x) => a + x, 0) - b;
    this.bets = {};
    this.ui();
    if (pay) { this.w.bank.add(0, pay); this.msg(`выпало ${num}x. +${pay} scrap`); this.w.opts.sfx?.[num >= 10 ? 'dubs' : 'ok']?.(); this.w.say(num >= 10 ? ['ЕЕЕЕ', 'джекпот блять'] : ['норм', 'забрал']); }
    else { this.msg(`выпало ${num}x. минус ${lost}`); this.w.say(['сука', 'казино всегда побеждает', 'ещё разок']); }
  }
}
