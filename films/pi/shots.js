// π — the eight shots. Timings here are mirrored in audio.py (CUES).

const PI_DIGITS = piDigits(4700);
let GLYPH_PI, GLYPH_PI_RATIO, PARTS_PI, EQ, EQ_PTS, GIANT;

function initShots() {
  // π glyph sampled into ~1500 particle targets
  const g = sampleGlyph('π', FONT.serif, 420, 7, 3);
  GLYPH_PI = g.pts;
  // ink height / font px — needed to draw crisp glyphs at a given world height
  GLYPH_PI_RATIO = inkRatio('π', FONT.serif);
  const r = rng(11);
  // shot 2 particle sources: ribbon, wheel ghost, diameter copies, digits
  PARTS_PI = GLYPH_PI.map((e, i) => {
    const k = r();
    let s;
    if (k < 0.42) s = [-PI + r() * TAU, -1 + (r() - 0.5) * 0.02, 0];
    else if (k < 0.62) { const a = r() * TAU; s = [PI + Math.cos(a), Math.sin(a), 0]; }
    else if (k < 0.82) s = [-PI + r() * 6, -0.86, 0];
    else s = [2.74 + r() * 0.55, -0.72 + r() * 0.1, 0];
    return { s, e: [e[0] * 2.3, e[1] * 2.3, 0], d: r() * 0.45, sw: (r() - 0.5) * 2.4, c: r() < 0.6 ? 'gold' : r() < 0.5 ? 'cyan' : 'white', ph: r() * TAU };
  });
  // π -> circle: assign circle angles by the particles' angular order
  const order = PARTS_PI.map((p, i) => [Math.atan2(p.e[1], p.e[0]), i]).sort((a, b) => a[0] - b[0]);
  order.forEach(([, i], rank) => { const a = (rank / order.length) * TAU; PARTS_PI[i].c2 = [Math.cos(a), Math.sin(a), 0]; });

  DIGIT_RATIO = inkRatio('0', FONT.thin);
  PI_RATIO_SERIF = GLYPH_PI_RATIO;
  buildEquation();
  buildGiantPi();
}

function inkRatio(str, font) {
  const px = 400, c = mk(600, 700), g = c.getContext('2d');
  g.font = font(px); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
  g.fillText(str, 300, 350);
  const d = g.getImageData(0, 0, 600, 700).data;
  let y0 = 1e9, y1 = -1e9;
  for (let y = 0; y < 700; y++) for (let x = 0; x < 600; x += 2) if (d[(y * 600 + x) * 4 + 3] > 128) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { h: (y1 - y0) / px, cy: ((y0 + y1) / 2 - 350) / px };
}
// draw a glyph whose ink is `hw` world units tall centred on world point p
function glyph3(cam, str, p, hw, font, col, a, ratio) {
  const q = proj(cam, p); if (!q) return;
  const px = (hw * q.s) / ratio.h;
  text(str, q.x, q.y - ratio.cy * px, px, font, col, a, 'center', 'middle');
}

// ════════════════════════════════════════════════════════════════════════════
// Shots 1–3 share one world: unit circle at the origin on the plane z = 0.
// ════════════════════════════════════════════════════════════════════════════
function camA(t) {
  const D = track(t, [[0, 8.6], [8, 6.4], [9.0, 6.4], [10.2, 8.3], [16.2, 8.4], [17.3, 0.95, io5], [18.1, 0.9], [18.9, 7.2, io3], [20.9, 6.8], [22.6, 4.8], [28.4, 4.3], [30.1, 1.6], [30.7, 1.5], [32, 5.2]], true);
  const tx = track(t, [[0, 0], [10.2, 0], [16.2, 0.4], [17.3, 3.0, io5], [18.1, 3.03], [18.9, 0], [28.4, 0], [30.1, 0.574], [30.7, 0.58], [31.7, 0]]);
  const ty = track(t, [[0, 0], [9.0, 0], [10.2, -0.55], [16.2, -0.6], [17.3, -0.8, io5], [18.1, -0.8], [18.9, 0], [28.4, 0], [30.1, 0.819], [30.7, 0.82], [31.7, 0]]);
  const yaw = track(t, [[0, -0.16], [8, 0.06], [10.2, 0.0], [16.2, -0.05], [17.3, 0.03], [18.9, 0.06], [20.9, 0.0], [24.5, -0.08], [28.4, 0.05], [30.1, 0.14], [32, 0]]);
  const pitch = track(t, [[0, 0.08], [8, 0.02], [13, -0.03], [18.9, 0.03], [24.5, 0.07], [28.4, -0.02], [32, 0]]);
  const roll = track(t, [[0, 0.03], [8, -0.01], [18.9, 0], [26, 0.02], [30.1, -0.05], [32, 0]]);
  return orbitCam([tx, ty, 0], D, yaw, pitch, 40, roll);
}

function polarGrid(cam, t, a, t0) {
  if (a <= 0.01) return;
  const z = 1.4;
  for (let i = 1; i <= 10; i++) {
    const r = i * 0.5;
    const p = io3(seg(t, t0 + i * 0.12, t0 + i * 0.12 + 1.4));
    if (p <= 0) continue;
    path3(cam, circlePts([0, 0, z], r * p, 0, TAU, 140));
    thin(i % 2 ? C.cyan : C.violet, 1, a * (i % 2 ? 0.07 : 0.1));
  }
  for (let k = 0; k < 24; k++) {
    const ang = (k / 24) * TAU, p = io3(seg(t, t0 + 0.4 + k * 0.03, t0 + 1.8 + k * 0.03));
    if (p <= 0) continue;
    path3(cam, [[Math.cos(ang) * 0.3, Math.sin(ang) * 0.3, z], [Math.cos(ang) * (0.3 + 5.2 * p), Math.sin(ang) * (0.3 + 5.2 * p), z]]);
    thin(C.cyan, 1, a * (k % 6 === 0 ? 0.12 : 0.05));
  }
  // blueprint cross hairs
  const pc = io3(seg(t, t0 + 0.6, t0 + 2.2));
  path3(cam, [[-9 * pc, 0, z], [9 * pc, 0, z]]); thin(C.white, 1, a * 0.07);
  path3(cam, [[0, -6 * pc, z], [0, 6 * pc, z]]); thin(C.white, 1, a * 0.07);
}

function hudTicks(cam, t, a, c = [0, 0, 0], spin = 0) {
  if (a <= 0.01) return;
  // degree ticks around the circle
  X.beginPath();
  for (let d = 0; d < 360; d += 5) {
    const ang = (d * PI) / 180 + spin, l = d % 30 === 0 ? 0.08 : 0.035;
    const p0 = proj(cam, [c[0] + Math.cos(ang) * 1.14, c[1] + Math.sin(ang) * 1.14, 0]);
    const p1 = proj(cam, [c[0] + Math.cos(ang) * (1.14 + l), c[1] + Math.sin(ang) * (1.14 + l), 0]);
    if (p0 && p1) { X.moveTo(p0.x, p0.y); X.lineTo(p1.x, p1.y); }
  }
  thin(C.cyan, 1, a * 0.35);
  // dotted measurement ring
  dashed3(cam, circlePts(c, 1.32, 0, TAU, 180), C.white, 1, a * 0.22, [1.5, 7], -t * 12);
  // rotating violet HUD arcs
  for (let k = 0; k < 3; k++) {
    const a0 = t * 0.35 + (k * TAU) / 3 + spin;
    path3(cam, circlePts(c, 1.46, a0, a0 + 0.9, 40)); neon(C.violet, 1.2, a * 0.5, 0.3);
  }
  for (let k = 0; k < 2; k++) {
    const a0 = -t * 0.22 + k * PI;
    path3(cam, circlePts(c, 1.58, a0, a0 + 0.35, 20)); thin(C.gold, 1.5, a * 0.4);
  }
}

// ─── SHOT 1 — the spark (0–8s) ──────────────────────────────────────────────
function shot1(t, cam) {
  const ign = oexpo(seg(t, 0.6, 1.1));
  const pulse = 1 + 0.6 * bump(t, 1.75, 0.12) + 0.45 * bump(t, 2.3, 0.12);
  const fade = 1 - smooth(seg(t, 18.0, 18.5)); // circle lives on through shot 2
  let phi = 0, pp = [0, 0, 0];
  if (t >= 2.6 && t < 3.3) pp = [io3(seg(t, 2.6, 3.3)), 0, 0];
  else if (t >= 3.3) { phi = TAU * io3(seg(t, 3.3, 6.3)); pp = [Math.cos(phi), Math.sin(phi), 0]; }

  if (t < 9.0) {
    if (t < 8.0) polarGrid(cam, t, 1, 4.0);
    hudTicks(cam, t, smooth(seg(t, 5.2, 7.0)) * (1 - smooth(seg(t, 8.6, 9.2))));
  }
  const q0 = proj(cam, [0, 0, 0]);
  // radius / compass arm
  if (t > 2.6 && t < 9) {
    const ra = (t < 6.3 ? 1 : 1 - smooth(seg(t, 6.3, 7.6)));
    path3(cam, [[0, 0, 0], pp]); neon(C.gold, 1.4, 0.75 * ra, 0.4);
    if (q0) glow(q0.x, q0.y, 10, 'gold', 0.7 * ra);
  }
  // radar sweep sector behind the tracing point
  if (t > 3.3 && t < 6.6) {
    const sa = 1 - smooth(seg(t, 6.0, 6.6));
    for (let k = 0; k < 10; k++) {
      const a1 = phi - k * 0.07, a0 = a1 - 0.07;
      const pts = [[0, 0, 0], ...circlePts([0, 0, 0], 1, Math.max(0, a0), Math.max(0, a1), 4)];
      path3(cam, pts, true);
      X.fillStyle = rgba(C.cyan, 0.06 * (1 - k / 10) * sa); X.globalAlpha = GA; X.fill();
    }
  }
  // the circle itself
  if (t >= 3.3 && t < 8.0) {
    path3(cam, circlePts([0, 0, 0], 1, 0, phi, Math.max(2, (phi * 40) | 0)));
    const done = flash(t, 6.3, 0.5);
    neon(C.cyan, 2.2 + 2 * done, 0.95, 0.6 + 0.4 * done);
    // comet tail
    if (t < 6.4) for (let k = 0; k < 12; k++) {
      const a1 = phi - k * 0.05, a0 = Math.max(0, a1 - 0.05);
      if (a1 <= 0) break;
      path3(cam, circlePts([0, 0, 0], 1, a0, a1, 3));
      neon(C.white, 3.2 - k * 0.2, 0.6 * (1 - k / 12), 0.8);
    }
    if (done > 0.01) {
      const rr = 1 + o3(seg(t, 6.3, 7.4)) * 0.7;
      path3(cam, circlePts([0, 0, 0], rr, 0, TAU, 120)); neon(C.cyan, 1.5, 0.5 * (1 - seg(t, 6.3, 7.4)), 0.2);
    }
  }
  // the spark
  if (t > 0.6 && t < 6.9) {
    const q = proj(cam, pp);
    const fadeHead = 1 - smooth(seg(t, 6.2, 6.9));
    if (q) {
      const size = (t < 2.6 ? 26 * ign * pulse : 15) * (q.s / 230);
      lensFlare(q.x, q.y, size, 'cyan', ign * fadeHead * (t < 2.6 ? 1 : 0.85), t < 3.3);
    }
  }
  // birth flash of the light
  if (q0 && t < 2.2) lensFlare(q0.x, q0.y, 70, 'cyan', flash(t, 0.6, 0.35) * 0.8);
  return fade;
}

// ─── SHOT 2 — the ratio (8–20s) ─────────────────────────────────────────────
function wheelState(t) {
  const mv = io3(seg(t, 9.0, 10.2));
  const th = TAU * io3(seg(t, 10.2, 13.2));
  const x = -PI * mv + th;
  return { x, rot: PI * mv - th, th };
}
function shot2(t, cam) {
  const ws = wheelState(t);
  const fadeAll = 1 - smooth(seg(t, 18.05, 18.5));
  GA = fadeAll;
  polarGrid(cam, t, lerp(1, 0.35, smooth(seg(t, 9, 11))) * (1 - smooth(seg(t, 16.4, 17.2))), 4.0);
  const ctr = [ws.x, 0, 0];

  // ground baseline with measurement ticks
  if (t > 9.3) {
    const p = io3(seg(t, 9.3, 10.4));
    const base = partial([[-PI - 0.7, -1, 0], [PI + 0.7, -1, 0]], p);
    dashed3(cam, base, C.white, 1, 0.3, [2, 6], 0);
    X.beginPath();
    for (let k = -14; k <= 14; k++) {
      const x = k * 0.25;
      if ((x + PI + 0.7) / (TAU + 1.4) > p) continue;
      const l = k % 4 === 0 ? 0.09 : 0.04;
      const a0 = proj(cam, [x, -1.03, 0]), a1 = proj(cam, [x, -1.03 - l, 0]);
      if (a0 && a1) { X.moveTo(a0.x, a0.y); X.lineTo(a1.x, a1.y); }
    }
    thin(C.cyan, 1, 0.35);
    // caps at ±π
    for (const sx of [-PI, PI]) { path3(cam, [[sx, -1.13, 0], [sx, -0.87, 0]]); thin(C.white, 1, 0.4 * p); }
  }
  // ghost wheel + remaining circumference
  if (t >= 9.0) {
    dashed3(cam, circlePts(ctr, 1, 0, TAU, 120), C.cyan, 1, 0.22, [3, 7], -ws.th * 30);
    const rem = circlePts(ctr, 1, -PI / 2, (3 * PI) / 2 - ws.th, Math.max(2, ((TAU - ws.th) * 30) | 0));
    if (ws.th < TAU - 0.001) { path3(cam, rem); neon(C.cyan, 2.2, 0.95, 0.6); }
    // ribbon
    if (ws.th > 0) {
      path3(cam, [[-PI, -1, 0], [-PI + ws.th, -1, 0]]);
      neon(C.cyan, 3.0, 0.95, 0.75);
      // contact spark + debris
      if (t < 13.4) {
        const cq = proj(cam, [-PI + ws.th, -1, 0]);
        if (cq) lensFlare(cq.x, cq.y, 9, 'cyan', 0.8 * (1 - seg(t, 13.0, 13.4)), false);
        for (let k = 1; k < 14; k++) {
          const tb = t - k * 0.035; if (tb < 10.2) break;
          const wb = wheelState(tb);
          const r = rng(k * 31 + ((tb * 60) | 0)); r();
          const age = t - tb;
          const p = [-PI + wb.th - age * (0.3 + r()), -1 + age * (0.6 + r() * 1.2) - age * age * 3, 0];
          const q = proj(cam, p); if (q) glow(q.x, q.y, 3, 'cyan', 0.6 * (1 - k / 14));
        }
      }
    }
  } else {
    path3(cam, circlePts([0, 0, 0], 1, 0, TAU, 160)); neon(C.cyan, 2.2, 0.95, 0.6);
  }
  // golden diameter
  if (t >= 8.0) {
    let a0, a1;
    if (t < 8.5) { const p = oexpo(seg(t, 8.0, 8.5)); a0 = -1.3; a1 = lerp(-1.3, 1.3, p); }
    else { const p = io3(seg(t, 8.5, 9.0)); a0 = lerp(-1.3, -1, p); a1 = lerp(1.3, 1, p); }
    const d = [Math.cos(ws.rot), Math.sin(ws.rot), 0];
    const e0 = add(ctr, mul(d, a0)), e1 = add(ctr, mul(d, a1));
    path3(cam, [e0, e1]); neon(C.gold, 2.4, 1, 0.7);
    const q1 = proj(cam, e1), q0 = proj(cam, e0);
    if (t < 8.55 && q1) lensFlare(q1.x, q1.y, 16, 'gold', 1);
    if (t > 8.5) { if (q0) glow(q0.x, q0.y, 9, 'gold', 0.8); if (q1) glow(q1.x, q1.y, 9, 'gold', 0.8); }
    const fl = flash(t, 8.5, 0.3);
    if (fl > 0.01 && q1) lensFlare(q1.x, q1.y, 30, 'gold', fl);
  }
  // diameter copies laid end to end
  for (let k = 0; k < 3; k++) {
    const ts = 13.4 + k * 0.8, te = ts + 0.75;
    if (t < ts) continue;
    const u = io3(seg(t, ts, te));
    const mid0 = [PI, 0, 0], mid1 = [-PI + 2 * k + 1, -0.86, 0];
    const ctrl = [(PI + mid1[0]) / 2, 1.5, 0];
    const m = [(1 - u) ** 2 * mid0[0] + 2 * u * (1 - u) * ctrl[0] + u * u * mid1[0], (1 - u) ** 2 * mid0[1] + 2 * u * (1 - u) * ctrl[1] + u * u * mid1[1], 0];
    const ang = -PI * u;
    const d = [Math.cos(ang), Math.sin(ang), 0];
    path3(cam, [add(m, mul(d, -1)), add(m, mul(d, 1))]);
    const land = flash(t, te, 0.35);
    neon(C.gold, 2.4 + land * 2, 1, 0.7);
    if (t >= te) {
      for (const sx of [-1, 1]) {
        const e = [m[0] + sx, -0.86, 0];
        path3(cam, [e, [e[0], -1, 0]]); thin(C.gold, 1, 0.6);
        const q = proj(cam, e); if (q) { glow(q.x, q.y, 8, 'gold', 0.8); if (land > 0.02) lensFlare(q.x, q.y, 16, 'gold', land); }
      }
      const pop = oback(seg(t, te, te + 0.4));
      glyph3(cam, String(k + 1), [m[0], -0.55, 0], 0.17 * pop, FONT.thin, C.gold, 0.95 * (1 - smooth(seg(t, 16.6, 17.1))), DIGIT_RATIO);
    }
  }
  // the leftover gap
  if (t > 15.8) {
    const g0 = -PI + 6, g1 = PI;
    const ga = smooth(seg(t, 15.8, 16.3));
    const pul = 0.6 + 0.4 * Math.sin(t * 9);
    path3(cam, [[g0, -1, 0], [g1, -1, 0]]); neon(C.violet, 3.4, ga * pul, 0.9);
    for (const sx of [g0, g1]) { path3(cam, [[sx, -1.1, 0], [sx, -0.9, 0]]); neon(C.violet, 1.2, ga, 0.6); }
    // caliper brackets
    path3(cam, [[g0, -1.16, 0], [g1, -1.16, 0]]); thin(C.violet, 1, ga * 0.6);
  }
  // .14159… resolves inside the gap
  if (t > 16.9 && t < 18.6) {
    const str = '3.14159';
    const ch = 0.11, adv = 0.072, x0 = 3.0 - (adv * (str.length + 1.4)) / 2, ty = -0.66;
    for (let j = 0; j < str.length; j++) {
      const tl = 17.05 + j * 0.12;
      const x = x0 + j * adv + (j > 1 ? -0.03 : 0) + (j === 1 ? -0.015 : 0);
      const appear = smooth(seg(t, tl - 0.3, tl - 0.15));
      if (appear <= 0) continue;
      const locked = t >= tl;
      const c = locked ? str[j] : str[j] === '.' ? '.' : String(Math.floor(hash(Math.floor(t * 28) + j * 13) * 10));
      const yoff = locked ? 0 : (hash(Math.floor(t * 28) + j) - 0.5) * 0.04;
      const fl = flash(t, tl, 0.25);
      const col = j === 0 ? C.gold : C.white;
      glyph3(cam, c, [x, ty + yoff, 0], ch, FONT.thin, mixc(col, C.cyan, locked ? 0 : 0.7), appear * (locked ? 1 : 0.55), DIGIT_RATIO);
      if (fl > 0.02) { const q = proj(cam, [x, ty, 0]); if (q) glow(q.x, q.y, 60 * fl + 10, 'cyan', 0.5 * fl); }
    }
    // ellipsis
    for (let k = 0; k < 3; k++) {
      const tl = 17.05 + (7 + k) * 0.1;
      const q = proj(cam, [x0 + 7 * adv + 0.005 + k * 0.03, ty - ch / 2 + 0.006, 0]);
      if (q && t > tl) glow(q.x, q.y, 6, 'white', smooth(seg(t, tl, tl + 0.2)));
    }
  }
  GA = 1;
  // particles converge into π
  if (t >= 18.0 && t < 21.0) shotPiParticles(t, cam);
}
let DIGIT_RATIO;

function shotPiParticles(t, cam) {
  const toCircle = t >= 19.8;
  for (let i = 0; i < PARTS_PI.length; i++) {
    const p = PARTS_PI[i];
    const at = (tt) => {
      if (tt < 19.8) {
        const u = io3(seg(tt, 18.1 + p.d, 18.1 + p.d + 0.85));
        const base = vlerp(p.s, p.e, u);
        const dir = norm(sub(p.e, p.s));
        return add(base, mul([-dir[1], dir[0], 0], Math.sin(u * PI) * p.sw));
      }
      const u = io3(seg(tt, 19.8 + p.d * 0.5, 20.5 + p.d * 0.5));
      const base = vlerp(p.e, p.c2, u);
      return add(base, [0, 0, -Math.sin(u * PI) * 0.6 * p.sw]);
    };
    const a = toCircle ? 1 - smooth(seg(t, 20.4, 20.9)) : smooth(seg(t, 18.0, 18.25));
    if (a <= 0.01) continue;
    const q = proj(cam, at(t)), qp = proj(cam, at(t - 0.03));
    if (!q) continue;
    if (qp) {
      X.beginPath(); X.moveTo(qp.x, qp.y); X.lineTo(q.x, q.y);
      thin(C[p.c], 1.4, 0.5 * a);
    }
    const tw = 0.7 + 0.3 * Math.sin(t * 6 + p.ph);
    glow(q.x, q.y, 3.2, p.c, a * tw);
  }
  // crisp π + boom flash
  const qa = smooth(seg(t, 18.95, 19.3)) * (1 - smooth(seg(t, 19.75, 20.1)));
  if (qa > 0) glyph3(cam, 'π', [0, 0, 0], 2.3, FONT.serif, C.gold, qa * 0.85, GLYPH_PI_RATIO);
  const q0 = proj(cam, [0, 0, 0]);
  const fl = flash(t, 19.1, 0.5);
  if (q0 && fl > 0.01) {
    lensFlare(q0.x, q0.y, 120, 'gold', fl * 0.9);
    const rr = 0.5 + o3(seg(t, 19.1, 20.3)) * 4.5;
    path3(cam, circlePts([0, 0, 0], rr, 0, TAU, 160)); neon(C.gold, 2, 0.7 * (1 - seg(t, 19.1, 20.3)), 0.4);
  }
}

// ─── SHOT 3 — Archimedes (20–32s) ───────────────────────────────────────────
const DOUBLINGS = [23.0, 24.7, 26.2, 27.5];
function polyState(t) {
  let n = 6, p = 0;
  for (const T of DOUBLINGS) {
    if (t >= T + 0.9) n *= 2;
    else { if (t >= T) p = io3((t - T) / 0.9); break; }
  }
  return { n, p };
}
function polys(n, p) {
  const inn = [], out = [], rot = PI / 2;
  for (let k = 0; k < n; k++) {
    const a = rot + (TAU * k) / n;
    inn.push([Math.cos(a), Math.sin(a), 0]);
    const am = a + PI / n, rm = lerp(Math.cos(PI / n), 1, p);
    inn.push([Math.cos(am) * rm, Math.sin(am) * rm, 0]);
    const R = 1 / Math.cos(PI / n), R2 = 1 / Math.cos(PI / (2 * n));
    const V = [Math.cos(a) * R, Math.sin(a) * R, 0];
    const qa = a - PI / (2 * n), qb = a + PI / (2 * n);
    out.push(vlerp(V, [Math.cos(qa) * R2, Math.sin(qa) * R2, 0], p));
    out.push(vlerp(V, [Math.cos(qb) * R2, Math.sin(qb) * R2, 0], p));
  }
  return { inn, out };
}
const halfPerim = (pts) => { let s = 0; for (let i = 0; i < pts.length; i++) s += Math.hypot(...sub(pts[(i + 1) % pts.length], pts[i])); return s / 2; };

function shot3(t, cam) {
  const fin = 1 - smooth(seg(t, 30.9, 31.6));
  // the circle (taken over from the π particles)
  GA = 1;
  const ca = smooth(seg(t, 20.3, 20.8)) * fin;
  polarGrid(cam, t, 0.6 * ca, 20.4);
  hudTicks(cam, t, 0.7 * ca * (1 - smooth(seg(t, 28.0, 28.8))), [0, 0, 0], 0.2);
  path3(cam, circlePts([0, 0, 0], 1, 0, TAU, 360)); neon(C.cyan, 2, ca, 0.6);

  const { n, p } = polyState(t);
  const { inn, out } = polys(n, p);
  const di = io3(seg(t, 21.0, 22.0)), dout = io3(seg(t, 21.4, 22.4));
  const pa = fin;
  if (di > 0) {
    // squeeze band between the polygons
    if (dout >= 1) {
      X.beginPath();
      const po = out.map((v) => proj(cam, v)), pi = inn.map((v) => proj(cam, v));
      po.forEach((q, i) => (i ? X.lineTo(q.x, q.y) : X.moveTo(q.x, q.y))); X.closePath();
      pi.forEach((q, i) => (i ? X.lineTo(q.x, q.y) : X.moveTo(q.x, q.y))); X.closePath();
      X.fillStyle = rgba(C.violet, 0.09 * pa); X.globalAlpha = GA; X.fill('evenodd');
    }
    if (n <= 24) {
      X.beginPath();
      for (let k = 0; k < inn.length; k += 2) {
        const q0 = proj(cam, [0, 0, 0]), q1 = proj(cam, out[k]);
        if (q0 && q1) { X.moveTo(q0.x, q0.y); X.lineTo(q1.x, q1.y); }
      }
      thin(C.white, 1, 0.07 * di * pa * (1 - seg(t, 26.2, 27.1)));
    }
    path3(cam, partial([...inn, inn[0]], di)); neon(C.cyan, 1.6, 0.9 * pa, 0.6);
    path3(cam, partial([...out, out[0]], dout)); neon(C.violet, 1.6, 0.95 * pa, 0.6);
    // vertices
    const vs = clamp(1.2 - Math.log2(n / 6) * 0.3);
    if (vs > 0.05) {
      for (let k = 0; k < inn.length; k += 2) {
        if (k / inn.length > di) break;
        const q = proj(cam, inn[k]); if (q) glow(q.x, q.y, 6 * vs, 'cyan', 0.9 * vs * pa);
      }
      for (let k = 0; k < out.length; k += 2) {
        if (k / out.length > dout) break;
        const q = proj(cam, vlerp(out[k], out[k + 1], 0.5)); if (q) glow(q.x, q.y, 6 * vs, 'violet', 0.9 * vs * pa);
      }
    }
    // doubling flash travelling round the polygon
    for (const T of DOUBLINGS) {
      const f = flash(t, T + 0.9, 0.3);
      if (f > 0.02) { path3(cam, circlePts([0, 0, 0], 1, 0, TAU, 360)); neon(C.white, 2.5, 0.5 * f * pa, 0.8); }
    }
  }
  // HUD — bounds squeezing π
  const hud = smooth(seg(t, 22.0, 22.8));
  if (hud > 0) {
    let L = halfPerim(inn), U = halfPerim(out);
    const snap = io3(seg(t, 28.6, 29.1));
    L = lerp(L, 3.1408, snap); U = lerp(U, 3.1429, snap);
    const gap = 112 + 420 * Math.sqrt(Math.max(0, U - L) / 0.4641);
    const rise = io3(seg(t, 30.9, 31.8));
    const y = H * 0.855, ha = hud * (1 - smooth(seg(t, 30.8, 31.3)));
    const sf = flash(t, 29.1, 0.4);
    const spread = 1 + rise * 1.4;
    text(L.toFixed(4), CX - gap * spread, y, 46, FONT.mono, mixc(C.cyan, C.white, sf * 0.6), ha, 'right', 'middle');
    text(U.toFixed(4), CX + gap * spread, y, 46, FONT.mono, mixc(C.violet, C.white, sf * 0.6), ha, 'left', 'middle');
    text('<', CX - gap * 0.42 - 24, y, 38, FONT.mono, C.white, ha * 0.55, 'center', 'middle');
    text('<', CX + gap * 0.42 + 24, y, 38, FONT.mono, C.white, ha * 0.55, 'center', 'middle');
    if (sf > 0.02) { glow(CX - gap, y, 120 * sf, 'cyan', sf * 0.5); glow(CX + gap, y, 120 * sf, 'violet', sf * 0.5); }
    // n counter
    const nd = p > 0.5 ? n * 2 : n;
    const nq = [CX, H * 0.115];
    X.beginPath(); X.arc(nq[0], nq[1], 34, 0, TAU); thin(C.white, 1, 0.25 * ha);
    X.beginPath(); X.arc(nq[0], nq[1], 42, t * 1.2, t * 1.2 + 1.2); thin(C.violet, 1.5, 0.6 * ha);
    X.beginPath(); X.arc(nq[0], nq[1], 42, t * 1.2 + PI, t * 1.2 + PI + 1.2); thin(C.cyan, 1.5, 0.6 * ha);
    const nf = DOUBLINGS.reduce((s, T) => s + flash(t, T + 0.45, 0.25), 0);
    text(String(nd), nq[0], nq[1] + 1, 26, FONT.mono, mixc(C.white, C.gold, nf), ha * 0.9, 'center', 'middle');
    // π rises to the centre, charges, explodes (shot 4)
    const py = lerp(y, CY, rise), ps = lerp(64, 380, io5(seg(t, 31.0, 31.9)));
    const charge = seg(t, 31.4, 32.0);
    const pr = PI_RATIO_SERIF;
    text('π', CX, py - pr.cy * ps, ps, FONT.serif, mixc(C.gold, C.white, charge * 0.5), hud * (1 - smooth(seg(t, 31.97, 32.05))), 'center', 'middle');
    if (rise > 0) glow(CX, py, ps * 0.9, 'gold', 0.25 * rise);
    if (charge > 0 && t < 32) crackle(t, CX, py, ps * 0.42, charge);
  }
  GA = 1;
}
let PI_RATIO_SERIF;
function crackle(t, x, y, r0, k) {
  const fr = Math.floor(t * 40);
  for (let i = 0; i < 9; i++) {
    const r = rng(fr * 17 + i * 3);
    if (r() > 0.3 + k * 0.7) continue;
    const a0 = r() * TAU;
    let px = x + Math.cos(a0) * r0, py = y + Math.sin(a0) * r0;
    X.beginPath(); X.moveTo(px, py);
    const len = r0 * (0.4 + r() * 0.9 * k);
    for (let s = 0; s < 6; s++) {
      const a = a0 + (r() - 0.5) * 1.2;
      px += Math.cos(a) * len / 6; py += Math.sin(a) * len / 6;
      X.lineTo(px, py);
    }
    neon(r() < 0.5 ? C.violet : C.cyan, 1.2, 0.8 * k, 0.8);
  }
}

// ─── SHOT 4 — infinity of digits (32–45s) ───────────────────────────────────
const ARMS = [
  { col: 'gold', str: '3.' + PI_DIGITS.slice(1, 1550) },
  { col: 'cyan', str: PI_DIGITS.slice(1550, 3100) },
  { col: 'violet', str: PI_DIGITS.slice(3100, 4650) },
];
const STARS = (() => { const r = rng(5), o = []; for (let i = 0; i < 1700; i++) o.push({ arm: i % 3, s: r() * 160, dr: (r() + r() + r() - 1.5) * 1.1, dz: (r() - 0.5) * 1.0, sz: r(), ph: r() * TAU }); return o; })();

function camD(t) {
  const sway = 1 - smooth(seg(t, 43.6, 45.0));
  return camera([0.15 * Math.sin(t * 0.31) * sway, 0.1 * Math.sin(t * 0.23) * sway, 0], [0.35 * Math.sin(t * 0.2) * sway, 0.22 * Math.cos(t * 0.17) * sway, 10], 58, 0.05 * Math.sin(t * 0.15) * sway);
}
const FLOW = (t) => 2.7 * (t - 32) + 2.2 * iexpo(seg(t, 42.5, 44.5)) * (t - 42.5);
function spiralPos(arm, s, t, flat) {
  const rot = 0.32 * (t - 32) + 0.6 * iexpo(seg(t, 43, 45.4));
  const th = arm * (TAU / 3) + s * 0.5 + rot;
  let R = 2.0 + 0.55 * Math.sin(s * 0.21 + arm * 2);
  let z = 1.6 + s * 0.6 - FLOW(t);
  if (flat > 0) { z = lerp(z, 8, flat); R = lerp(R, 2.2, flat); }
  return [Math.cos(th) * R, Math.sin(th) * R, z];
}
function shot4(t, cam) {
  const flat = io3(seg(t, 43.9, 45.25));
  const fade = 1 - smooth(seg(t, 45.15, 45.7));
  GA = fade;
  const burst = t < 34.2;
  const flow = FLOW(t);
  // spiral arm light trails
  for (let a = 0; a < 3; a++) {
    const pts = [];
    const s0 = Math.max(0, (flow - 1.6) / 0.6), s1 = s0 + 130;
    for (let s = s0; s < s1; s += 0.35) { const p = spiralPos(a, s, t, flat); pts.push(mul(p, 0.93)); }
    const tr = smooth(seg(t, 33.0, 34.5));
    path3(cam, pts); thin(C[ARMS[a].col], 1, 0.16 * tr * (1 - flat));
    path3(cam, pts.map((p) => [p[0] * 1.17, p[1] * 1.17, p[2]])); thin(C[ARMS[a].col], 1, 0.07 * tr * (1 - flat));
  }
  // star dust along the arms
  const sa = smooth(seg(t, 32.6, 34)) * (1 - flat);
  if (sa > 0) for (const st of STARS) {
    const p0 = spiralPos(st.arm, st.s + flow / 0.6, t, 0);
    const k = 1 + st.dr * 0.45;
    const p = [p0[0] * k, p0[1] * k, p0[2] + st.dz];
    const q = proj(cam, p); if (!q || q.z > 90) continue;
    const fog = Math.pow(1 - clamp(q.z / 90), 1.4);
    glow(q.x, q.y, 1.2 + st.sz * 0.03 * q.s, ARMS[st.arm].col, sa * fog * (0.4 + 0.3 * Math.sin(t * 3 + st.ph)));
  }
  // the digits
  for (let a = 0; a < 3; a++) {
    const arm = ARMS[a], spr = DIG[arm.col];
    const j0 = Math.max(0, Math.floor((flow - 1.6 - 0.5) / 0.096)), j1 = Math.min(arm.str.length, j0 + 860);
    for (let j = j0; j < j1; j++) {
      const s = j * 0.16;
      let p = spiralPos(a, s, t, flat);
      if (burst) {
        const h = hash(j * 3 + a);
        const e = oexpo(seg(t, 32 + h * 0.35, 33.5 + h * 0.5));
        const o = [(hash(j + 9) - 0.5) * 0.5, (hash(j + 19) - 0.5) * 0.5, 6 + (hash(j + 29) - 0.5) * 0.5];
        p = vlerp(o, p, e);
      }
      const q = proj(cam, p);
      if (!q || q.z > 85 || q.x < -100 || q.x > W + 100 || q.y < -100 || q.y > H + 100) continue;
      const fog = Math.pow(1 - clamp(q.z / 85), 1.3) * smooth(seg(q.z, 0.4, 1.6));
      const sz = 0.2 * q.s;
      if (sz < 1.2) continue;
      const ang = Math.atan2(q.y - CY, q.x - CX) + PI / 2;
      X.globalAlpha = clamp(GA * fog * lerp(1, 0.12, flat) * (1 - 0.6 * smooth(seg(q.z, 25, 60)) * smooth(seg(t, 40.4, 41.4))));
      X.setTransform(SC * Math.cos(ang), SC * Math.sin(ang), -SC * Math.sin(ang), SC * Math.cos(ang), q.x * SC, q.y * SC);
      X.drawImage(spr[arm.str[j]], -sz * 0.4, -sz * 0.5, sz * 0.8, sz);
    }
  }
  X.setTransform(SC, 0, 0, SC, 0, 0); X.globalAlpha = GA;
  // ∞ at the vanishing point
  const ia = smooth(seg(t, 40.4, 41.0)) * (1 - smooth(seg(t, 43.8, 44.5)));
  if (ia > 0) {
    const zc = 60, aa = 19 * (1 - io3(seg(t, 43.9, 44.5)) * 0.9);
    const lem = (u) => { const d = 1 + Math.sin(u) ** 2; return [(aa * Math.cos(u)) / d, (aa * Math.sin(u) * Math.cos(u)) / d, zc]; };
    const U = 2.4 * (t - 40.4);
    const full = smooth(seg(t, 41.6, 43.0));
    if (full > 0) {
      const pts = []; for (let u = 0; u <= TAU + 0.01; u += 0.04) pts.push(lem(u));
      path3(cam, pts); neon(C.gold, 2.2, ia * full * 0.9, 0.7);
    }
    ['gold', 'cyan', 'violet'].forEach((cn, k) => {
      const u1 = U + (k * TAU) / 3;
      for (let s = 0; s < 14; s++) {
        const ua = u1 - s * 0.1;
        path3(cam, [lem(ua - 0.1), lem(ua)]);
        neon(C[cn], 2.6 - s * 0.15, ia * (1 - s / 14), 0.7);
      }
      const q = proj(cam, lem(u1)); if (q) lensFlare(q.x, q.y, 10, cn, ia * 0.9, false);
    });
    const qc = proj(cam, [0, 0, zc]); if (qc) glow(qc.x, qc.y, 140, 'violet', 0.15 * ia);
  }
  // explosion flash
  const fl = flash(t, 32.0, 0.45);
  if (fl > 0.01) lensFlare(CX, CY, 200, 'gold', fl);
  GA = 1;
}

// ─── SHOT 5 — waves (45–58s) ────────────────────────────────────────────────
const C5 = [-3.6, 0, 0], X0 = -2.2, KW = 0.55, OMEGA = 2.86;
function phi5(t) {
  const tau = t - 46.2; if (tau <= 0) return 0;
  return tau < 0.8 ? (OMEGA * tau * tau) / 1.6 : OMEGA * (tau - 0.4);
}
function camE(t) {
  const f1 = io3(seg(t, 45.4, 47.0));
  let target = vlerp(C5, [0, 0, 0], f1);
  let pos = add(target, [0, 0, -lerp(5.54, 8.5, f1)]);
  // ripples: crane up and look down onto the water
  const f2 = io3(seg(t, 51.0, 52.7));
  const tgt2 = [X0 + 0.8, -0.2, 2.2], pos2 = [X0 + 0.4, 4.4, -6.6];
  target = vlerp(target, tgt2, f2); pos = vlerp(pos, pos2, f2);
  // slow drift over the water
  pos = add(pos, [0.5 * f2 * Math.sin((t - 51) * 0.5), 0, 0]);
  // back down to eye level for sound waves
  const f3 = io3(seg(t, 53.2, 54.5));
  const tgt3 = [X0 + 1.8, 0, 0], pos3 = [X0 + 1.8, 0.15, -9.2];
  target = vlerp(target, tgt3, f3); pos = vlerp(pos, pos3, f3);
  return camera(pos, target, 40, 0.02 * Math.sin(t * 0.4));
}
function ecg(x, xa) {
  const u = (((x - xa) / 4) % 1 + 1) % 1;
  return 0.12 * bump(u, 0.27, 0.04) - 0.12 * bump(u, 0.468, 0.012) + 1.15 * bump(u, 0.5, 0.012) - 0.32 * bump(u, 0.535, 0.013) + 0.26 * bump(u, 0.72, 0.05);
}
const XA = X0 + 1.8 - 5.6;
const ECG_HEAD = (t) => XA + (t - 55.4) * 4.5;

function shot5(t, cam) {
  const phi = phi5(t);
  const ain = smooth(seg(t, 45.1, 45.5));
  const unit = ain * (1 - smooth(seg(t, 50.8, 51.6)));
  GA = 1;
  // unit circle
  if (unit > 0) {
    path3(cam, circlePts(C5, 1, 0, TAU, 160)); neon(C.cyan, 2.2, unit, 0.6);
    const ax = smooth(seg(t, 46.0, 47.0)) * unit;
    path3(cam, [[C5[0] - 1.4, 0, 0], [5.8, 0, 0]]); thin(C.white, 1, 0.22 * ax);
    path3(cam, [[C5[0], -1.35, 0], [C5[0], 1.35, 0]]); thin(C.white, 1, 0.16 * ax);
    path3(cam, [[X0, -1.35, 0], [X0, 1.35, 0]]); thin(C.white, 1, 0.2 * ax);
    // y ticks ±1
    for (const yy of [-1, 1]) { path3(cam, [[X0 - 0.07, yy, 0], [X0 + 0.07, yy, 0]]); thin(C.white, 1, 0.35 * ax); }
    hudTicks(cam, t, 0.35 * ax, C5, 0);
    if (t > 46.2) {
      const P = [C5[0] + Math.cos(phi), Math.sin(phi), 0];
      const pa = smooth(seg(t, 46.2, 46.6)) * unit;
      // angle arc + sector
      const pm = phi % TAU;
      path3(cam, circlePts(C5, 0.3, 0, pm, 30)); neon(C.violet, 1.4, 0.8 * pa, 0.5);
      path3(cam, [C5, ...circlePts(C5, 1, 0, pm, 60)], true);
      X.fillStyle = rgba(C.violet, 0.03 * pa); X.fill();
      path3(cam, [C5, P]); neon(C.gold, 1.6, 0.9 * pa, 0.5);
      // projections
      dashed3(cam, [P, [X0, P[1], 0]], C.white, 1, 0.45 * pa, [3, 5], -t * 30);
      dashed3(cam, [P, [P[0], 0, 0]], C.cyan, 1, 0.3 * pa, [2, 5], 0);
      const q = proj(cam, P); if (q) lensFlare(q.x, q.y, 12, 'gold', pa, false);
      const qp = proj(cam, [X0, P[1], 0]); if (qp) glow(qp.x, qp.y, 14, 'cyan', pa);
    }
  }
  // the sine wave (also the x-slice of the water)
  const waveA = smooth(seg(t, 46.2, 46.5)) * (1 - smooth(seg(t, 52.2, 53.0)));
  const kw = lerp(KW, 0.32, io3(seg(t, 51.2, 52.8)));
  if (waveA > 0 && phi > 0) {
    const len = Math.min(phi * kw, 8.2);
    const pts = [];
    for (let x = 0; x <= len; x += 0.03) pts.push([X0 + x, Math.sin(phi - x / kw), 0]);
    path3(cam, pts); neon(C.cyan, 2.4, 0.95 * waveA, 0.7);
    // π markers riding with the wave
    for (let m = 1; m < 12; m++) {
      const x = X0 + (phi - m * PI) * kw;
      if (x < X0 + 0.05 || x > X0 + len - 0.1) continue;
      const ma = waveA * unit * smooth(seg(x, X0, X0 + 0.5)) * (1 - smooth(seg(x, X0 + len - 1.2, X0 + len)));
      path3(cam, [[x, -0.08, 0], [x, 0.08, 0]]); thin(C.gold, 1.4, 0.8 * ma);
      const q = proj(cam, [x, -0.28, 0]);
      if (q) text(m === 1 ? 'π' : m + 'π', q.x, q.y, 34, FONT.math, C.gold, 0.85 * ma, 'center', 'middle');
      const xh = X0 + (phi - (m - 0.5) * PI) * kw;
      if (xh > X0 && xh < X0 + len) { path3(cam, [[xh, -0.04, 0], [xh, 0.04, 0]]); thin(C.white, 1, 0.4 * ma); }
    }
  }
  // ripples on dark water
  const wa = smooth(seg(t, 51.2, 52.4)) * (1 - smooth(seg(t, 54.0, 54.7)));
  if (wa > 0) {
    const f2 = io3(seg(t, 51.2, 52.8));
    for (let i = 0; i < 90; i++) {
      const r = 0.08 + i * 0.1;
      const A = lerp(1, 0.5 * Math.exp(-r / 5) + 0.04, f2);
      const h = A * Math.sin(phi - r / kw);
      const crest = (Math.sin(phi - r / kw) + 1) / 2;
      const dist = 1 - smooth(seg(r, 4, 9));
      const a = wa * (0.06 + 0.5 * crest ** 3) * dist;
      if (a < 0.01) continue;
      path3(cam, circlePts([X0, h, 0], r, 0, TAU, 90, 'xz'));
      thin(mixc(C.cyan, C.violet, i / 90), crest > 0.85 ? 1.6 : 1, a);
    }
    // radial spokes follow the profile
    for (let k = 0; k < 24; k++) {
      const ang = (k / 24) * TAU, pts = [];
      for (let r = 0.1; r < 8; r += 0.1) {
        const A = lerp(1, 0.5 * Math.exp(-r / 5) + 0.04, f2);
        pts.push([X0 + Math.cos(ang) * r, A * Math.sin(phi - r / kw), Math.sin(ang) * r]);
      }
      path3(cam, pts); thin(C.cyan, 1, 0.07 * wa);
    }
    // glints
    for (let k = 0; k < 60; k++) {
      const r = 0.3 + hash(k) * 7, ang = hash(k + 100) * TAU;
      const crest = (Math.sin(phi - r / kw) + 1) / 2;
      const A = lerp(1, 0.5 * Math.exp(-r / 5) + 0.04, f2);
      const q = proj(cam, [X0 + Math.cos(ang) * r, A * Math.sin(phi - r / kw), Math.sin(ang) * r]);
      if (q) glow(q.x, q.y, 4, 'white', wa * crest ** 6 * 0.8);
    }
    const qc = proj(cam, [X0, 0, 0]); if (qc) glow(qc.x, qc.y, 40, 'cyan', 0.4 * wa * (1 - seg(t, 52.4, 54)));
  }
  // sound waves
  const sw = smooth(seg(t, 53.9, 54.5)) * (1 - smooth(seg(t, 55.3, 55.8)));
  const Tx = X0 + 1.8;
  if (sw > 0) {
    const lines = [[C.violet, 1.0, 2.1, 0.0], [C.cyan, 0.8, 3.3, 1.3], [C.gold, 0.55, 5.1, 2.1], [C.cyan, 0.5, 1.4, 3.7], [C.violet, 0.35, 7.3, 0.6]];
    lines.forEach(([col, amp, fr, ph], k) => {
      const pts = [];
      for (let x = -5.8; x <= 5.8; x += 0.025) {
        const env = Math.exp(-(x * x) / 7) * (0.6 + 0.4 * Math.sin(t * 5 + k));
        pts.push([Tx + x, 1.7 * env * amp * Math.sin(fr * x - t * (6 + k) + ph) * (0.7 + 0.3 * Math.sin(x * 0.7 + t * 2)), 0]);
      }
      path3(cam, pts); neon(col, 1.6, sw * (0.85 - k * 0.1), 0.6);
    });
    for (let k = 0; k < 4; k++) {
      const r = ((t * 1.4 + k * 0.7) % 2.8);
      path3(cam, circlePts([Tx, 0, 0.5], 0.4 + r * 2, 0, TAU, 120));
      thin(C.violet, 1, sw * 0.25 * (1 - r / 2.8));
    }
  }
  // heartbeat
  const hb = smooth(seg(t, 55.3, 55.6));
  if (hb > 0 && t < 58.6) {
    const head = ECG_HEAD(t);
    const tail = Math.max(XA, head - 9);
    const morph = io3(seg(t, 57.7, 58.5));
    const N = 260;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const x = lerp(tail, Math.min(head, XA + 11.2), i / N);
      pts.push([x, ecg(x, XA), 0]);
    }
    const sp = pts.map((p) => proj(cam, p));
    let out = sp;
    if (morph > 0) {
      const c6 = camF(t);
      out = sp.map((q, i) => {
        const ang = (i / N) * TAU + 0.3;
        const o = proj(c6, orbitPt(ang, 2.6));
        const m = io3(clamp(morph * 1.3 - (1 - i / N) * 0.3));
        return q && o ? { x: lerp(q.x, o.x, m), y: lerp(q.y, o.y, m) } : null;
      });
    }
    // fading trace, brightest near the head
    for (let s = 0; s < 12; s++) {
      const i0 = Math.floor((s / 12) * N), i1 = Math.floor(((s + 1) / 12) * N) + 1;
      pathPts(out.slice(i0, i1 + 1));
      neon(C.gold, 2.2, hb * lerp(0.15, 1, (s / 11) ** 1.5) * lerp(1, 1, morph) + morph * 0.6, 0.7);
    }
    const hq = out[out.length - 1];
    if (hq && head < XA + 11.2) lensFlare(hq.x, hq.y, 12, 'gold', hb * (1 - morph), false);
    // beat glow
    const beats = [55.84, 56.73, 57.62];
    const bp = beats.reduce((s, b) => s + flash(t, b, 0.22), 0);
    if (bp > 0.01) glow(CX, CY, 700, 'gold', 0.12 * bp);
  }
  GA = 1;
}

// ─── SHOT 6 — π in technology (58–72s) ──────────────────────────────────────
function orbitPt(a, r, inc = -0.42, raan = 0) {
  return rotY(rotX([Math.cos(a) * r, 0, Math.sin(a) * r], inc), raan);
}
function camF(t) {
  const lt = t - 58;
  const D = track(lt, [[0, 8.2], [2.4, 7.2], [3.6, 4.7, io3], [5.3, 4.3]]);
  return orbitCam([0, 0, 0], D, 0.55 + 0.1 * lt, 0.26 - 0.02 * lt, 40);
}
function piMark(cam, p, hw, a, col = C.gold) {
  if (a <= 0.01) return;
  glyph3(cam, 'π', p, hw, FONT.serif, col, a, GLYPH_PI_RATIO);
}
function sphereLines(cam, c, R, tilt, spin, col, a) {
  const tr = (p) => add(c, rotZ(rotY(p, spin), tilt));
  const vis = (p) => dot3(norm(sub(p, c)), norm(sub(cam.pos, p))) > 0;
  const drawRing = (pts) => {
    // split into front / back runs
    let run = [], front = null;
    const flush = () => { if (run.length > 1) { path3(cam, run); thin(col, front ? 1.3 : 1, a * (front ? 0.75 : 0.13)); } };
    for (const p of pts) {
      const v = vis(p);
      if (front === null) front = v;
      if (v !== front) { run.push(p); flush(); run = [p]; front = v; } else run.push(p);
    }
    flush();
  };
  for (let lat = -75; lat <= 75; lat += 15) {
    const la = (lat * PI) / 180;
    drawRing(circlePts([0, Math.sin(la) * R, 0], Math.cos(la) * R, 0, TAU, 90, 'xz').map(tr));
  }
  for (let k = 0; k < 12; k++) {
    const lo = (k / 12) * TAU, pts = [];
    for (let i = 0; i <= 48; i++) { const la = -PI / 2 + (i / 48) * PI; pts.push([Math.cos(la) * Math.cos(lo) * R, Math.sin(la) * R, Math.cos(la) * Math.sin(lo) * R]); }
    drawRing(pts.map(tr));
  }
  const q = proj(cam, c);
  if (q) { sprite(RING, q.x, q.y, R * q.s * 1.12, R * q.s * 1.12, a * 0.12); glow(q.x, q.y, R * q.s * 1.5, 'cyan', a * 0.035); }
}
function satellite(cam, p, col, a, s = 0.07) {
  const q = proj(cam, p); if (!q) return;
  const r = s * q.s;
  X.beginPath(); X.rect(q.x - r / 2, q.y - r / 2, r, r); thin(col, 1.2, a);
  X.beginPath(); X.moveTo(q.x - r * 2.4, q.y - r * 0.3); X.lineTo(q.x - r * 0.6, q.y - r * 0.3); X.lineTo(q.x - r * 0.6, q.y + r * 0.3); X.lineTo(q.x - r * 2.4, q.y + r * 0.3); X.closePath();
  X.moveTo(q.x + r * 2.4, q.y - r * 0.3); X.lineTo(q.x + r * 0.6, q.y - r * 0.3); X.lineTo(q.x + r * 0.6, q.y + r * 0.3); X.lineTo(q.x + r * 2.4, q.y + r * 0.3); X.closePath();
  thin(col, 1, a * 0.8);
  glow(q.x, q.y, r * 1.2, 'white', a * 0.6);
}
function itemPlanet(t, a) {
  const lt = t - 58, cam = camF(t);
  const spin = 0.35 * lt;
  sphereLines(cam, [0, 0, 0], 1.3, 0.38, spin, C.cyan, a * smooth(seg(lt, 0.2, 0.9)));
  piMark(cam, [0, 0, 0], 0.75, 0.1 * a);
  // main orbit
  const orb = []; for (let k = 0; k <= 160; k++) orb.push(orbitPt((k / 160) * TAU, 2.6));
  path3(cam, orb); neon(C.gold, 1.4, 0.75 * a, 0.4);
  const sg = 1.1 * lt + 0.3 + TAU * 0.0;
  for (let s = 0; s < 16; s++) { path3(cam, [orbitPt(sg - (s + 1) * 0.05, 2.6), orbitPt(sg - s * 0.05, 2.6)]); neon(C.gold, 2.6 - s * 0.12, a * (1 - s / 16), 0.8); }
  satellite(cam, orbitPt(sg, 2.6), C.gold, a);
  // GPS constellation
  const ga = smooth(seg(lt, 2.4, 3.4)) * a;
  if (ga > 0) {
    const G = mul(norm(add(norm(sub(cam.pos, [0, 0, 0])), [0.15, 0.32, 0])), 1.3);
    const sats = [];
    for (let k = 0; k < 5; k++) {
      const raan = k * 0.75 + 0.4, inc = 0.95;
      const pts = []; for (let i = 0; i <= 120; i++) pts.push(orbitPt((i / 120) * TAU, 2.15, inc, raan));
      path3(cam, pts); thin(C.violet, 1, 0.35 * ga);
      const sp = orbitPt(0.7 * lt + k * 1.7, 2.15, inc, raan);
      satellite(cam, sp, C.violet, ga, 0.05);
      sats.push(sp);
    }
    const gq = proj(cam, G);
    // triangulation
    sats.forEach((sp, k) => {
      if (dot3(norm(sp), norm(G)) < 0.1) return;
      dashed3(cam, [sp, G], C.white, 1, 0.25 * ga, [2, 6], -t * 40);
      const ph = ((lt * 1.6 + k * 0.37) % 1.4) / 0.8;
      if (ph < 1) {
        path3(cam, [vlerp(sp, G, Math.max(0, ph - 0.25)), vlerp(sp, G, ph)]); neon(C.cyan, 2, ga * (1 - ph * 0.3), 0.9);
        const qs = proj(cam, sp); if (qs) sprite(RING, qs.x, qs.y, 10 + ph * 50, 10 + ph * 50, ga * (1 - ph) * 0.6);
      }
    });
    if (gq) {
      for (let k = 0; k < 3; k++) {
        const ph = ((lt * 1.2 + k / 3) % 1);
        const nrm = norm(G), u = norm(cross(nrm, [0, 1, 0])), v = cross(nrm, u), pts = [];
        for (let i = 0; i <= 40; i++) { const an = (i / 40) * TAU; pts.push(add(G, add(mul(u, Math.cos(an) * ph * 0.45), mul(v, Math.sin(an) * ph * 0.45)))); }
        path3(cam, pts); thin(C.cyan, 1.4, ga * (1 - ph) * 0.8);
      }
      lensFlare(gq.x, gq.y, 10, 'cyan', ga, false);
    }
  }
}
function gearProfile(N, rp, ang, z) {
  const tip = rp + 0.09, root = rp - 0.11, pts = [], per = TAU / N;
  for (let k = 0; k < N; k++) {
    const b = ang + k * per;
    const keys = [[-0.5, root], [-0.3, root], [-0.17, tip], [0.17, tip], [0.3, root]];
    for (const [u, r] of keys) pts.push([Math.cos(b + u * per) * r, Math.sin(b + u * per) * r, z]);
  }
  pts.push(pts[0]);
  return pts;
}
function gear(cam, c, N, rp, ang, col, a, holes) {
  const tr = (p) => add(c, p);
  for (const z of [-0.16, 0.16]) { path3(cam, gearProfile(N, rp, ang, z).map(tr)); neon(col, 1.3, a * (z < 0 ? 1 : 0.45), 0.5); }
  X.beginPath();
  for (let k = 0; k < N; k++) {
    const b = ang + (k * TAU) / N, r = rp + 0.09;
    const p0 = proj(cam, tr([Math.cos(b) * r, Math.sin(b) * r, -0.16])), p1 = proj(cam, tr([Math.cos(b) * r, Math.sin(b) * r, 0.16]));
    if (p0 && p1) { X.moveTo(p0.x, p0.y); X.lineTo(p1.x, p1.y); }
  }
  thin(col, 1, a * 0.35);
  for (const z of [-0.16, 0.16]) { path3(cam, circlePts(tr([0, 0, z]), rp * 0.28, 0, TAU, 50)); thin(C.gold, 1.3, a * 0.8); }
  path3(cam, circlePts(tr([0, 0, -0.16]), rp - 0.22, 0, TAU, 90)); thin(col, 1, a * 0.4);
  for (let k = 0; k < holes; k++) {
    const b = ang + (k * TAU) / holes;
    path3(cam, circlePts(tr([Math.cos(b) * rp * 0.58, Math.sin(b) * rp * 0.58, -0.16]), rp * 0.17, 0, TAU, 36)); thin(col, 1.2, a * 0.7);
  }
  piMark(cam, tr([0, 0, -0.17]), rp * 0.3, a * 0.15);
}
function itemGears(lt, m, a) {
  const cam = orbitCam([0.25, 0, 0], 6.0 * m, -0.55 + 0.22 * lt, 0.32 - 0.04 * lt, 40);
  const th = 1.5 * lt;
  gear(cam, [-0.75, 0, 0], 20, 1.25, th, C.cyan, a, 5);
  gear(cam, [1.25, 0, 0], 12, 0.75, PI / 12 - (th * 20) / 12, C.violet, a, 0);
  // pitch circles (dashed)
  dashed3(cam, circlePts([-0.75, 0, -0.16], 1.25, 0, TAU, 120), C.white, 1, 0.25 * a, [2, 6], -lt * 30);
  dashed3(cam, circlePts([1.25, 0, -0.16], 0.75, 0, TAU, 80), C.white, 1, 0.25 * a, [2, 6], lt * 30);
  const q = proj(cam, [0.5, 0, -0.16]); if (q) glow(q.x, q.y, 14, 'gold', 0.6 * a);
}
function itemBridge(lt, m, a) {
  const tgt = [0, 0.4, 0];
  const p0 = [-6.8, 1.1, -5.2], p1 = [3.4, 2.4, -7.0];
  const pos = add(tgt, mul(sub(vlerp(p0, p1, iosine(clamp(lt / 2.4))), tgt), m));
  const cam = camera(pos, tgt, 40);
  const Rc = 3.333, yc = -1.533, a0 = Math.atan2(-0.6 - yc, -3.2), a1 = Math.atan2(-0.6 - yc, 3.2);
  const draw = io3(seg(lt, 0, 0.9));
  for (const z of [-0.7, 0.7]) {
    const arch = circlePts([0, yc, z], Rc, a1, a0, 120);
    path3(cam, partial(arch, draw)); neon(C.cyan, 1.8, a * (z < 0 ? 1 : 0.55), 0.6);
  }
  dashed3(cam, circlePts([0, yc, -0.7], Rc, 0, TAU, 160), C.violet, 1, 0.3 * a, [3, 8], -lt * 20);
  piMark(cam, [0, yc, -0.7], 0.8, 0.1 * a, C.violet);
  const qc = proj(cam, [0, yc, -0.7]); if (qc) glow(qc.x, qc.y, 8, 'violet', 0.6 * a);
  // deck
  for (const z of [-0.9, 0.9]) { path3(cam, [[-5.6, 0, z], [5.6, 0, z]]); neon(C.white, 1.3, a * 0.7 * (z < 0 ? 1 : 0.6), 0.3); }
  X.beginPath();
  for (let x = -5.5; x <= 5.5; x += 0.5) { const q0 = proj(cam, [x, 0, -0.9]), q1 = proj(cam, [x, 0, 0.9]); if (q0 && q1) { X.moveTo(q0.x, q0.y); X.lineTo(q1.x, q1.y); } }
  thin(C.white, 1, a * 0.25);
  // hangers
  X.beginPath();
  for (const z of [-0.7, 0.7]) for (let x = -2.8; x <= 2.81; x += 0.35) {
    const ya = yc + Math.sqrt(Rc * Rc - x * x);
    if (ya <= 0.02) continue;
    const u = (x + 3.2) / 6.4; if (u > draw) continue;
    const q0 = proj(cam, [x, ya, z]), q1 = proj(cam, [x, 0, z]);
    if (q0 && q1) { X.moveTo(q0.x, q0.y); X.lineTo(q1.x, q1.y); }
  }
  thin(C.gold, 1.1, a * 0.6);
  // bracing between the twin arches
  X.beginPath();
  for (let i = 1; i < 12; i++) {
    const an = lerp(a1, a0, i / 12), an2 = lerp(a1, a0, (i + 1) / 12);
    const pa = [Math.cos(an) * Rc, yc + Math.sin(an) * Rc], pb = [Math.cos(an2) * Rc, yc + Math.sin(an2) * Rc];
    const q0 = proj(cam, [pa[0], pa[1], -0.7]), q1 = proj(cam, [pb[0], pb[1], 0.7]);
    if (q0 && q1 && i / 12 < draw) { X.moveTo(q0.x, q0.y); X.lineTo(q1.x, q1.y); }
  }
  thin(C.cyan, 1, a * 0.3);
  // piers + water
  for (const sx of [-3.2, 3.2]) for (const z of [-0.7, 0.7]) { path3(cam, [[sx, -0.6, z], [sx, -1.4, z]]); thin(C.white, 1.2, a * 0.5); }
  dashed3(cam, [[-6, -1.4, -1.2], [6, -1.4, -1.2]], C.cyan, 1, a * 0.25, [2, 9], -lt * 25);
}
function itemDish(lt, m, a) {
  const V = [0, 0.4, 0];
  const cam = orbitCam([0, 0.2, 0], 6.0 * m, 0.95 - 0.25 * lt, 0.14, 40);
  const el = 0.72, az = -0.6 + 0.18 * lt;
  const w = [Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)];
  const u = norm(cross(w, [0, 1, 0])), v = cross(u, w), f = 0.9;
  const P = (rho, al) => add(V, add(mul(w, (rho * rho) / (4 * f)), add(mul(u, Math.cos(al) * rho), mul(v, Math.sin(al) * rho))));
  const grow = io3(seg(lt, 0, 0.7));
  for (let rho = 0.3; rho <= 1.51; rho += 0.3) {
    const pts = []; for (let i = 0; i <= 80; i++) pts.push(P(rho * grow, (i / 80) * TAU));
    path3(cam, pts); neon(rho > 1.4 ? C.cyan : C.white, rho > 1.4 ? 1.8 : 1, a * (rho > 1.4 ? 1 : 0.4), 0.5);
  }
  X.beginPath();
  for (let k = 0; k < 18; k++) {
    const al = (k / 18) * TAU; let first = true;
    for (let rho = 0; rho <= 1.5 * grow + 0.001; rho += 0.1) { const q = proj(cam, P(rho, al)); if (!q) continue; if (first) { X.moveTo(q.x, q.y); first = false; } else X.lineTo(q.x, q.y); }
  }
  thin(C.cyan, 1, a * 0.3);
  const Fp = add(V, mul(w, f * grow));
  for (let k = 0; k < 4; k++) { path3(cam, [P(1.5 * grow, (k / 4) * TAU + 0.4), Fp]); thin(C.white, 1, a * 0.45); }
  const fq = proj(cam, Fp); if (fq) lensFlare(fq.x, fq.y, 8, 'gold', a * 0.9, false);
  // pedestal
  path3(cam, [V, [0, -1.1, 0]]); neon(C.white, 1.4, a * 0.6, 0.3);
  path3(cam, circlePts([0, -1.1, 0], 0.5, 0, TAU, 50, 'xz')); thin(C.white, 1, a * 0.4);
  path3(cam, [[-0.35, -1.1, 0], V, [0.35, -1.1, 0]]); thin(C.white, 1, a * 0.3);
  piMark(cam, add(V, mul(w, 0.02)), 0.45, a * 0.2);
  // outgoing wavefronts
  for (let k = 0; k < 5; k++) {
    const ph = (lt * 0.9 + k * 0.22) % 1.1;
    const cc = add(V, mul(w, 1.0 + ph * 3.2)), rr = 1.5 + ph * 0.8, pts = [];
    for (let i = 0; i <= 80; i++) { const al = (i / 80) * TAU; pts.push(add(cc, add(mul(u, Math.cos(al) * rr), mul(v, Math.sin(al) * rr)))); }
    path3(cam, pts); neon(C.gold, 1.3, a * (1 - ph / 1.1) * 0.7 * smooth(seg(lt, 0.5, 0.9)), 0.4);
  }
}
function itemWheel(lt, m, a, collapse = 0) {
  const xw = 1.7 * lt;
  const cam = orbitCam([xw + 0.3, 0.05, 0], 5.0 * m, -0.38 + 0.08 * lt, 0.12, 40);
  const sc = 1 - i3(collapse);
  const th = -xw / 1.38 - collapse * 8;
  const ctr = [xw, 0, 0];
  const T = (p) => add(ctr, mul(rotZ(p, th), sc));
  // ground with sliding ticks
  const ga = a * (1 - collapse);
  path3(cam, [[xw - 7, -1.38, 0], [xw + 7, -1.38, 0]]); thin(C.white, 1, 0.35 * ga);
  X.beginPath();
  for (let x = Math.floor(xw - 7); x < xw + 7; x += 0.5) { const q0 = proj(cam, [x, -1.38, 0]), q1 = proj(cam, [x, -1.48, 0]); if (q0 && q1) { X.moveTo(q0.x, q0.y); X.lineTo(q1.x, q1.y); } }
  thin(C.white, 1, 0.3 * ga);
  for (const z of [-0.12, 0.12]) {
    path3(cam, circlePts([0, 0, z], 1.38, 0, TAU, 120).map(T)); neon(C.cyan, 1.8, a * (z < 0 ? 1 : 0.5), 0.6);
    path3(cam, circlePts([0, 0, z], 1.24, 0, TAU, 120).map(T)); thin(C.cyan, 1, a * 0.5);
    path3(cam, circlePts([0, 0, z * 0.6], 0.16, 0, TAU, 30).map(T)); thin(C.gold, 1.4, a * 0.9);
  }
  // spokes with rotational motion blur
  for (let b = 0; b < 4; b++) {
    X.beginPath();
    for (let k = 0; k < 24; k++) {
      const ah = (k / 24) * TAU + b * 0.035, side = k % 2 ? 0.08 : -0.08, ar = ah + (k % 4 < 2 ? 0.55 : -0.55);
      const q0 = proj(cam, T([Math.cos(ah) * 0.16, Math.sin(ah) * 0.16, side])), q1 = proj(cam, T([Math.cos(ar) * 1.24, Math.sin(ar) * 1.24, side * 0.3]));
      if (q0 && q1) { X.moveTo(q0.x, q0.y); X.lineTo(q1.x, q1.y); }
    }
    thin(b ? C.white : C.white, 1, a * [0.55, 0.25, 0.14, 0.07][b]);
  }
  piMark(cam, T([0, 0, -0.13]), 0.5 * sc + 0.0001, a * 0.12);
  // speed lines
  for (let k = 0; k < 10; k++) {
    const y = -1.1 + hash(k) * 2.4, len = 1 + hash(k + 5) * 2, x0 = xw - 1.6 - ((lt * 6 + hash(k + 9) * 8) % 8);
    path3(cam, [[x0 - len, y, -0.4], [x0, y, -0.4]]); thin(C.cyan, 1, 0.25 * ga);
  }
  return cam;
}

const ITEMS = [
  { t0: 58.0, t1: 63.3 },
  { t0: 63.3, t1: 65.7, f: itemGears },
  { t0: 65.7, t1: 67.9, f: itemBridge },
  { t0: 67.9, t1: 70.0, f: itemDish },
  { t0: 70.0, t1: 72.0, f: itemWheel },
];
function shot6(t) {
  GA = 1;
  for (let i = 0; i < ITEMS.length; i++) {
    const it = ITEMS[i];
    if (t < it.t0 - 0.25 || t > it.t1 + 0.25) continue;
    const kin = i === 0 ? 1 : seg(t, it.t0 - 0.25, it.t0 + 0.3);
    const kout = i === ITEMS.length - 1 ? 0 : seg(t, it.t1 - 0.3, it.t1 + 0.25);
    const m = lerp(2.4, 1, oexpo(kin)) * lerp(1, 0.18, i3(kout));
    const a = smooth(kin) * (1 - smooth(kout));
    if (i === 0) {
      const a0 = smooth(seg(t, 58.3, 58.7)) * (1 - smooth(kout));
      if (a0 <= 0) continue;
      GA = a0; withZoom(1 / m, () => itemPlanet(t, 1)); GA = 1;
      continue;
    }
    GA = a; it.f(t - it.t0, m, 1); GA = 1;
    // whoosh streak at each cut
    const ws = bump(t, it.t0, 0.12);
    if (ws > 0.02) { sprite(SPR.cyan, CX, CY, 1400 * ws, 30 * ws, 0.5 * ws); sprite(SPR.hot, CX, CY, 900 * ws, 4, 0.6 * ws); }
  }
  dust(camF(clamp(t, 58, 63)), t, 0.5);
}
// 2D zoom about the screen centre (used for the planet's zoom-through)
function withZoom(z, fn) {
  X.setTransform(SC * z, 0, 0, SC * z, SC * CX * (1 - z), SC * CY * (1 - z));
  fn();
  X.setTransform(SC, 0, 0, SC, 0, 0);
}

// ─── SHOT 7 — the most beautiful equation (72–82s) ──────────────────────────
const EQ_T = [74.0, 74.6, 75.2, 75.9, 76.5, 77.2, 78.1];
function buildEquation() {
  const M = 176, g = mk(10, 10).getContext('2d');
  const toks = [
    { s: 'e', f: FONT.math, k: 1, col: 'cyan', dir: [-1, 0.15], z: 0.4 },
    { s: 'i', f: FONT.math, k: 0.6, col: 'violet', dir: [0.1, -1], z: 2.2, sup: true },
    { s: 'π', f: FONT.math, k: 0.6, col: 'gold', dir: [1, -0.6], z: 0.3, sup: true },
    { s: '+', f: FONT.serif, k: 1, col: 'white', dir: [0, 1], z: 2.4, gapL: 0.34 },
    { s: '1', f: FONT.serif, k: 1, col: 'cyan', dir: [-0.8, 0.8], z: 0.35, gapL: 0.3 },
    { s: '=', f: FONT.serif, k: 1, col: 'white', dir: [0.7, -0.9], z: 2.2, gapL: 0.34 },
    { s: '0', f: FONT.serif, k: 1, col: 'gold', dir: [1, 0.25], z: 0.3, gapL: 0.34 },
  ];
  let x = 0;
  toks.forEach((tk) => {
    g.font = tk.f(M * tk.k);
    x += (tk.gapL || 0) * M;
    if (tk.s === 'i') x += 0.04 * M;
    tk.w = g.measureText(tk.s).width; tk.x = x; x += tk.w;
    tk.px = M * tk.k;
  });
  const total = x, base = CY + 0.34 * M;
  toks.forEach((tk) => { tk.x += CX - total / 2; tk.y = tk.sup ? base - 0.5 * M : base; tk.cx = tk.x + tk.w / 2; });
  EQ = toks;
  // equation pixels -> particle starts for shot 8
  const c = mk(W, H), cg = c.getContext('2d');
  cg.fillStyle = '#fff'; cg.textBaseline = 'alphabetic'; cg.textAlign = 'left';
  toks.forEach((tk) => { cg.font = tk.f(tk.px); cg.fillText(tk.s, tk.x, tk.y); });
  const d = cg.getImageData(0, 0, W, H).data, pts = [];
  for (let y = 0; y < H; y += 4) for (let x2 = 0; x2 < W; x2 += 4) if (d[(y * W + x2) * 4 + 3] > 128) pts.push([x2, y]);
  const r = rng(21);
  EQ_PTS = pts.map(([px, py], i) => {
    const tk = toks.reduce((b, k) => (Math.abs(k.cx - px) < Math.abs(b.cx - px) ? k : b));
    return { x: px, y: py, d: r() * 0.5, sw: (r() - 0.5) * 300, col: tk.col, ang: r() * TAU };
  });
}
function shot7(t) {
  GA = 1;
  // collapse of the wheel into a singularity
  if (t < 73.4) {
    const col = seg(t, 72.0, 73.2);
    const c = itemWheel(t - 70.0, 1, 1 - smooth(seg(t, 72.9, 73.3)), col);
    for (let k = 0; k < 160; k++) {
      const r0 = 300 + hash(k) * 900, a0 = hash(k + 300) * TAU;
      const u = i3(clamp(col * 1.15 - hash(k + 600) * 0.15));
      const rr = r0 * (1 - u), aa = a0 + u * 3;
      const rp = r0 * (1 - i3(clamp((col - 0.03) * 1.15 - hash(k + 600) * 0.15))), ap = a0 + u * 3 - 0.15;
      if (u <= 0 || u >= 1) continue;
      X.beginPath(); X.moveTo(CX + Math.cos(ap) * rp, CY + Math.sin(ap) * rp); X.lineTo(CX + Math.cos(aa) * rr, CY + Math.sin(aa) * rr);
      thin(C[['cyan', 'violet', 'gold'][k % 3]], 1.4, 0.7 * smooth(col * 4));
    }
  }
  // singularity
  const sing = smooth(seg(t, 72.6, 73.2)) * (1 - smooth(seg(t, 73.9, 74.2)));
  if (sing > 0) lensFlare(CX, CY, 40 * (1 + 0.25 * Math.sin(t * 18)), 'white', sing);
  if (t < 73.6) return;
  const bgA = smooth(seg(t, 73.6, 74.4));
  // background: rays, rings, grid
  const fin = flash(t, 78.1, 0.6);
  const zoom = 1 + 0.035 * Math.max(0, t - 78.1);
  X.setTransform(SC * zoom, 0, 0, SC * zoom, SC * CX * (1 - zoom), SC * CY * (1 - zoom));
  for (let k = 0; k < 36; k++) {
    const an = (k / 36) * TAU + t * 0.03;
    X.beginPath(); X.moveTo(CX + Math.cos(an) * 260, CY + Math.sin(an) * 260); X.lineTo(CX + Math.cos(an) * 1300, CY + Math.sin(an) * 1300);
    thin(k % 3 ? C.violet : C.cyan, 1, bgA * (0.04 + 0.1 * fin));
  }
  for (let k = 0; k < 5; k++) {
    const rr = 420 + k * 70;
    X.beginPath(); X.ellipse(CX, CY, rr * 1.35, rr * 0.55, 0, t * (0.1 + k * 0.03) * (k % 2 ? -1 : 1), t * (0.1 + k * 0.03) * (k % 2 ? -1 : 1) + 2.4 + k * 0.4);
    thin(k % 2 ? C.gold : C.cyan, 1, bgA * 0.18);
  }
  X.setLineDash([1.5, 9]);
  X.beginPath(); X.ellipse(CX, CY, 780, 330, 0, 0, TAU); thin(C.white, 1, bgA * 0.25);
  X.setLineDash([]);
  // shockwave on final lock
  if (fin > 0.01) {
    const rr = 50 + o3(seg(t, 78.1, 79.6)) * 1300;
    X.beginPath(); X.arc(CX, CY, rr, 0, TAU); neon(C.white, 3, fin * 0.7, 0.6);
    X.beginPath(); X.arc(CX, CY, rr * 0.7, 0, TAU); neon(C.gold, 2, fin * 0.4, 0.5);
  }
  // symbols
  const sweep = lerp(-300, W + 300, seg(t, 78.5, 80.6));
  EQ.forEach((tk, i) => {
    const T = EQ_T[i];
    if (t < T - 0.8) return;
    const pose = (tt) => {
      const u = clamp((tt - (T - 0.75)) / 0.75);
      const e = 1 - (1 - u) ** 4;
      const zf = lerp(tk.z, 1, e);
      return { x: tk.x + tk.dir[0] * 1500 * (1 - e), y: tk.y + tk.dir[1] * 900 * (1 - e), s: zf, u };
    };
    const lockF = flash(t, T, 0.3);
    const dissolve = 1 - smooth(seg(t, 82.0, 82.35));
    const bright = 0.9 + 0.5 * lockF + 0.3 * fin + 0.5 * bump(tk.cx, sweep, 120);
    const draw = (p, a) => {
      X.save();
      X.translate(p.x + tk.w / 2, p.y - tk.px * 0.3);
      X.scale(p.s, p.s);
      text(tk.s, -tk.w / 2, tk.px * 0.3, tk.px, tk.f, C[tk.col], a, 'left', 'alphabetic');
      X.restore();
    };
    const p = pose(t);
    if (p.u < 1) for (let k = 6; k >= 1; k--) draw(pose(t - k * 0.02), 0.12 * (1 - k / 7));
    draw(p, clamp(bright) * dissolve * smooth(p.u * 3));
    if (bright > 1) draw(p, (bright - 1) * dissolve);
    if (lockF > 0.02) {
      const gx = tk.cx, gy = tk.y - tk.px * 0.32;
      sprite(RING, gx, gy, 40 + (1 - lockF) * 160, 40 + (1 - lockF) * 160, lockF * 0.6);
      lensFlare(gx, gy, 26, tk.col, lockF * 0.8);
      for (let k = 0; k < 14; k++) {
        const an = hash(k + i * 40) * TAU, sp = 80 + hash(k + i * 40 + 7) * 260, age = t - T;
        glow(gx + Math.cos(an) * sp * age * 2, gy + Math.sin(an) * sp * age * 2, 3, tk.col, lockF);
      }
    }
  });
  if (fin > 0.01) lensFlare(CX, CY, 160, 'gold', fin * 0.8);
  X.setTransform(SC, 0, 0, SC, 0, 0);
}

// ─── SHOT 8 — outro (82–90s) ────────────────────────────────────────────────
function buildGiantPi() {
  const px = 900, c = mk(1200, 1300), g = c.getContext('2d');
  g.font = FONT.serif(px); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
  g.fillText('π', 600, 650);
  const d = g.getImageData(0, 0, 1200, 1300).data;
  let y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9;
  for (let y = 0; y < 1300; y += 2) for (let x = 0; x < 1200; x += 2) if (d[(y * 1200 + x) * 4 + 3] > 128) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  const hgt = y1 - y0, rows = 34, sp = hgt / rows, cxp = (x0 + x1) / 2, cyp = (y0 + y1) / 2;
  const out = [];
  for (let j = -2; j <= rows + 2; j++) {
    const y = y0 + j * sp * 0.866;
    for (let i = -2; i < (x1 - x0) / sp + 3; i++) {
      const x = x0 + i * sp + (j % 2 ? sp / 2 : 0);
      const xi = Math.round(x), yi = Math.round(y);
      if (xi < 0 || yi < 0 || xi >= 1200 || yi >= 1300) continue;
      if (d[(yi * 1200 + xi) * 4 + 3] > 128) out.push({ p: [(x - cxp) / sp, -(y - cyp) / sp, 0] });
    }
  }
  // hero circle: one near the left end of the top bar
  let hero = 0, best = 1e9;
  const goal = [-6, 12];
  out.forEach((c2, i) => { const dd = Math.hypot(c2.p[0] - goal[0], c2.p[1] - goal[1]); if (dd < best) { best = dd; hero = i; } });
  const H0 = out[hero].p;
  let maxd = 0;
  out.forEach((c2, i) => {
    c2.d = Math.hypot(c2.p[0] - H0[0], c2.p[1] - H0[1]); maxd = Math.max(maxd, c2.d);
    c2.ph = hash(i) * TAU;
  });
  const xs = out.map((o) => o.p[0]), xmin = Math.min(...xs), xmax = Math.max(...xs);
  out.forEach((o) => { const u = (o.p[0] - xmin) / (xmax - xmin); o.col = u < 0.5 ? mixc(C.cyan, C.violet, u * 2) : mixc(C.violet, C.gold, (u - 0.5) * 2); });
  GIANT = { circles: out, hero, H0, maxd };
}
function camH(t) {
  const H0 = GIANT.H0;
  const u = io3(seg(t, 83.8, 88.2));
  const D = Math.exp(lerp(Math.log(2.6), Math.log(64), u));
  const v = io2(seg(t, 84.4, 88.4));
  const tgt = [lerp(H0[0], 0, v), lerp(H0[1], -0.5, v), 0];
  return orbitCam(tgt, D, 0.04 * Math.sin(t * 0.3) * u, 0.02 * u, 40, lerp(0, 0.06, u));
}
function shot8(t) {
  GA = 1;
  // equation dissolves into particles that become one circle
  if (t < 84.2) {
    const R = 240;
    EQ_PTS.forEach((p, i) => {
      if (i % 2) return;
      const at = (tt) => {
        const u = io3(seg(tt, 82.05 + p.d, 82.05 + p.d + 1.0));
        const an = (i / EQ_PTS.length) * TAU * 1 - PI / 2;
        const tx = CX + Math.cos(an) * R, ty = CY + Math.sin(an) * R;
        const sw = Math.sin(u * PI) * p.sw;
        return [lerp(p.x, tx, u) + Math.cos(p.ang) * sw, lerp(p.y, ty, u) + Math.sin(p.ang) * sw];
      };
      const [x, y] = at(t), [xp, yp] = at(t - 0.03);
      const a = smooth(seg(t, 82.0, 82.3)) * (1 - smooth(seg(t, 83.5, 84.0)));
      if (a <= 0.01) return;
      X.beginPath(); X.moveTo(xp, yp); X.lineTo(x, y); thin(C[p.col], 1.2, 0.5 * a);
      glow(x, y, 2.6, p.col, a * 0.8);
    });
  }
  const cam = camH(t);
  const ex = smooth(seg(t, 83.2, 83.8));
  if (ex <= 0) return;
  const pulseEnd = bump(t, 88.9, 0.18);
  const revealR = lerp(-2, GIANT.maxd + 4, io2(seg(t, 84.2, 87.6)));
  GIANT.circles.forEach((c, i) => {
    const isHero = i === GIANT.hero;
    const a = isHero ? ex : smooth(seg(revealR - c.d, 0, 4));
    if (a <= 0.01) return;
    const q = proj(cam, c.p); if (!q) return;
    const r = 0.42 * q.s;
    if (q.x < -r - 20 || q.x > W + r + 20 || q.y < -r - 20 || q.y > H + r + 20) return;
    const lw = clamp(r / 40, 0.9, 2.4);
    const tw = 0.8 + 0.2 * Math.sin(t * 2.5 + c.ph);
    const col = isHero ? mixc(C.cyan, c.col, seg(t, 84, 86)) : c.col;
    X.beginPath(); X.arc(q.x, q.y, r, 0, TAU);
    neon(col, lw * (1 + pulseEnd), a * tw * (1 + 0.5 * pulseEnd), 0.55);
    if (r > 30) { X.beginPath(); X.arc(q.x, q.y, r * 1.12, t * 0.5 + c.ph, t * 0.5 + c.ph + 1.1); thin(C.violet, 1, a * 0.4 * clamp((r - 30) / 60)); }
    glow(q.x, q.y, Math.max(1.5, r * 0.05), 'white', a * 0.6);
  });
  // giant π glow binding the field together
  const ga = smooth(seg(t, 86.4, 88.0));
  if (ga > 0) {
    const q = proj(cam, [0, 0, 0]);
    if (q) glow(q.x, q.y, 40 * q.s * 0.5, 'violet', 0.12 * ga * (1 + pulseEnd));
  }
  if (pulseEnd > 0.02) glow(CX, CY, 900, 'gold', 0.12 * pulseEnd);
  dust(cam, t, 0.35 * ex, 2);
}

// ─── master timeline ────────────────────────────────────────────────────────
function drawFilm(t) {
  if (t < 32.05) {
    const cam = camA(t);
    dust(cam, t, smooth(seg(t, 1.0, 4.0)) * (t > 31.5 ? 1 - seg(t, 31.5, 32) : 1));
    if (t < 18.6) shot1(t, cam);
    if (t >= 8.0 && t < 21.0) shot2(t, cam);
    if (t >= 20.2) shot3(t, cam);
  }
  if (t >= 32.0 && t < 45.8) shot4(t, camD(t));
  if (t >= 45.0 && t < 58.7) { const cam = camE(t); dust(cam, t, 0.6 * smooth(seg(t, 45.4, 46.5))); shot5(t, cam); }
  if (t >= 58.0 && t < 72.0) shot6(t);
  if (t >= 72.0 && t < 82.4) shot7(t);
  if (t >= 82.0) shot8(t);
}

function exposure(t) {
  return (1 - smooth(seg(t, 88.3, 89.85))) * (1 + 0.5 * bump(t, 88.9, 0.18));
}
