export function rng(seed) {
  let a = seed >>> 0;
  return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function paint(w, h, fn, seed = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  fn(x, rng(seed), w, h);
  return c;
}

export function grain(x, R, w, h, n, a, dark = true) {
  for (let i = 0; i < n; i++) {
    const v = dark ? 0 : 255;
    x.fillStyle = `rgba(${v},${v},${v},${R() * a})`;
    x.fillRect(Math.floor(R() * w), Math.floor(R() * h), 1 + Math.floor(R() * 2), 1 + Math.floor(R() * 2));
  }
}

export function blot(x, R, w, h, n, col, rmax) {
  for (let i = 0; i < n; i++) {
    const cx = R() * w, cy = R() * h, r = 4 + R() * rmax;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
}

export const T = {
  concrete: () => paint(128, 128, (x, R, w, h) => {
    x.fillStyle = '#6a6860'; x.fillRect(0, 0, w, h);
    blot(x, R, w, h, 14, 'rgba(40,36,30,.35)', 30);
    blot(x, R, w, h, 6, 'rgba(150,145,130,.25)', 24);
    grain(x, R, w, h, 2200, 0.25); grain(x, R, w, h, 900, 0.12, false);
    x.strokeStyle = 'rgba(30,28,24,.5)'; x.lineWidth = 1;
    for (let i = 0; i < 3; i++) { x.beginPath(); let px = R() * w, py = R() * h; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (R() - 0.5) * 30; py += (R() - 0.5) * 30; x.lineTo(px, py); } x.stroke(); }
  }, 3),
  wall: () => paint(128, 256, (x, R, w, h) => {
    x.fillStyle = '#b8b2a0'; x.fillRect(0, 0, w, h);
    blot(x, R, w, h * 0.55, 10, 'rgba(120,100,60,.25)', 28);
    grain(x, R, w, h, 1800, 0.12);
    const g = h * 0.55;
    x.fillStyle = '#3e5a48'; x.fillRect(0, g, w, h - g);
    x.fillStyle = '#2a3d31'; x.fillRect(0, g - 2, w, 3);
    blot(x, R, w, h, 8, 'rgba(25,30,22,.35)', 26);
    grain(x, R, w, h, 1500, 0.2);
    for (let i = 0; i < 5; i++) { const px = R() * w, py = g + R() * (h - g); x.fillStyle = 'rgba(184,178,160,.8)'; x.fillRect(px, py, 2 + R() * 6, 1 + R() * 4); }
    x.fillStyle = 'rgba(20,18,14,.5)'; x.fillRect(0, h - 6, w, 6);
  }, 5),
  ceiling: () => paint(128, 128, (x, R, w, h) => {
    x.fillStyle = '#a9a594'; x.fillRect(0, 0, w, h);
    blot(x, R, w, h, 6, 'rgba(110,90,50,.35)', 34);
    grain(x, R, w, h, 1600, 0.15);
  }, 7),
  wood: () => paint(64, 64, (x, R, w, h) => {
    x.fillStyle = '#5a3d22'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(${R() < 0.5 ? '30,18,8' : '120,84,50'},${0.2 + R() * 0.3})`; x.fillRect(0, Math.floor(R() * h), w, 1); }
    grain(x, R, w, h, 300, 0.2);
  }, 11),
  fabric: () => paint(64, 64, (x, R, w, h) => {
    x.fillStyle = '#5b3a2e'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i += 8) { x.fillStyle = 'rgba(30,15,10,.35)'; x.fillRect(i, 0, 4, h); x.fillRect(0, i, w, 4); }
    grain(x, R, w, h, 700, 0.25);
  }, 13),
  metal: (col = '#4d5a52') => paint(32, 32, (x, R, w, h) => {
    x.fillStyle = col; x.fillRect(0, 0, w, h);
    blot(x, R, w, h, 4, 'rgba(110,60,20,.4)', 8);
    grain(x, R, w, h, 200, 0.25);
  }, 17),
  door: () => paint(64, 128, (x, R, w, h) => {
    x.fillStyle = '#5e4a34'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#3a2c1c'; x.lineWidth = 3; x.strokeRect(6, 8, w - 12, h / 2 - 12); x.strokeRect(6, h / 2 + 4, w - 12, h / 2 - 12);
    x.fillStyle = '#b8a060'; x.fillRect(w - 13, h / 2 - 4, 6, 8);
    blot(x, R, w, h, 6, 'rgba(20,14,8,.4)', 14);
    grain(x, R, w, h, 500, 0.25);
  }, 19),
  asphalt: () => paint(128, 128, (x, R, w, h) => {
    x.fillStyle = '#3c3d3d'; x.fillRect(0, 0, w, h);
    grain(x, R, w, h, 3000, 0.3); grain(x, R, w, h, 1200, 0.15, false);
    blot(x, R, w, h, 5, 'rgba(10,12,14,.5)', 26);
    for (let i = 0; i < 12; i++) { x.fillStyle = `rgba(${130 + R() * 60 | 0},${70 + R() * 40 | 0},20,.8)`; x.fillRect(R() * w, R() * h, 3, 2); }
  }, 23),
  dirt: () => paint(128, 128, (x, R, w, h) => {
    x.fillStyle = '#4a4232'; x.fillRect(0, 0, w, h);
    blot(x, R, w, h, 16, 'rgba(70,80,40,.5)', 20);
    grain(x, R, w, h, 2500, 0.3);
  }, 29),
  panel: (night) => paint(256, 256, (x, R, w, h) => {
    x.fillStyle = night ? '#1c1d22' : '#9a978c'; x.fillRect(0, 0, w, h);
    if (!night) { for (let i = 0; i <= 4; i++) { x.fillStyle = 'rgba(40,40,36,.5)'; x.fillRect(0, i * 64 - 1, w, 2); } for (let i = 0; i <= 4; i++) x.fillRect(i * 64 - 1, 0, 2, h); blot(x, R, w, h, 10, 'rgba(60,55,45,.3)', 30); grain(x, R, w, h, 2500, 0.15); }
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const lit = R() < 0.35, X = c * 64 + 18, Y = r * 64 + 16;
      if (night) { if (lit) { x.fillStyle = R() < 0.3 ? '#9fb8ff' : '#ffcc77'; x.fillRect(X, Y, 28, 34); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(X + 13, Y, 2, 34); } continue; }
      x.fillStyle = '#2d3236'; x.fillRect(X, Y, 28, 34);
      x.fillStyle = '#d8d6cc'; x.fillRect(X - 2, Y - 2, 32, 2); x.fillRect(X - 2, Y + 34, 32, 3); x.fillRect(X + 13, Y, 2, 34);
      x.fillStyle = 'rgba(160,190,210,.25)'; x.fillRect(X + 2, Y + 2, 9, 14);
      if (R() < 0.3) { x.fillStyle = '#6b5a3a'; x.fillRect(X - 4, Y + 36, 36, 10); }
    }
  }, 31),
  garage: () => paint(128, 64, (x, R, w, h) => {
    x.fillStyle = '#5a6458'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i += 4) { x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(i, 0, 1, h); }
    blot(x, R, w, h, 10, 'rgba(120,60,20,.5)', 14);
    grain(x, R, w, h, 900, 0.25);
    x.fillStyle = 'rgba(230,230,230,.7)'; x.font = 'bold 14px monospace'; x.fillText(String(10 + Math.floor(R() * 80)), 8, 20);
  }, 37),
  brick: () => paint(128, 128, (x, R, w, h) => {
    x.fillStyle = '#5a3a2c'; x.fillRect(0, 0, w, h);
    for (let r = 0; r < 16; r++) for (let c = 0; c < 5; c++) { x.fillStyle = `rgb(${110 + R() * 40 | 0},${55 + R() * 20 | 0},${40 + R() * 15 | 0})`; x.fillRect(c * 28 + (r % 2) * 14 - 14, r * 8, 26, 6); }
    grain(x, R, w, h, 1500, 0.2);
  }, 41)
};
