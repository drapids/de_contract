const MAXB = 96;

const VS = `
attribute vec3 aP; attribute vec3 aN; attribute vec2 aU; attribute vec4 aJ; attribute vec4 aW;
uniform mat4 uB[${MAXB}]; uniform mat4 uVP; uniform mat4 uM;
varying vec3 vN; varying vec2 vU;
void main() {
  mat4 s = uB[int(aJ.x)] * aW.x + uB[int(aJ.y)] * aW.y + uB[int(aJ.z)] * aW.z + uB[int(aJ.w)] * aW.w;
  vec4 w = uM * s * vec4(aP, 1.0);
  vN = normalize(mat3(uM) * mat3(s) * aN);
  vU = aU;
  gl_Position = uVP * w;
}`;

const FS = `
precision highp float;
uniform sampler2D uT; uniform vec3 uL; uniform vec3 uAmb; uniform vec3 uSun;
varying vec3 vN; varying vec2 vU;
void main() {
  vec4 t = texture2D(uT, vU);
  if (t.a < 0.35) discard;
  vec3 n = normalize(vN);
  float d = max(dot(n, uL), 0.0);
  float rim = pow(1.0 - abs(n.y), 2.0) * 0.08;
  gl_FragColor = vec4(t.rgb * (uAmb + uSun * d) + rim, 1.0);
}`;

const qmat = (q, t, out, o = 0) => {
  const [x, y, z, w] = q, x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  out[o] = 1 - (yy + zz); out[o + 1] = xy + wz; out[o + 2] = xz - wy; out[o + 3] = 0;
  out[o + 4] = xy - wz; out[o + 5] = 1 - (xx + zz); out[o + 6] = yz + wx; out[o + 7] = 0;
  out[o + 8] = xz + wy; out[o + 9] = yz - wx; out[o + 10] = 1 - (xx + yy); out[o + 11] = 0;
  out[o + 12] = t[0]; out[o + 13] = t[1]; out[o + 14] = t[2]; out[o + 15] = 1;
  return out;
};

const mul = (a, ao, b, bo, out, oo) => {
  for (let c = 0; c < 4; c++) {
    const b0 = b[bo + c * 4], b1 = b[bo + c * 4 + 1], b2 = b[bo + c * 4 + 2], b3 = b[bo + c * 4 + 3];
    for (let r = 0; r < 4; r++) out[oo + c * 4 + r] = a[ao + r] * b0 + a[ao + 4 + r] * b1 + a[ao + 8 + r] * b2 + a[ao + 12 + r] * b3;
  }
  return out;
};

const slerp = (d, i0, i1, k, out) => {
  let ax = d[i0], ay = d[i0 + 1], az = d[i0 + 2], aw = d[i0 + 3];
  let bx = d[i1], by = d[i1 + 1], bz = d[i1 + 2], bw = d[i1 + 3];
  let dt = ax * bx + ay * by + az * bz + aw * bw;
  if (dt < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; }
  const x = ax + (bx - ax) * k, y = ay + (by - ay) * k, z = az + (bz - az) * k, w = aw + (bw - aw) * k, l = Math.hypot(x, y, z, w) || 1;
  out[0] = x / l; out[1] = y / l; out[2] = z / l; out[3] = w / l;
  return out;
};

export const WEAPON = {
  'AK-47': 'ak47', 'AUG': 'aug', 'AWP': 'awp', 'PP-Bizon': 'bizon', 'CZ75-Auto': 'cz75a', 'Desert Eagle': 'deagle', 'Dual Berettas': 'elite',
  'FAMAS': 'famas', 'Five-SeveN': 'fiveseven', 'G3SG1': 'g3sg1', 'Galil AR': 'galilar', 'Glock-18': 'glock18', 'P2000': 'hkp2000', 'M249': 'm249',
  'M4A1-S': 'm4a1_silencer', 'M4A4': 'm4a4', 'MAC-10': 'mac10', 'MAG-7': 'mag7', 'MP5-SD': 'mp5sd', 'MP7': 'mp7', 'MP9': 'mp9', 'Negev': 'negev',
  'Nova': 'nova', 'P250': 'p250', 'P90': 'p90', 'R8 Revolver': 'revolver', 'Sawed-Off': 'sawedoff', 'SCAR-20': 'scar20', 'SG 553': 'sg556',
  'SSG 08': 'ssg08', 'Zeus x27': 'taser', 'Tec-9': 'tec9', 'UMP-45': 'ump45', 'USP-S': 'usp_silencer', 'XM1014': 'xm1014',
  'Bayonet': 'knife_bayonet', 'Bowie Knife': 'knife_bowie', 'Butterfly Knife': 'knife_butterfly', 'Survival Knife': 'knife_canis', 'Paracord Knife': 'knife_cord',
  'Classic Knife': 'knife_css', 'Falchion Knife': 'knife_falchion', 'Flip Knife': 'knife_flip', 'Gut Knife': 'knife_gut', 'Karambit': 'knife_karambit',
  'Kukri Knife': 'knife_kukri', 'M9 Bayonet': 'knife_m9', 'Navaja Knife': 'knife_navaja', 'Nomad Knife': 'knife_outdoor', 'Shadow Daggers': 'knife_push',
  'Skeleton Knife': 'knife_skeleton', 'Stiletto Knife': 'knife_stiletto', 'Huntsman Knife': 'knife_tactical', 'Talon Knife': 'knife_talon', 'Ursus Knife': 'knife_ursus'
};

export function weaponKey(hash) {
  if (!hash) return null;
  const n = hash.replace('★ ', '').replace('StatTrak™ ', '').replace('Souvenir ', '').split(' | ')[0].trim();
  return WEAPON[n] || null;
}

export class CS2 {
  constructor(e, base = 'assets/cs2/') {
    this.e = e; this.base = base; this.cache = {};
    const gl = e.gl;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const p = this.prog = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    this.L = {};
    for (const n of ['aP', 'aN', 'aU', 'aJ', 'aW']) this.L[n] = gl.getAttribLocation(p, n);
    for (const n of ['uB', 'uVP', 'uM', 'uT', 'uL', 'uAmb', 'uSun']) this.L[n] = gl.getUniformLocation(p, n);
    this.tmp = new Float32Array(16); this.q = [0, 0, 0, 1]; this.t = [0, 0, 0];
    this.light = [0.35, 0.8, 0.45]; this.amb = [0.55, 0.55, 0.58]; this.sun = [0.55, 0.53, 0.5];
  }

  async skin(hash) {
    if (!hash || !hash.includes(' | ')) return null;
    try {
      this.skins ||= fetch(this.base + 'skins/index.json').then(r => r.ok ? r.json() : {}).catch(() => ({}));
      const idx = await this.skins;
      const n = hash.replace('★ ', '').replace('StatTrak™ ', '').replace('Souvenir ', '').replace(/ \((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/, '').trim();
      const f = idx[n];
      return f ? await this.e.texUrl(this.base + 'skins/' + f, true, false, true) : null;
    } catch (err) { return null; }
  }

  load(key) {
    if (!this.cache[key]) this.cache[key] = this.fetch(key).catch(err => { delete this.cache[key]; throw err; });
    return this.cache[key];
  }

  async fetch(key) {
    const e = this.e, gl = e.gl;
    const [head, bin] = await Promise.all([
      fetch(this.base + key + '.json').then(r => { if (!r.ok) throw new Error(key + ' ' + r.status); return r.json(); }),
      fetch(this.base + key + '.bin').then(r => { if (!r.ok) throw new Error(key + ' ' + r.status); return r.arrayBuffer(); })
    ]);
    const m = await this.mesh(head, bin, 0);
    if (head.mag) m.mag = await this.mesh(head.mag, bin, head.magOff);
    m.clips = {};
    for (const [name, c] of Object.entries(head.clips || {})) {
      m.clips[name] = { n: c.n, dur: c.dur, tr: c.tr.map(t => {
        const raw = new Int16Array(bin, t.off, c.n * t.bones.length * 7), d = new Float32Array(raw.length), ps = t.ps / 32767;
        for (let i = 0; i < raw.length; i++) d[i] = raw[i] * (i % 7 < 3 ? ps : 1 / 32767);
        return { skel: t.skel, map: new Map(t.bones.map((b, i) => [b, i])), nb: t.bones.length, d };
      }) };
    }
    return m;
  }

  async mesh(h, bin, base) {
    const e = this.e, gl = e.gl, o = h.off, nv = h.nv;
    const F = (k, n) => new Float32Array(bin, base + o[k], nv * n);
    const NQ = new Int8Array(bin, base + o.N, nv * 4), Nf = new Float32Array(nv * 3);
    for (let i = 0; i < nv; i++) { Nf[i * 3] = NQ[i * 4] / 127; Nf[i * 3 + 1] = NQ[i * 4 + 1] / 127; Nf[i * 3 + 2] = NQ[i * 4 + 2] / 127; }
    const WQ = new Uint8Array(bin, base + o.W, nv * 4), Wf = new Float32Array(nv * 4);
    for (let i = 0; i < Wf.length; i++) Wf[i] = WQ[i] / 255;
    const buf = (data, kind = gl.ARRAY_BUFFER) => { const b = gl.createBuffer(); gl.bindBuffer(kind, b); gl.bufferData(kind, data, gl.STATIC_DRAW); return b; };
    const J = new Float32Array(new Uint8Array(bin, base + o.J, nv * 4));
    const I = h.big ? new Uint32Array(bin, base + o.I, h.ni) : new Uint16Array(bin, base + o.I, h.ni);
    const nb = h.bones.length;
    const m = {
      p: buf(F('P', 3)), n: buf(Nf), u: buf(F('U', 2)), w: buf(Wf), j: buf(J), i: buf(I, gl.ELEMENT_ARRAY_BUFFER), big: h.big,
      bones: h.bones, nb, ibm: new Float32Array(bin, base + o.ibm, nb * 16).slice(), box: h.box,
      world: new Float32Array(nb * 16), skin: new Float32Array(Math.max(nb, 1) * 16), groups: []
    };
    m.byName = new Map(h.bones.map((b, i) => [b.n, i]));
    for (const g of h.groups) {
      if (!g.tex) continue;
      let tex = null;
      try { tex = await e.texUrl(this.base + g.tex, true, false, true); } catch (err) { tex = e.white; }
      m.groups.push({ start: g.start, count: g.count, tex });
    }
    this.bind(m);
    return m;
  }

  bind(m) {
    const w = m.world, s = m.skin, q = this.q, t = this.t;
    m.bones.forEach((b, i) => {
      qmat(b.r, b.t, w, i * 16);
      if (b.p >= 0) { mul(w, b.p * 16, w, i * 16, this.tmp, 0); w.set(this.tmp, i * 16); }
      mul(w, i * 16, m.ibm, i * 16, s, i * 16);
    });
  }

  pose(m, clip, time, loop = true) {
    const w = m.world, s = m.skin, q = this.q, t = this.t;
    let tr = null, f0 = 0, f1 = 0, k = 0;
    if (clip) {
      tr = clip.tr.find(x => m.bones.some(b => x.map.has(b.n) && b.n !== 'root_motion')) || clip.tr[0];
      if (clip.n > 1 && clip.dur > 0) {
        const fps = (clip.n - 1) / clip.dur;
        let x = time * fps;
        x = loop ? x % (clip.n - 1) : Math.min(x, clip.n - 1);
        f0 = Math.floor(x); f1 = Math.min(clip.n - 1, f0 + 1); k = x - f0;
      }
    }
    for (let i = 0; i < m.nb; i++) {
      const b = m.bones[i], ci = tr ? tr.map.get(b.n) : undefined;
      if (ci !== undefined) {
        const d = tr.d, a0 = (f0 * tr.nb + ci) * 7, a1 = (f1 * tr.nb + ci) * 7;
        t[0] = d[a0] + (d[a1] - d[a0]) * k; t[1] = d[a0 + 1] + (d[a1 + 1] - d[a0 + 1]) * k; t[2] = d[a0 + 2] + (d[a1 + 2] - d[a0 + 2]) * k;
        slerp(d, a0 + 3, a1 + 3, k, q);
        qmat(q, t, w, i * 16);
      } else qmat(b.r, b.t, w, i * 16);
      if (b.p >= 0) { mul(w, b.p * 16, w, i * 16, this.tmp, 0); w.set(this.tmp, i * 16); }
      mul(w, i * 16, m.ibm, i * 16, s, i * 16);
    }
    return m;
  }

  boneWorld(m, name, out = new Float32Array(16)) {
    const i = m.byName.get(name);
    if (i === undefined) { out.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); return out; }
    out.set(m.world.subarray(i * 16, i * 16 + 16));
    return out;
  }

  draw(m, model, skin) {
    const e = this.e, gl = e.gl, L = this.L;
    if (!m.groups.length) return;
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(L.uVP, false, e.VP);
    gl.uniformMatrix4fv(L.uM, false, model);
    gl.uniformMatrix4fv(L.uB, false, m.skin.subarray(0, Math.min(m.nb, MAXB) * 16));
    gl.uniform3fv(L.uL, this.light); gl.uniform3fv(L.uAmb, this.amb); gl.uniform3fv(L.uSun, this.sun);
    gl.uniform1i(L.uT, 0);
    gl.activeTexture(gl.TEXTURE0);
    const at = (loc, b, n) => { if (loc < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0); };
    at(L.aP, m.p, 3); at(L.aN, m.n, 3); at(L.aU, m.u, 2); at(L.aJ, m.j, 4); at(L.aW, m.w, 4);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.i);
    const type = m.big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, sz = m.big ? 4 : 2;
    m.groups.forEach((g, i) => { gl.bindTexture(gl.TEXTURE_2D, i === 0 && skin ? skin : g.tex); gl.drawElements(gl.TRIANGLES, g.count, type, g.start * sz); });
    for (const loc of [L.aJ, L.aW]) if (loc >= 0) gl.disableVertexAttribArray(loc);
    gl.useProgram(e.prog);
  }
}

export { mul as mulM, qmat };
