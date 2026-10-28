// 137.5° — procedural motion film engine (adapted from films/pi).
// Everything is a pure function of time t (seconds), so any frame can be
// rendered independently: live preview in a browser, or parallel offline
// rendering through render.js.

const W = 1920, H = 1080, CX = W / 2, CY = H / 2;
const FPS = 60, DURATION = 90;

// ─── palette ────────────────────────────────────────────────────────────────
const C = {
  gold: [255, 190, 70],
  amber: [255, 132, 40],
  green: [70, 255, 170],
  rose: [255, 70, 135],
  cyan: [90, 215, 255],
  white: [240, 246, 255],
};
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a < 0 ? 0 : a > 1 ? 1 : a})`;
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hot = (c, k = 0.6) => mixc(c, [255, 255, 255], k);

// ─── math & easing ──────────────────────────────────────────────────────────
const PI = Math.PI, TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const smooth = (t) => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const io2 = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const io3 = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const io5 = (t) => (t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2);
const o5 = (t) => 1 - (1 - t) ** 5;
const iosine = (t) => -(Math.cos(PI * t) - 1) / 2;
const oexpo = (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
const iexpo = (t) => (t <= 0 ? 0 : 2 ** (10 * t - 10));
const o3 = (t) => 1 - (1 - t) ** 3;
const i3 = (t) => t * t * t;
const oback = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; };
const bump = (t, c, w) => Math.exp(-(((t - c) / w) ** 2));
// one-sided flash: instant rise at c, exponential decay
const flash = (t, c, d = 0.25) => (t < c ? 0 : Math.exp(-(t - c) / d));
const win = (t, a, b, fi = 0.4, fo = 0.4) => smooth(seg(t, a, a + fi)) * (1 - smooth(seg(t, b - fo, b)));

// keyframe track: keys = [[t, v, ease?], ...]; ease applies to the segment ending at that key
function track(t, keys, log = false) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const k0 = keys[i - 1], k1 = keys[i];
    if (t < k1[0]) {
      const e = (k1[2] || io3)((t - k0[0]) / (k1[0] - k0[0]));
      return log ? Math.exp(lerp(Math.log(k0[1]), Math.log(k1[1]), e)) : lerp(k0[1], k1[1], e);
    }
  }
  return keys[keys.length - 1][1];
}

// seeded PRNG so every frame is reproducible
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (n) => { const r = rng(n * 7919 + 13); r(); return r(); };

// ─── vectors & camera ───────────────────────────────────────────────────────
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const vlerp = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rotY = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; };
const rotX = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; };
const rotZ = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; };

function camera(pos, target, fov = 40, roll = 0) {
  const f = norm(sub(target, pos));
  // looking straight up or down: take "up" from world z instead of y
  const r0 = norm(cross(Math.abs(f[1]) > 0.999 ? [0, 0, 1] : [0, 1, 0], f));
  const u0 = cross(f, r0);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const r = add(mul(r0, cr), mul(u0, sr));
  const u = sub(mul(u0, cr), mul(r0, sr));
  const dist = Math.hypot(...sub(target, pos));
  return { pos, target, f, r, u, fov, roll, near: Math.min(0.02, dist * 0.05), F: (H / 2) / Math.tan((fov * PI) / 360), dist };
}
// orbit camera around target: distance D, yaw (around y), pitch (around x)
function orbitCam(target, D, yaw = 0, pitch = 0, fov = 40, roll = 0) {
  const off = [Math.sin(yaw) * Math.cos(pitch) * D, Math.sin(pitch) * D, -Math.cos(yaw) * Math.cos(pitch) * D];
  return camera(add(target, off), target, fov, roll);
}
function proj(cam, p) {
  const d = sub(p, cam.pos);
  const z = dot3(d, cam.f);
  if (z < cam.near) return null;
  const s = cam.F / z;
  return { x: CX + dot3(d, cam.r) * s, y: CY - dot3(d, cam.u) * s, z, s };
}

// ─── canvases ───────────────────────────────────────────────────────────────
let SC = 1;            // output scale (1 = 1080p, 2 = 4K)
let S, X;              // scene canvas (additive light)
let OUT, O;            // final composite
let B1, B1x, B2, B2x, B3, B3x, CR, CRx, CG, CGx;
let GRAIN = [];
let GA = 1;            // global alpha multiplier for the element being drawn
const SPR = {};        // soft dot sprites per colour
let RING;

function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function initCanvases(outCanvas, scale) {
  SC = scale;
  OUT = outCanvas; OUT.width = W * SC; OUT.height = H * SC; O = OUT.getContext('2d');
  S = mk(W * SC, H * SC); X = S.getContext('2d');
  B1 = mk((W * SC) / 4, (H * SC) / 4); B1x = B1.getContext('2d');
  B2 = mk((W * SC) / 8, (H * SC) / 8); B2x = B2.getContext('2d');
  B3 = mk((W * SC) / 16, (H * SC) / 16); B3x = B3.getContext('2d');
  CR = mk(W * SC, H * SC); CRx = CR.getContext('2d');
  CG = mk(W * SC, H * SC); CGx = CG.getContext('2d');
  // film grain tiles
  const r = rng(99);
  GRAIN = [];
  for (let k = 0; k < 6; k++) {
    const g = mk(256, 256), gx = g.getContext('2d');
    const im = gx.createImageData(256, 256);
    for (let i = 0; i < im.data.length; i += 4) {
      const v = (r() + r() + r()) / 3;
      const c = v * 255;
      im.data[i] = c; im.data[i + 1] = c; im.data[i + 2] = c * 1.05; im.data[i + 3] = 255;
    }
    gx.putImageData(im, 0, 0);
    GRAIN.push(g);
  }
  for (const [name, col] of Object.entries(C)) SPR[name] = makeDot(col);
  SPR.hot = makeDot([255, 250, 240]);
  RING = makeRing();
}

function makeDot(col) {
  const c = mk(128, 128), g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, rgba(hot(col, 0.85), 1));
  gr.addColorStop(0.12, rgba(hot(col, 0.4), 0.85));
  gr.addColorStop(0.35, rgba(col, 0.32));
  gr.addColorStop(0.7, rgba(col, 0.07));
  gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return c;
}
function makeRing() {
  const c = mk(128, 128), g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 30, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.7, 'rgba(255,255,255,0.5)');
  gr.addColorStop(0.85, 'rgba(255,255,255,0.15)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return c;
}

// ─── fonts ──────────────────────────────────────────────────────────────────
const FONT = {
  thin: (px) => `200 ${px}px InterX`,
  light: (px) => `300 ${px}px InterX`,
  mono: (px) => `300 ${px}px JBM`,
  title: (px) => `900 ${px}px InterTitle`,
};
async function loadFonts(base = 'fonts/') {
  const faces = [
    ['InterX', 'Inter-ExtraLight.otf', { weight: '200' }],
    ['InterX', 'Inter-Light.otf', { weight: '300' }],
    ['JBM', 'JetBrainsMono-Light.ttf', { weight: '300' }],
    ['InterTitle', 'InterDisplay-Black.otf', { weight: '900' }],
  ];
  await Promise.all(faces.map(async ([fam, file, desc]) => {
    const f = new FontFace(fam, `url(${base}${file})`, desc);
    await f.load(); document.fonts.add(f);
  }));
}

// ─── drawing primitives (all additive, into X) ──────────────────────────────
function neon(col, w, a, core = 0.55) {
  if (a <= 0.002) return;
  X.globalAlpha = GA;
  X.lineCap = 'round'; X.lineJoin = 'round';
  X.strokeStyle = rgba(col, a * 0.22); X.lineWidth = w * 3.6; X.stroke();
  X.strokeStyle = rgba(col, a * 0.9); X.lineWidth = w; X.stroke();
  if (core > 0) { X.strokeStyle = rgba(hot(col, 0.7), a * core); X.lineWidth = Math.max(0.6, w * 0.4); X.stroke(); }
}
function thin(col, w, a) {
  if (a <= 0.002) return;
  X.globalAlpha = GA; X.lineCap = 'round'; X.lineJoin = 'round';
  X.strokeStyle = rgba(col, a); X.lineWidth = w; X.stroke();
}
function sprite(img, x, y, rx, ry, a) {
  if (a <= 0.002 || rx < 0.05) return;
  X.globalAlpha = clamp(GA * a);
  X.drawImage(img, x - rx, y - ry, rx * 2, ry * 2);
  X.globalAlpha = GA;
}
const glow = (x, y, r, col, a) => sprite(SPR[col], x, y, r, r, a);

// lens flare: core, halo, anamorphic streak and a few ghosts mirrored through centre
function lensFlare(x, y, size, col, a, ghosts = true) {
  if (a <= 0.002) return;
  glow(x, y, size * 0.35, 'hot', a);
  glow(x, y, size * 1.4, col, a * 0.7);
  glow(x, y, size * 4, col, a * 0.18);
  sprite(SPR[col], x, y, size * 9, size * 0.16, a * 0.75);
  sprite(SPR.hot, x, y, size * 4, size * 0.05, a * 0.6);
  sprite(SPR[col], x, y, size * 0.08, size * 2.2, a * 0.25);
  if (ghosts) {
    const dx = x - CX, dy = y - CY;
    [[-0.45, 0.35, 'rose'], [-0.9, 0.18, 'green'], [0.35, 0.22, 'gold'], [-1.4, 0.5, 'amber']].forEach(([k, s, c]) => {
      const gx = CX + dx * k, gy = CY + dy * k;
      sprite(RING, gx, gy, size * s * 2.5, size * s * 2.5, a * 0.12);
      glow(gx, gy, size * s * 1.6, c, a * 0.08);
    });
  }
}

function pathPts(pts, closed = false) {
  X.beginPath();
  let pen = false;
  for (const q of pts) {
    if (!q) { pen = false; continue; }
    if (!pen) { X.moveTo(q.x, q.y); pen = true; } else X.lineTo(q.x, q.y);
  }
  if (closed && pen) X.closePath();
}
function path3(cam, pts, closed = false) { pathPts(pts.map((p) => proj(cam, p)), closed); }

// world-space polyline helpers
function circlePts(c, r, a0 = 0, a1 = TAU, n = 160, plane = 'xy') {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    if (plane === 'xy') out.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, c[2]]);
    else out.push([c[0] + Math.cos(a) * r, c[1], c[2] + Math.sin(a) * r]);
  }
  return out;
}
// truncate a polyline to fraction p of its length
function partial(pts, p) {
  if (p >= 1) return pts;
  if (p <= 0) return [];
  const L = []; let tot = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(...sub(pts[i], pts[i - 1])); L.push(d); tot += d; }
  let acc = 0; const out = [pts[0]], goal = tot * p;
  for (let i = 1; i < pts.length; i++) {
    if (acc + L[i - 1] >= goal) { out.push(vlerp(pts[i - 1], pts[i], (goal - acc) / (L[i - 1] || 1))); break; }
    acc += L[i - 1]; out.push(pts[i]);
  }
  return out;
}
function dashed3(cam, pts, col, w, a, dash = [4, 8], off = 0) {
  path3(cam, pts);
  X.setLineDash(dash.map((d) => d)); X.lineDashOffset = off;
  thin(col, w, a);
  X.setLineDash([]);
}

// text drawn as light
function text(str, x, y, px, font, col, a, align = 'center', base = 'alphabetic') {
  if (a <= 0.002) return;
  X.globalAlpha = GA;
  X.font = font(px); X.textAlign = align; X.textBaseline = base;
  X.fillStyle = rgba(col, a); X.fillText(str, x, y);
  X.fillStyle = rgba(hot(col, 0.8), a * 0.35); X.fillText(str, x, y);
}

// sample the filled pixels of a glyph -> points in a unit box centred at 0 (y up)
function sampleGlyph(str, font, px, step, jitterSeed = 1) {
  const c = mk(px * str.length * 1.2 + 40, px * 1.6), g = c.getContext('2d');
  g.font = font(px); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#fff'; g.fillText(str, c.width / 2, c.height / 2);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const r = rng(jitterSeed), pts = [];
  let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
  for (let y = 0; y < c.height; y += step) for (let x = 0; x < c.width; x += step) {
    if (d[(y * c.width + x) * 4 + 3] > 140) {
      pts.push([x + (r() - 0.5) * step * 0.6, y + (r() - 0.5) * step * 0.6]);
      minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y);
    }
  }
  const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2, hgt = maxy - miny;
  return { pts: pts.map(([x, y]) => [(x - cx) / hgt, -(y - cy) / hgt]), aspect: (maxx - minx) / hgt };
}

// ─── atmospheric dust with depth of field ───────────────────────────────────
const DUST = (() => {
  const r = rng(7), out = [];
  for (let i = 0; i < 260; i++) {
    out.push({
      p: [(r() - 0.5) * 22, (r() - 0.5) * 13, -3 + r() * 16],
      v: [(r() - 0.5) * 0.05, 0.02 + r() * 0.05, (r() - 0.5) * 0.04],
      s: 0.006 + r() * 0.014,
      col: ['gold', 'green', 'amber', 'white'][(r() * 4.4) | 0] || 'gold',
      ph: r() * TAU,
    });
  }
  return out;
})();
// drawn relative to the camera target, scaled with camera distance
function dust(cam, t, a, k = cam.dist / 6) {
  if (a <= 0.01) return;
  const focus = cam.dist;
  for (const d of DUST) {
    let p = add(d.p, mul(d.v, t));
    p = [((p[0] + 11) % 22 + 22) % 22 - 11, ((p[1] + 6.5) % 13 + 13) % 13 - 6.5, p[2]];
    const w = add(cam.target, mul(p, k));
    const q = proj(cam, w);
    if (!q || q.x < -80 || q.x > W + 80 || q.y < -80 || q.y > H + 80) continue;
    const coc = Math.abs(1 / q.z - 1 / focus) * cam.F * 0.02 * k;
    const r0 = Math.max(1.0, d.s * k * q.s * 0.6);
    const r = r0 + coc;
    if (r > 40) continue;
    const tw = 0.6 + 0.4 * Math.sin(t * 1.3 + d.ph);
    if (coc > 3) sprite(RING, q.x, q.y, r, r, a * tw * 0.18 / (1 + coc * 0.08));
    glow(q.x, q.y, r * 1.6, d.col, a * tw * 0.4 / (1 + coc * 0.25));
  }
}

// ─── post: bloom, chromatic aberration, vignette, grain ─────────────────────
let EXPOSURE = 1, BGA = 1, CA_KICK = 0;
function composite(t) {
  const w = W * SC, h = H * SC;
  // bloom pyramid
  B1x.filter = `blur(${2 * SC}px)`; B1x.globalCompositeOperation = 'copy'; B1x.drawImage(S, 0, 0, w / 4, h / 4);
  B2x.filter = `blur(${3 * SC}px)`; B2x.globalCompositeOperation = 'copy'; B2x.drawImage(B1, 0, 0, w / 8, h / 8);
  B3x.filter = `blur(${4 * SC}px)`; B3x.globalCompositeOperation = 'copy'; B3x.drawImage(B2, 0, 0, w / 16, h / 16);
  // chromatic split
  CRx.globalCompositeOperation = 'copy'; CRx.drawImage(S, 0, 0);
  CRx.globalCompositeOperation = 'multiply'; CRx.fillStyle = '#ff0000'; CRx.fillRect(0, 0, w, h);
  CGx.globalCompositeOperation = 'copy'; CGx.drawImage(S, 0, 0);
  CGx.globalCompositeOperation = 'multiply'; CGx.fillStyle = '#00ffff'; CGx.fillRect(0, 0, w, h);

  O.setTransform(1, 0, 0, 1, 0, 0);
  O.globalAlpha = 1; O.globalCompositeOperation = 'source-over';
  O.fillStyle = '#05060A'; O.fillRect(0, 0, w, h);
  const bg = O.createRadialGradient(w / 2, h * 0.5, 0, w / 2, h * 0.5, w * 0.62);
  bg.addColorStop(0, `rgba(34,26,14,${0.42 * BGA})`);
  bg.addColorStop(0.5, `rgba(14,20,16,${0.26 * BGA})`);
  bg.addColorStop(1, 'rgba(5,6,10,0)');
  O.fillStyle = bg; O.fillRect(0, 0, w, h);

  O.globalCompositeOperation = 'lighter';
  O.globalAlpha = EXPOSURE;
  O.drawImage(CG, 0, 0);
  const ca = 0.0022 + 0.006 * CA_KICK; // radial-ish CA: red channel scaled outward, kicked on impacts
  O.drawImage(CR, -w * ca, -h * ca, w * (1 + 2 * ca), h * (1 + 2 * ca));
  O.globalAlpha = EXPOSURE * 0.75; O.drawImage(B1, 0, 0, w, h);
  O.globalAlpha = EXPOSURE * 0.7; O.drawImage(B2, 0, 0, w, h);
  O.globalAlpha = EXPOSURE * 0.8; O.drawImage(B3, 0, 0, w, h);

  // vignette
  O.globalCompositeOperation = 'source-over'; O.globalAlpha = 1;
  const vg = O.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.66);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.72)');
  O.fillStyle = vg; O.fillRect(0, 0, w, h);

  // grain
  const fi = Math.floor(t * FPS);
  const g = GRAIN[fi % GRAIN.length];
  O.globalCompositeOperation = 'lighter'; O.globalAlpha = 0.045;
  const ox = (hash(fi) * 256) | 0, oy = (hash(fi + 77) * 256) | 0;
  O.fillStyle = O.createPattern(g, 'repeat');
  O.translate(-ox, -oy); O.fillRect(ox, oy, w, h); O.setTransform(1, 0, 0, 1, 0, 0);
  O.globalCompositeOperation = 'source-over'; O.globalAlpha = 1;
}

function beginScene() {
  X.setTransform(1, 0, 0, 1, 0, 0);
  X.globalCompositeOperation = 'source-over'; X.globalAlpha = 1; X.filter = 'none';
  X.fillStyle = '#000'; X.fillRect(0, 0, W * SC, H * SC);
  X.setTransform(SC, 0, 0, SC, 0, 0);
  X.globalCompositeOperation = 'lighter';
  GA = 1;
}

// render one frame; sub > 1 accumulates sub-frames across the shutter for motion blur
let ACC, ACCx;
function renderFrame(t, sub = 1, shutter = 0.5 / FPS) {
  if (sub === 'auto') sub = blurSubs(t); // shots.js decides where motion blur is worth it
  if (sub <= 1) { beginScene(); drawFilm(t); }
  else {
    if (!ACC) { ACC = mk(W * SC, H * SC); ACCx = ACC.getContext('2d'); }
    ACCx.globalCompositeOperation = 'source-over'; ACCx.globalAlpha = 1;
    ACCx.fillStyle = '#000'; ACCx.fillRect(0, 0, W * SC, H * SC);
    for (let k = 0; k < sub; k++) {
      beginScene(); drawFilm(t - (shutter * k) / (sub - 1));
      ACCx.globalCompositeOperation = 'lighter'; ACCx.globalAlpha = 1 / sub; ACCx.drawImage(S, 0, 0);
    }
    X.setTransform(1, 0, 0, 1, 0, 0); X.globalCompositeOperation = 'copy'; X.globalAlpha = 1; X.drawImage(ACC, 0, 0);
  }
  EXPOSURE = exposure(t);
  BGA = background(t);
  CA_KICK = aberration(t);
  composite(t);
}
