const VIDEO = '1ms2zLJT1iA';
let guy = null, S = null, running = false, timer = null, music = null, overlay = null, lastStale = 0;

function makeOverlay() {
  overlay = document.createElement('div');
  overlay.className = 'rl-box';
  overlay.innerHTML = '<b>steam said slow down</b><span class="rl-count"></span><button class="btn" type="button">skip</button>';
  overlay.querySelector('button').onclick = stop;
  document.querySelector('#stage').append(overlay);
}

function playMusic() {
  if (!S?.settings?.music) return;
  music = document.createElement('iframe');
  music.className = 'rl-music';
  music.allow = 'autoplay; encrypted-media';
  music.src = `https://www.youtube-nocookie.com/embed/${VIDEO}?autoplay=1&controls=0&loop=1&playlist=${VIDEO}`;
  document.body.append(music);
}

function stop() {
  clearInterval(timer);
  music?.remove(); music = null;
  overlay?.classList.remove('on');
  if (running) guy?.endScene();
  running = false;
}

function start(detail = {}) {
  if (running || !guy?.clips) return;
  if (detail.scan) {
    const key = 'dc.rlseen';
    const at = S?.data?.at;
    if (sessionStorage.getItem(key) == at) return;
    sessionStorage.setItem(key, at);
  }
  running = true;
  if (!overlay) makeOverlay();
  let left = Math.max(22, Math.round(detail.retry || 30));
  const tick = () => {
    overlay.querySelector('.rl-count').textContent = detail.scan && !detail.manual ? `the scanner got rate limited, prices might be a bit old. ${left}s` : `try again in ${left}s`;
    if (left-- <= 0) stop();
  };
  overlay.classList.add('on');
  tick();
  timer = setInterval(tick, 1000);
  playMusic();
  guy.scene(Math.random() < 0.25 ? 'flip' : 'normal', () => { if (document.querySelector('#tab-hollow.on')) guy.haunt(true); });
}

export function init(g, state) {
  guy = g; S = state;
  if (!guy) return;
  window.addEventListener('dc:ratelimit', e => start(e.detail));
  window.addEventListener('dc:stale', () => {
    if (running || Date.now() - lastStale < 10 * 60000) return;
    lastStale = Date.now();
    guy.peek();
    setTimeout(() => guy.say('these prices are kinda old ngl', 2200), 1400);
  });
  window.addEventListener('dc:tab', e => { if (!running) guy.haunt(e.detail === 'hollow'); });
  window.addEventListener('dc:grave', e => {
    const h = e.detail;
    if (!h || running) return;
    const usd = c => '$' + (c / 100).toFixed(2);
    const mins = h.born ? Math.max(1, Math.round((h.died - h.born) / 60000)) : 0;
    guy.cast(h.kind === 'l'
      ? `${h.out}. you paid ${usd(h.cost)} and got ${usd(h.value)}. it stays here now`
      : `this one lived ${mins} min. would've paid ${usd(h.worst - h.cost)} minimum. too slow`);
  });
}
