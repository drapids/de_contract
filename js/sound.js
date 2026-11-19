let ctx = null, master = null, musicBus = null, sfxBus = null, timer = null, step = 0, voices = {}, voiceList = null;
const state = { music: true, volume: 0.5, started: false, typing: true, typVol: 0.5 };
const SAMPLES = { deagle: 0.55, bought: 0.32, defused: 0.8, equip: 0.45, blyat: 0.7, typing: 1 };
const bufs = {};
let typer = null, typerGain = null, typeStop = 0, lastBlyat = 0;

const N = n => 440 * Math.pow(2, (n - 69) / 12);
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const LEAD = [76, null, 72, null, 74, 76, null, 72, 72, null, 69, null, 72, null, 74, null, 72, null, 67, null, 67, 69, null, 72, 71, null, 67, null, 74, null, 71, null];
const BPM = 92;

function init() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = state.volume; master.connect(ctx.destination);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
  musicBus = ctx.createGain(); musicBus.gain.value = 0.11; musicBus.connect(lp); lp.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.5; sfxBus.connect(master);
  for (const n of Object.keys(SAMPLES)) fetch(state.base + 'sfx/' + n + '.mp3').then(r => r.ok ? r.arrayBuffer() : null).then(b => b && ctx.decodeAudioData(b)).then(b => { if (b) bufs[n] = b; }).catch(() => {});
}

function sample(n, vol = 1, rate = 1) {
  if (!ctx || !bufs[n]) return false;
  const s = ctx.createBufferSource(), g = ctx.createGain();
  s.buffer = bufs[n]; s.playbackRate.value = rate;
  g.gain.value = SAMPLES[n] * vol;
  s.connect(g); g.connect(sfxBus); s.start();
  return s;
}

function typing() {
  if (!ctx || !state.typing || !bufs.typing) return;
  typeStop = ctx.currentTime + 0.35;
  if (!typer) {
    typerGain = ctx.createGain(); typerGain.gain.value = state.typVol;
    typerGain.connect(sfxBus);
    typer = ctx.createBufferSource(); typer.buffer = bufs.typing; typer.loop = true;
    typer.connect(typerGain); typer.start();
    const chk = () => { if (!typer) return; if (ctx.currentTime > typeStop) { try { typer.stop(); } catch (e) {} typer = null; } else setTimeout(chk, 120); };
    setTimeout(chk, 120);
  }
}

function tone(freq, t, dur, type = 'square', vol = 0.2, bus = sfxBus, slide = 0) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
}

function noise(t, dur, vol = 0.2, hp = 4000, bus = sfxBus) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur)), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = 'highpass'; f.frequency.value = hp;
  s.buffer = buf; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(bus); s.start(t);
}

function tick() {
  const spb = 60 / BPM / 2;
  const t = ctx.currentTime + 0.05;
  const bar = Math.floor(step / 8) % 4, beat = step % 8;
  const ch = CHORDS[bar];
  if (beat % 2 === 0) tone(N(ch[0] - 12), t, spb * 1.8, 'triangle', 0.5, musicBus);
  tone(N(ch[(beat % 3)] + 12), t, spb * 0.9, 'square', 0.07, musicBus);
  const l = LEAD[step % LEAD.length];
  if (l && Math.floor(step / 32) % 2 === 1) tone(N(l), t, spb * 1.6, 'triangle', 0.16, musicBus);
  if (beat % 4 === 0) tone(110, t, 0.18, 'sine', 0.6, musicBus, 0.3);
  if (beat % 4 === 2) noise(t, 0.08, 0.12, 2500, musicBus);
  noise(t, 0.03, 0.05, 8000, musicBus);
  step++;
}

function startMusic() {
  if (!ctx || timer || !state.music) return;
  timer = setInterval(tick, 60 / BPM / 2 * 1000);
}

function stopMusic() { clearInterval(timer); timer = null; }

async function loadVoices(base) {
  try {
    const r = await fetch(base + 'voice/index.json');
    voiceList = r.ok ? await r.json() : [];
  } catch { voiceList = []; }
}

function voice(event) {
  if (!voiceList?.length || !ctx) return false;
  const opts = voiceList.filter(f => f.replace(/\.[^.]+$/, '').replace(/_\d+$/, '') === event);
  if (!opts.length) return false;
  const f = opts[Math.random() * opts.length | 0];
  const a = voices[f] || (voices[f] = new Audio('assets/voice/' + f));
  a.volume = Math.min(1, state.volume * 1.4);
  a.currentTime = 0; a.play().catch(() => {});
  return true;
}

export const sfx = {
  dubs() {
    if (!ctx) return; const t = ctx.currentTime;
    [72, 76, 79, 84].forEach((n, i) => tone(N(n), t + i * 0.09, 0.25, 'square', 0.12));
    noise(t, 0.25, 0.25, 1500);
    voice('dubs');
  },
  fail() {
    if (!ctx) return; const t = ctx.currentTime;
    [67, 66, 65].forEach((n, i) => tone(N(n), t + i * 0.32, 0.3, 'sawtooth', 0.07));
    tone(N(64), t + 0.96, 0.9, 'sawtooth', 0.07, sfxBus, 0.94);
    voice('fail');
    sfx.blyat();
  },
  poke() { if (!ctx) return; if (!voice('poke')) tone(N(60 + Math.random() * 12), ctx.currentTime, 0.12, 'square', 0.1, sfxBus, 1.6); },
  typing,
  sample,
  equip() { sample('equip'); },
  bought() { sample('bought'); },
  defused() { sample('defused'); },
  blyat(force) { if (!ctx) return; const now = Date.now(); if (!force && (now - lastBlyat < 90000 || Math.random() > 0.3)) return; lastBlyat = now; sample('blyat'); },
  key() { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.025, 0.08 + Math.random() * 0.05, 3000); tone(180 + Math.random() * 60, t, 0.03, 'square', 0.03); },
  beep(hi) { if (!ctx) return; tone(hi ? 1760 : 1320, ctx.currentTime, 0.09, 'square', 0.08); },
  buzz() { if (!ctx) return; tone(110, ctx.currentTime, 0.4, 'sawtooth', 0.18); voice('wrong_code'); },
  ok() { if (!ctx) return; const t = ctx.currentTime; [76, 83].forEach((n, i) => tone(N(n), t + i * 0.12, 0.2, 'square', 0.1)); },
  boom() { if (!ctx) return; const t = ctx.currentTime; noise(t, 1.4, 0.7, 60); tone(70, t, 1.2, 'sine', 0.8, sfxBus, 0.3); },
  shot() { if (!ctx) return; if (sample('deagle', 1, 0.95 + Math.random() * 0.1)) return; const t = ctx.currentTime; noise(t, 0.18, 0.6, 400); tone(160, t, 0.12, 'square', 0.3, sfxBus, 0.3); },
  push() { if (!ctx) return; noise(ctx.currentTime, 0.6, 0.08, 200); },
  voice
};

export function setup(base = 'assets/', opts = {}) {
  Object.assign(state, opts, { base });
  loadVoices(base);
  const go = () => {
    init();
    if (ctx.state === 'suspended') ctx.resume();
    if (!state.started) { state.started = true; startMusic(); }
  };
  for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, go, { once: false, passive: true });
}

export function setMusic(on) { state.music = on; if (!ctx) return; on ? startMusic() : stopMusic(); }
export function setVolume(v) { state.volume = v; if (master) master.gain.value = v; }
export function setTyping(on, vol) { state.typing = on; if (vol != null) state.typVol = vol; if (typerGain) typerGain.gain.value = on ? state.typVol : 0; }
export function getState() { return { ...state }; }
