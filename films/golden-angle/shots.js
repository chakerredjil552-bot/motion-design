// 137.5° — the golden angle. Cue times come from timeline.js (shared with audio.py).

const TL = window.TL;
const GOLDEN = PI * (3 - Math.sqrt(5)); // 137.50776…° in radians
const GOLDEN_DEG = (GOLDEN * 180) / PI;
const PHI = (1 + Math.sqrt(5)) / 2;
const RAD = PI / 180;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];

// ─── shared helpers ─────────────────────────────────────────────────────────
const GRAD = []; // seed colour ramp: green → gold → amber → rose
const ramp = (u) => GRAD[Math.round(clamp(u) * (GRAD.length - 1))];
function rotAxis(v, k, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot3(k, v) * (1 - c)));
}
// turn the camera in place around its own up ('u') or right ('r') axis
function panned(cam, axis, ang) {
  if (Math.abs(ang) < 1e-6) return cam;
  const d = rotAxis(sub(cam.target, cam.pos), axis === 'u' ? cam.u : cam.r, ang);
  return camera(cam.pos, add(cam.pos, d), cam.fov, cam.roll);
}
function whipState(t) {
  for (let i = 0; i < TL.whips.length; i++) {
    const w = TL.whips[i];
    if (t < w - 0.3 || t >= w + 0.3) continue;
    const amt = 0.85 * (i % 2 ? -1 : 1), axis = i % 3 === 2 ? 'r' : 'u';
    const ang = t < w ? amt * i3(seg(t, w - 0.3, w)) : -amt * (1 - o3(seg(t, w, w + 0.3)));
    return { axis, ang };
  }
  return null;
}
const impactK = (t, d = 0.3) => TL.impacts.reduce((s, i) => s + flash(t, i, d), 0);
// impacts shake the camera, whips swing it hard around its own axis
function rig(cam, t) {
  const k = impactK(t);
  if (k > 0.003) {
    const a = 0.022 * k;
    cam = panned(cam, 'u', a * Math.sin(t * 97) * Math.cos(t * 41));
    cam = panned(cam, 'r', a * Math.sin(t * 83 + 1.3) * Math.cos(t * 29));
  }
  const ws = whipState(t);
  return ws ? panned(cam, ws.axis, ws.ang) : cam;
}
function seedDot(cam, p, size, key, a, aperture = 0.025) {
  if (a <= 0.004) return;
  const q = proj(cam, p);
  if (!q || q.x < -80 || q.x > W + 80 || q.y < -80 || q.y > H + 80) return;
  const coc = Math.abs(1 / q.z - 1 / cam.dist) * cam.F * aperture;
  const r = Math.max(0.9, size * q.s) + coc;
  if (r > 140) return;
  // big (near or defocused) seeds get dimmer so overlaps don't burn out to white
  glow(q.x, q.y, r * 1.55, key, (0.62 * a) / (1 + coc * 0.12) / (1 + r / 26));
}
function fullFlash(a, col = C.white) {
  if (a <= 0.003) return;
  X.globalAlpha = 1; X.fillStyle = rgba(col, a); X.fillRect(0, 0, W, H); X.globalAlpha = GA;
}
// kinetic title: letters slam in from big to size, then the word punches away
function slam(t, t0, t1, str, px, y = CY, col = C.white, track = 0.06) {
  if (t < t0 || t > t1) return;
  X.font = FONT.title(px);
  const ws = [...str].map((ch) => X.measureText(ch).width + px * track);
  const total = ws.reduce((a, b) => a + b, 0) - px * track;
  const out = io3(seg(t, t1 - 0.28, t1));
  let x = CX - (total / 2) * (1 + out * 0.6);
  [...str].forEach((ch, i) => {
    const u = seg(t, t0 + i * 0.03, t0 + i * 0.03 + 0.22);
    const s = lerp(2.6, 1, o3(u)) * (1 + out * 0.6);
    const a = smooth(u * 1.6) * (1 - out);
    const cx = x + (ws[i] * (1 + out * 0.6)) / 2;
    X.save(); X.translate(cx, y); X.scale(s, s);
    text(ch, 0, px * 0.36, px, FONT.title, col, 0.85 * a, 'center', 'alphabetic');
    X.restore();
    x += ws[i] * (1 + out * 0.6);
  });
  glow(CX, y, total * 0.55, 'gold', 0.1 * (1 - out) * smooth(seg(t, t0, t0 + 0.3)));
}
// HUD caption, bottom-left, typed on
function hudTag(t, t0, t1, title, subline, idx, total) {
  const a = smooth(seg(t, t0 + 0.1, t0 + 0.35)) * (1 - smooth(seg(t, t1 - 0.35, t1 - 0.1)));
  if (a <= 0.003) return;
  const n = Math.ceil(clamp((t - t0 - 0.1) / 0.45) * title.length);
  const m = Math.ceil(clamp((t - t0 - 0.4) / 0.5) * subline.length);
  const x = 96, y = H - 118;
  X.beginPath(); X.moveTo(x - 24, y - 70); X.lineTo(x - 24, y + 34); thin(C.gold, 2, a * 0.9);
  X.beginPath(); X.moveTo(x - 24, y - 70); X.lineTo(x - 8, y - 70); thin(C.gold, 2, a * 0.9);
  text(`${String(idx).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, x, y - 50, 18, FONT.mono, C.gold, a * 0.8, 'left', 'alphabetic');
  const cur = Math.floor(t * 4) % 2 && n >= title.length ? '' : '_';
  text(title.slice(0, n) + (n < title.length ? cur : ''), x, y, 46, FONT.title, C.white, a, 'left', 'alphabetic');
  text(subline.slice(0, m), x, y + 30, 20, FONT.mono, C.green, a * 0.9, 'left', 'alphabetic');
}

// ─── models ─────────────────────────────────────────────────────────────────
const SUN = { N: 1600, c: 0.0512, R: 2.05 };
let PETALS, PINE, ALOE, ROM, LEAVES, MIRRORS, SPHERE, ARRAY, SQUARES, EYE;

function initShots() {
  const stops = [C.green, C.gold, C.amber, C.rose];
  for (let k = 0; k < 14; k++) {
    const u = (k / 13) * 3, i = Math.min(2, Math.floor(u));
    const key = 'g' + k; SPR[key] = makeDot(mixc(stops[i], stops[i + 1], u - i)); GRAD.push(key);
  }
  const r = rng(137);
  PETALS = Array.from({ length: 55 }, (_, k) => ({ a: k * GOLDEN, r0: 1.98 + 0.07 * (k % 3), L: 1.15 + 0.35 * r(), w: 0.3 + 0.08 * r() }));
  PINE = Array.from({ length: 130 }, (_, i) => {
    const s = i / 129;
    return { s, y: -1.45 + 2.9 * s, R: 0.95 * Math.pow(Math.sin(PI * (0.08 + 0.84 * s)), 0.75) * (1.05 - 0.35 * s), a: i * GOLDEN };
  });
  ALOE = Array.from({ length: 72 }, (_, i) => {
    const u = i / 71;
    return { u, a: i * GOLDEN, L: 0.32 + 1.8 * Math.pow(u, 0.8), elev: lerp(1.3, 0.16, Math.pow(u, 0.85)), r0: 0.04 + 0.22 * u };
  });
  buildRomanesco();
  LEAVES = Array.from({ length: 16 }, (_, i) => ({ y: 1.75 - i * 0.24, a: i * GOLDEN, L: 0.42 + 0.085 * i }));
  MIRRORS = Array.from({ length: 650 }, (_, i) => {
    const n = i + 1, rr = 0.9 + 0.17 * Math.sqrt(n), a = n * GOLDEN;
    return { p: [rr * Math.cos(a), 0.05, rr * Math.sin(a)], rr };
  });
  const NS = 640;
  SPHERE = Array.from({ length: NS }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / NS, rad = Math.sqrt(1 - y * y), a = i * GOLDEN;
    // clumpy random start: Gaussian blobs around a few centres
    const ctr = norm([Math.cos(i % 7), Math.sin(i % 5) * 0.8, Math.sin(i % 7 * 1.7)]);
    const rnd = norm(add(ctr, [(r() - 0.5) * 1.1, (r() - 0.5) * 1.1, (r() - 0.5) * 1.1]));
    return { L: [rad * Math.cos(a), y, rad * Math.sin(a)], R: rnd };
  });
  ARRAY = Array.from({ length: 240 }, (_, i) => { const rr = 0.1 * Math.sqrt(i + 0.5), a = i * GOLDEN; return { p: [rr * Math.cos(a), rr * Math.sin(a), 0], rr }; });
  buildSquares();
}

function sunflowerSeed(n, c = SUN.c, dome = 1) {
  const rr = c * Math.sqrt(n), a = n * GOLDEN;
  return [rr * Math.cos(a), dome * 0.3 * (1 - (rr / SUN.R) ** 2), rr * Math.sin(a)];
}
function drawPetals(cam, bloom, a, t0 = 0, spin = 0) {
  if (a <= 0.003) return;
  PETALS.forEach((pt, k) => {
    const g = o3(clamp((bloom - k * 0.008) * 1.6));
    if (g <= 0.01) return;
    const ang = pt.a + spin;
    const dir = [Math.cos(ang), 0, Math.sin(ang)], perp = [-Math.sin(ang), 0, Math.cos(ang)];
    const base = mul(dir, pt.r0), L = pt.L * g;
    const P = (s, w) => add(add(add(base, mul(dir, s * L)), mul(perp, w)), [0, 0.38 * s * s * g, 0]);
    const pts = [];
    for (let i = 0; i <= 16; i++) { const s = i / 16; pts.push(P(s, 0.5 * pt.w * Math.pow(Math.sin(PI * s), 0.7))); }
    for (let i = 16; i >= 0; i--) { const s = i / 16; pts.push(P(s, -0.5 * pt.w * Math.pow(Math.sin(PI * s), 0.7))); }
    path3(cam, pts, true);
    X.fillStyle = rgba(C.amber, 0.035 * a); X.globalAlpha = GA; X.fill();
    neon(k % 2 ? C.gold : C.amber, 1.2, a * 0.75, 0.4);
    path3(cam, [P(0.08, 0), P(0.85, 0)]); thin(C.gold, 1, a * 0.25);
  });
}
function drawSunflower(cam, t, o) {
  const N = o.N || SUN.N, a = o.alpha ?? 1;
  for (let n = 0; n < N; n++) {
    const p = sunflowerSeed(n, SUN.c, o.dome ?? 1);
    const pr = o.spin ? rotY(p, o.spin) : p;
    const u = Math.sqrt(n / SUN.N);
    const tw = 0.85 + 0.15 * Math.sin(t * 3 + n);
    seedDot(cam, pr, 0.02 + 0.016 * u, ramp(u * 0.85), a * tw, o.aperture ?? 0.025);
  }
  drawPetals(cam, o.petals ?? 1, a, 0, o.spin || 0);
}

// ════════════════════════════════════════════════════════════════════════════
// A — hook + experiment (0 – 21s): seeds on the ground plane (x, z), y is up
// ════════════════════════════════════════════════════════════════════════════
const TH_KEYS = (() => {
  const k = [];
  TL.snaps.forEach(([ts, d], i) => {
    k.push([ts, d, io3]);
    k.push([i + 1 < TL.snaps.length ? TL.snaps[i + 1][0] - 0.6 : TL.golden - 1.1, d]);
  });
  k.push([TL.golden, GOLDEN_DEG, o5]);
  return k;
})();
const thetaDeg = (t) => track(t, TH_KEYS);
const HOOK_KEYS = (() => {
  const k = [[0, 0]];
  let prev = 0;
  TL.hookClicks.forEach((c, i) => { k.push([c, prev]); k.push([c + 0.22, TL.hookAngles[i], oback]); prev = TL.hookAngles[i]; });
  return k;
})();
const seedsN = (t) => clamp((t - TL.seedsFrom) * TL.seedRate, 0, SUN.N);
const snapK = (t, d = 0.22) => TL.snaps.reduce((s, [ts]) => s + flash(t, ts, d), 0) + flash(t, TL.golden, 0.35);

function camA(t) {
  const [d0, d1] = TL.dive;
  const orbit = (tt) => {
    const D = track(tt, [[0, 2.4], [5.2, 3.3], [6.2, 5.0, io5], [8.0, 5.3], [10.4, 5.7], [11.0, 5.1], [12.6, 5.7], [13.2, 4.6], [15.4, 4.4], [TL.golden, 6.6, o5], [d0, 7.6]]) * (1 - 0.09 * snapK(tt));
    const pitch = track(tt, [[0, 0.32], [5.2, 0.55], [6.2, 1.5, io5], [12.6, 1.5], [13.4, 0.72], [15.4, 0.8], [TL.golden, 1.53, o5], [17.6, 1.4], [d0, 1.05]]);
    const yaw = track(tt, [[0, 0.4], [5.2, 1.6], [6.2, 2.4], [8.0, 2.8], [8.6, 3.6], [10.4, 3.9], [11.0, 4.5], [12.6, 4.8], [15.4, 6.6], [TL.golden, 7.2], [d0, 8.6]]);
    const fov = track(tt, [[0, 52], [6.2, 46], [TL.golden, 46], [17.2, 40], [d0, 44]]);
    return orbitCam([0, 0, 0], D, yaw, pitch, fov);
  };
  if (t < d0) return orbit(t);
  // crane dive: skim the seeds, cross the centre, pitch up into the sky
  const c0 = orbit(d0), az = norm([c0.pos[0], 0, c0.pos[2]]);
  const Pa = add(mul(az, 2.7), [0, 0.42, 0]), Pb = add(mul(az, -1.2), [0, 0.6, 0]);
  const u1 = io3(seg(t, d0, 19.7)), u2 = seg(t, 19.7, d1);
  let pos, tgt;
  if (t < 19.7) { pos = vlerp(c0.pos, Pa, u1); tgt = vlerp([0, 0, 0], [0, 0.15, 0], u1); }
  else { pos = vlerp(Pa, Pb, io2(u2)); tgt = vlerp([0, 0.15, 0], add(mul(az, -4), [0, 3.2, 0]), i3(u2)); }
  return camera(pos, tgt, lerp(44, 78, smooth(seg(t, d0, 19.7))), 0.25 * smooth(seg(t, 19.7, d1)));
}

function shotA(t) {
  const cam = rig(camA(t), t);
  dust(cam, t, smooth(seg(t, 1, 3)) * 0.8, 1.2);
  const th = thetaDeg(t) * RAD;
  const N = seedsN(t);
  const dome = smooth(seg(t, TL.golden, 18.0));
  const hookA = 1 - smooth(seg(t, 5.3, 6.0));
  const dialR = lerp(1.6, 2.4, io3(seg(t, 5.3, 6.4)));

  // protractor dial on the ground
  const da = smooth(seg(t, 1.0, 2.0)) * (1 - smooth(seg(t, 18.0, 18.8)));
  if (da > 0) {
    X.beginPath();
    for (let d = 0; d < 360; d += 5) {
      const ang = d * RAD, l = d % 30 === 0 ? 0.12 : 0.05;
      const q0 = proj(cam, [Math.cos(ang) * dialR, 0, Math.sin(ang) * dialR]), q1 = proj(cam, [Math.cos(ang) * (dialR + l), 0, Math.sin(ang) * (dialR + l)]);
      if (q0 && q1) { X.moveTo(q0.x, q0.y); X.lineTo(q1.x, q1.y); }
    }
    thin(C.gold, 1, da * 0.45);
    path3(cam, circlePts([0, 0, 0], dialR, 0, TAU, 160, 'xz')); thin(C.gold, 1, da * 0.3);
    dashed3(cam, circlePts([0, 0, 0], dialR + 0.28, 0, TAU, 180, 'xz'), C.white, 1, da * 0.25, [2, 8], -t * 20);
  }
  // hook: arm clicking through random angles, asking "θ = ?"
  if (t > 0.6 && hookA > 0) {
    const al = track(t, HOOK_KEYS) * RAD;
    const tip = [Math.cos(al) * 1.45, 0, Math.sin(al) * 1.45];
    path3(cam, [[0, 0, 0], ...circlePts([0, 0, 0], 0.5, 0, al, 30, 'xz').slice(1)]); thin(C.green, 1.2, 0.5 * hookA * da);
    path3(cam, [[0, 0, 0], tip]); neon(C.gold, 2, hookA * smooth(seg(t, 0.8, 1.2)), 0.6);
    const q = proj(cam, tip), q0 = proj(cam, [0, 0, 0]);
    const ck = TL.hookClicks.reduce((s, c) => s + flash(t, c, 0.15), 0);
    if (q) lensFlare(q.x, q.y, 10 + 18 * ck, 'gold', hookA * 0.9, false);
    if (q0) lensFlare(q0.x, q0.y, 26 * smooth(seg(t, 0.6, 1.0)) + 60 * flash(t, 0.6, 0.4), 'gold', hookA);
    if (q && t > 1.2) {
      const last = t > TL.hookClicks[TL.hookClicks.length - 1] + 0.3;
      const deg = Math.round(track(t, HOOK_KEYS));
      const label = last && Math.floor(t * 6) % 2 ? 'θ = ?' : last ? 'θ = ?' : `θ = ${((deg % 360) + 360) % 360}°`;
      text(label, q.x + 26, q.y - 18, 34, FONT.mono, last ? C.gold : C.white, hookA * smooth(seg(t, 1.2, 1.5)), 'left', 'alphabetic');
    }
  }
  // the rotation machine: dial arm at θ, wedge from 0 to θ
  if (t > 5.6 && t < 18.8) {
    const ma = smooth(seg(t, 5.6, 6.1)) * (1 - smooth(seg(t, 18.0, 18.8)));
    const good = smooth(seg(t, TL.golden - 0.2, TL.golden));
    const wcol = mixc(C.rose, C.green, good);
    path3(cam, [[0, 0, 0], ...circlePts([0, 0, 0], dialR - 0.05, 0, th, 40, 'xz')], true);
    X.fillStyle = rgba(wcol, 0.022 * ma); X.globalAlpha = GA; X.fill();
    path3(cam, circlePts([0, 0, 0], dialR - 0.05, 0, th, 40, 'xz')); neon(wcol, 2, ma, 0.6);
    path3(cam, [[0, 0, 0], [Math.cos(th) * dialR, 0, Math.sin(th) * dialR]]); neon(C.gold, 1.6, ma, 0.6);
    path3(cam, [[0, 0, 0], [dialR, 0, 0]]); thin(C.white, 1, ma * 0.5);
  }
  // seeds
  if (N > 0) {
    const nMax = Math.floor(N);
    for (let n = 0; n <= nMax; n++) {
      const m = N - n; // age, measured in seeds born since this one
      if (m < 0) continue;
      const rr = SUN.c * Math.sqrt(m), a = n * th;
      const u = rr / SUN.R;
      const p = [rr * Math.cos(a), dome * 0.3 * (1 - u * u), rr * Math.sin(a)];
      const born = smooth(clamp(m * 0.5));
      seedDot(cam, p, 0.022 + 0.016 * Math.sqrt(u), ramp(u * 0.9), born * (1 - smooth(seg(t, 20.4, 20.75)) * 0.6));
    }
    const q0 = proj(cam, [0, 0, 0]);
    if (q0 && t < TL.golden + 2) glow(q0.x, q0.y, 26, 'hot', 0.6 * (1 - dome));
  }
  // gaps at rational angles
  TL.snaps.forEach(([ts], i) => {
    const next = i + 1 < TL.snaps.length ? TL.snaps[i + 1][0] - 0.6 : TL.golden - 1.1;
    const ga = smooth(seg(t, ts + 0.5, ts + 0.9)) * (1 - smooth(seg(t, next - 0.3, next)));
    const q = [4, 3, 5, 0][i];
    if (ga <= 0 || !q) return;
    for (let k = 0; k < q; k++) {
      const ang = (((k + 0.5) * 360) / q) * RAD;
      dashed3(cam, [[Math.cos(ang) * 0.35, 0, Math.sin(ang) * 0.35], [Math.cos(ang) * 2.1, 0, Math.sin(ang) * 2.1]], C.rose, 1.5, ga * (0.45 + 0.25 * Math.sin(t * 10)), [5, 7], -t * 40);
    }
  });
  // the golden moment
  const gf = flash(t, TL.golden, 0.5);
  if (gf > 0.01) {
    const q0 = proj(cam, [0, 0.2, 0]);
    if (q0) lensFlare(q0.x, q0.y, 110, 'gold', gf * 0.8);
    const rr = 2.1 + o3(seg(t, TL.golden, TL.golden + 1.3)) * 5;
    path3(cam, circlePts([0, 0, 0], rr, 0, TAU, 180, 'xz')); neon(C.gold, 3, gf * 0.8, 0.6);
    fullFlash(gf * 0.1, C.gold);
  }
  if (t >= TL.bloom) drawPetals(cam, seg(t, TL.bloom, TL.bloom + 1.2), 1 - smooth(seg(t, 20.5, 20.8)) * 0.5);
  // HUD read-out
  if (t > 5.8 && t < 18.6) {
    const ha = smooth(seg(t, 5.8, 6.2)) * (1 - smooth(seg(t, 18.0, 18.6)));
    const good = t >= TL.golden;
    const deg = thetaDeg(t);
    const x = 96, y = H - 150;
    const hold = TL.snaps.findIndex(([ts], i) => t >= ts && (i + 1 >= TL.snaps.length ? t < TL.golden - 1.1 : t < TL.snaps[i + 1][0] - 0.6));
    const kick = 1 + 0.12 * snapK(t);
    X.save(); X.translate(x, y); X.scale(kick, kick);
    text(good ? `${deg.toFixed(4)}°` : `${deg.toFixed(1)}°`, 0, 0, 104, FONT.title, good ? C.gold : C.white, ha, 'left', 'alphabetic');
    X.restore();
    const sub1 = good ? '1/φ² OF A TURN' : hold >= 0 ? `${TL.snaps[hold][2]} OF A TURN` : '';
    const sub2 = good ? 'NO GAPS · PERFECT PACKING' : hold >= 0 ? TL.snaps[hold][3] : '';
    text(sub1, x + 4, y + 46, 30, FONT.mono, good ? C.green : C.white, ha * 0.9, 'left', 'alphabetic');
    text(sub2, x + 4, y + 84, 26, FONT.mono, good ? C.green : C.rose, ha * 0.9, 'left', 'alphabetic');
    text('ROTATE · DROP A SEED · REPEAT', x + 4, y - 118, 22, FONT.mono, C.gold, ha * 0.7, 'left', 'alphabetic');
  }
  whipFlash(t);
}

// ════════════════════════════════════════════════════════════════════════════
// B — the name (21 – 32s): a frontal circle, dolly zoom, title slam
// ════════════════════════════════════════════════════════════════════════════
function camB(t) {
  const fov = track(t, [[21.0, 16], [23.4, 82, io3], [25.0, 58], [28.0, 44], [31.7, 30]]);
  const rpx = track(t, [[21.0, 330], [25.0, 285], [28.0, 250], [31.0, 270], [31.7, 300]]);
  const F = (H / 2) / Math.tan((fov * PI) / 360);
  const roll = TAU * io5(seg(t, 24.7, 26.1)) + 0.06 * Math.sin(t * 0.7);
  return orbitCam([0, 0, 0], F / rpx, 0.22 * Math.sin(t * 0.33), 0.1 + 0.06 * Math.sin(t * 0.4), fov, roll);
}
function shotB(t) {
  const cam = rig(camB(t), t);
  const coll = io3(seg(t, ...TL.name.collapse));
  const R = 1 - coll * 0.985;
  // vertigo tunnel behind the circle
  for (let k = 0; k < 18; k++) {
    const z = 1.2 + k * 1.6, s = 2.6;
    const fa = (1 - k / 18) * 0.16 * (1 - coll);
    path3(cam, [[-s * 1.78, -s, z], [s * 1.78, -s, z], [s * 1.78, s, z], [-s * 1.78, s, z]], true);
    thin(k % 2 ? C.gold : C.green, 1, fa);
  }
  X.beginPath();
  for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const q0 = proj(cam, [x * 4.6, y * 2.6, 1.2]), q1 = proj(cam, [x * 4.6, y * 2.6, 28]);
    if (q0 && q1) { X.moveTo(q0.x, q0.y); X.lineTo(q1.x, q1.y); }
  }
  thin(C.white, 1, 0.08 * (1 - coll));
  dust(cam, t, 0.5 * (1 - coll), 1);

  const a0 = PI / 2, sp = seg(t, ...TL.name.split);
  const small = GOLDEN * io3(clamp(sp * 1.5));
  const bigA = (TAU - GOLDEN) * io3(clamp(sp * 1.5 - 0.5));
  const ca = smooth(seg(t, 21.0, 21.25));
  if (sp <= 0) { path3(cam, circlePts([0, 0, 0], R, 0, TAU, 200)); neon(C.white, 2.4, ca, 0.7); }
  else {
    path3(cam, [[0, 0, 0], ...circlePts([0, 0, 0], R, a0, a0 + small, 80)], true);
    X.fillStyle = rgba(C.green, 0.08 * (1 - coll)); X.globalAlpha = GA; X.fill();
    path3(cam, circlePts([0, 0, 0], R, a0, a0 + small, 120)); neon(C.green, 3, 1, 0.7);
    path3(cam, circlePts([0, 0, 0], R, a0 + small, a0 + small + bigA, 160)); neon(C.gold, 2.6, 1, 0.6);
    path3(cam, circlePts([0, 0, 0], R, a0 + small + bigA, a0 + TAU, 160)); neon(C.white, 1.6, 0.5 * (1 - sp), 0.4);
    for (const ang of [a0, a0 + small]) { path3(cam, [[0, 0, 0], [Math.cos(ang) * R, Math.sin(ang) * R, 0]]); neon(C.gold, 1.6, 0.9 * (1 - coll), 0.5); }
    const tip = proj(cam, [Math.cos(a0 + small) * R, Math.sin(a0 + small) * R, 0]);
    if (tip && sp < 1) lensFlare(tip.x, tip.y, 16, 'green', 1, false);
    // labels
    const la = smooth(seg(t, 22.9, 23.3)) * (1 - smooth(seg(t, 30.9, 31.2)));
    const lm = a0 + GOLDEN / 2, lb = a0 + GOLDEN + (TAU - GOLDEN) / 2;
    const q1 = proj(cam, [Math.cos(lm) * 1.42, Math.sin(lm) * 1.42, 0]), q2 = proj(cam, [Math.cos(lb) * 1.42, Math.sin(lb) * 1.42, 0]);
    if (q1) text('137.5°', q1.x, q1.y, 44, FONT.title, C.green, la, 'center', 'middle');
    if (q2) text('222.5°', q2.x, q2.y, 40, FONT.title, C.gold, la * smooth(seg(t, 23.3, 23.6)), 'center', 'middle');
  }
  const qc = proj(cam, [0, 0, 0]);
  if (qc && flash(t, 21.0, 0.4) > 0.01) lensFlare(qc.x, qc.y, 120, 'white', flash(t, 21.0, 0.4));
  // ratio
  const qb = proj(cam, [0, -1.55, 0]);
  const ra = smooth(seg(t, TL.name.ratio, TL.name.ratio + 0.4)) * (1 - smooth(seg(t, 24.7, 25.0)));
  if (qb && ra > 0) text('222.5 ÷ 137.5 = 1.618…  = φ', qb.x, qb.y, 40, FONT.mono, C.white, ra, 'center', 'middle');
  // title — letters fly in from depth with the barrel roll
  const tt = TL.name.title;
  if (t >= tt - 0.4) {
    const str = 'THE GOLDEN ANGLE';
    const up = io3(seg(t, TL.name.formula, TL.name.formula + 0.6));
    const ty = lerp(0, 1.5, up), hgt = lerp(0.36, 0.2, up), em = hgt * 1.38;
    const out = 1 - smooth(seg(t, 30.9, 31.3));
    // lay the letters out with their real widths (measured at 100px)
    X.font = FONT.title(100);
    const adv = [...str].map((ch) => (X.measureText(ch).width / 100) * em * 1.04);
    const total = adv.reduce((a, b) => a + b, 0);
    let x = -total / 2;
    [...str].forEach((ch, i) => {
      const cx = x + adv[i] / 2; x += adv[i];
      if (ch === ' ') return;
      const u = o3(seg(t, tt - 0.35 + i * 0.025, tt + 0.05 + i * 0.025));
      const p = [cx * (1 + (1 - u) * 1.5), ty, lerp(-5.5, -0.4, u)];
      const q = proj(cam, p); if (!q) return;
      const px = em * q.s;
      X.save(); X.translate(q.x, q.y); X.rotate(-cam.roll);
      text(ch, 0, px * 0.36, px, FONT.title, i >= 4 && i <= 9 ? C.gold : C.white, 0.85 * smooth(u * 2) * out, 'center', 'alphabetic');
      X.restore();
    });
    const sf = flash(t, tt, 0.4);
    if (sf > 0.01 && qc) { fullFlash(sf * 0.15, C.gold); lensFlare(qc.x, qc.y, 160, 'gold', sf * 0.8); }
  }
  // formula
  const fa = smooth(seg(t, TL.name.formula + 0.3, TL.name.formula + 0.8)) * (1 - smooth(seg(t, 30.9, 31.2)));
  if (qb && fa > 0) {
    text('360° ÷ φ² = 137.5077…°', qb.x, qb.y, 48, FONT.title, C.white, fa, 'center', 'middle');
    const digits = '1.6180339887498948482';
    const nd = Math.ceil(clamp((t - TL.name.formula - 0.8) / 1.4) * digits.length);
    text(`φ = ${digits.slice(0, nd)}…`, qb.x, qb.y + 56, 28, FONT.mono, C.gold, fa * 0.9, 'center', 'middle');
  }
  if (coll > 0 && qc) glow(qc.x, qc.y, 30 + 60 * coll, 'gold', coll);
  whipFlash(t);
}

// ════════════════════════════════════════════════════════════════════════════
// C — Fibonacci (32 – 44s): spirals in the sunflower, then the endless golden spiral
// ════════════════════════════════════════════════════════════════════════════
function buildSquares() {
  // golden rectangle cut into squares, sides φ^k, removing left, top, right, bottom in turn
  const K = 12;
  let x0 = 0, x1 = PHI ** (K + 1), y0 = 0, y1 = PHI ** K;
  SQUARES = [];
  // 44 levels reach φ^-31; going deeper lets float error wreck the tiny rectangles
  for (let i = 0; i < 44; i++) {
    const dir = i % 4, k = K - i;
    let sq, ctr, a0;
    if (dir === 0) { const s = y1 - y0; sq = [x0, y0, s]; ctr = [x0 + s, y0]; a0 = PI; x0 += s; }
    else if (dir === 1) { const s = x1 - x0; sq = [x0, y1 - s, s]; ctr = [x0, y1 - s]; a0 = PI / 2; y1 -= s; }
    else if (dir === 2) { const s = y1 - y0; sq = [x1 - s, y0, s]; ctr = [x1 - s, y0 + s]; a0 = 0; x1 -= s; }
    else { const s = x1 - x0; sq = [x0, y0, s]; ctr = [x0 + s, y0 + s]; a0 = -PI / 2; y0 += s; }
    SQUARES.push({ x: sq[0], y: sq[1], s: sq[2], ctr, a0, k });
  }
  EYE = [(x0 + x1) / 2, (y0 + y1) / 2];
}
const FIB_C = 0.065;
function camC(t) {
  const [z0, z1] = TL.fib.zoom;
  if (t < TL.fib.sequence[0]) {
    const pitch = track(t, [[32, 1.5], [34.2, 1.5], [35.2, 0.95], [37.2, 0.85], [TL.fib.sequence[0], 1.45]]);
    return orbitCam([0, 0, 0], track(t, [[32, 5.4], [34.2, 5.8], [35.2, 4.6], [37.2, 5.0], [37.4, 5.0]]), 0.25 * (t - 32) + 0.8, pitch, 46);
  }
  // spiral plane: square coords (sx, sy) → world (sx - eye, 0, sy - eye) scaled by S
  const lv = t < z0 ? lerp(4.5, 13.2, io3(seg(t, TL.fib.sequence[0], z0))) : 13.2 - 4.2 * (t - z0) * (0.6 + 0.4 * seg(t, z0, z1));
  const D = 1.15 * PHI ** lv * SQ_S;
  const pitch = t < z0 ? 1.5 : lerp(1.5, 1.05, smooth(seg(t, z0, z0 + 1.5)));
  return orbitCam([0, 0, 0], D, 0.8 + 0.25 * (TL.fib.sequence[0] - 32) + (t - TL.fib.sequence[0]) * 1.1, pitch, 46, 0);
}
const SQ_S = 0.5; // world size of one unit of square-space
function sqW(x, y) { return [(x - EYE[0]) * SQ_S, 0, (y - EYE[1]) * SQ_S]; }
function shotC(t) {
  const cam = rig(camC(t), t);
  const seqT = TL.fib.sequence[0];
  dust(cam, t, 0.4, cam.dist / 5);
  // sunflower with its two families of spirals
  const sfA = 1 - smooth(seg(t, seqT, seqT + 0.8));
  if (sfA > 0) {
    const N = 1000;
    const P = (n) => { const rr = FIB_C * Math.sqrt(n), a = n * GOLDEN; return [rr * Math.cos(a), 0, rr * Math.sin(a)]; };
    for (let n = 0; n < N; n++) seedDot(cam, P(n), 0.024 + 0.012 * Math.sqrt(n / N), ramp(Math.sqrt(n / N) * 0.85), sfA * 0.85);
    const fam = (k, t0, t1, col, nmin, nmax) => {
      for (let j = 0; j < k; j++) {
        const rv = seg(t, t0 + (j / k) * (t1 - t0), t0 + (j / k) * (t1 - t0) + 0.25);
        if (rv <= 0) continue;
        const pts = [];
        for (let n = j; n < nmax; n += k) if (n >= nmin) pts.push(P(n));
        path3(cam, partial(pts, io3(rv))); neon(col, 1.6, sfA * 0.85, 0.5);
      }
    };
    fam(21, ...TL.fib.arms21, C.gold, 60, 700);
    fam(34, ...TL.fib.arms34, C.green, 200, N);
    // counters
    const c21 = Math.min(21, Math.floor(seg(t, ...TL.fib.arms21) * 21 + 0.999));
    const c34 = Math.min(34, Math.floor(seg(t, ...TL.fib.arms34) * 34 + 0.999));
    const ca = sfA * smooth(seg(t, TL.fib.arms21[0], TL.fib.arms21[0] + 0.2));
    if (c21 > 0) text(String(c21), 110, 300, 170, FONT.title, C.gold, ca, 'left', 'alphabetic');
    if (c34 > 0) text(String(c34), W - 110, 300, 170, FONT.title, C.green, ca, 'right', 'alphabetic');
    text('CLOCKWISE', 116, 346, 20, FONT.mono, C.gold, ca * 0.8, 'left', 'alphabetic');
    if (c34 > 0) text('COUNTER-CLOCKWISE', W - 116, 346, 20, FONT.mono, C.green, ca * 0.8, 'right', 'alphabetic');
    const ra = smooth(seg(t, TL.fib.ratio, TL.fib.ratio + 0.3)) * sfA;
    if (ra > 0) {
      text('34 ÷ 21 = 1.619  ≈  φ', CX, 150, 58, FONT.title, C.white, ra, 'center', 'alphabetic');
      text('NEIGHBOUR FIBONACCI NUMBERS · EVERY TIME', CX, 196, 22, FONT.mono, C.gold, ra * 0.85, 'center', 'alphabetic');
    }
  }
  // golden squares + Fibonacci numbers, then dive into the eye forever
  if (t >= seqT - 0.2) {
    const sa = smooth(seg(t, seqT - 0.2, seqT + 0.4)) * (1 - smooth(seg(t, 43.75, 44.0)));
    const lvView = Math.log(cam.dist / SQ_S) / Math.log(PHI);
    for (const s of SQUARES) {
      if (s.k > lvView + 1.5 || s.k < lvView - 9) continue;
      const fib = s.k >= 0 && s.k <= 12 ? FIB[s.k] : 0;
      const appear = s.k <= 12 && t < TL.fib.zoom[0] ? smooth(seg(t, seqT + (s.k / 12) * 1.4, seqT + (s.k / 12) * 1.4 + 0.2)) : 1;
      const a = sa * appear * smooth(clamp((lvView + 1.5 - s.k) / 1.5));
      if (a <= 0.01) continue;
      path3(cam, [sqW(s.x, s.y), sqW(s.x + s.s, s.y), sqW(s.x + s.s, s.y + s.s), sqW(s.x, s.y + s.s)], true);
      thin(C.gold, 1.2, a * 0.55);
      const arc = [];
      for (let i = 0; i <= 24; i++) { const an = s.a0 - (i / 24) * (PI / 2); arc.push(sqW(s.ctr[0] + Math.cos(an) * s.s, s.ctr[1] + Math.sin(an) * s.s)); }
      path3(cam, arc); neon(C.green, 2.2, a, 0.7);
      if (fib) {
        const q = proj(cam, sqW(s.x + s.s / 2, s.y + s.s / 2));
        const px = Math.min(260, s.s * SQ_S * (q ? q.s : 0) * 0.42);
        const la = a * 0.9 * (1 - smooth(seg(t, TL.fib.zoom[0] + 0.8, TL.fib.zoom[0] + 1.8)));
        if (q && px > 8) text(String(fib), q.x, q.y + px * 0.36, px, FONT.title, C.white, la, 'center', 'alphabetic');
      }
    }
    const qe = proj(cam, [0, 0, 0]);
    if (qe) glow(qe.x, qe.y, 50, 'gold', 0.5 * sa);
  }
  whipFlash(t);
}

// ════════════════════════════════════════════════════════════════════════════
// D — nature (44 – 66s): five subjects, whip pans between them
// ════════════════════════════════════════════════════════════════════════════
function camSunflower(lt) {
  // low drone skim across the seeds, then rise into an orbit
  const u = seg(lt, 0, 2.4), v = seg(lt, 2.0, 4.5);
  const skim = [lerp(-2.6, 0.9, io2(u)), lerp(0.62, 0.95, u), lerp(-0.6, 0.2, u)];
  const orb = [Math.sin(1.2 + lt * 0.5) * 4.6, 3.1, -Math.cos(1.2 + lt * 0.5) * 4.6];
  const pos = vlerp(skim, orb, io3(v));
  const tgt = vlerp(add(skim, [1.6, -0.55, 0.35]), [0, -0.2, 0], io3(v));
  return camera(pos, tgt, lerp(80, 46, io3(v)), 0.18 * Math.sin(lt * 1.3) * (1 - v));
}
function camPine(lt) {
  const yaw = 2.3 * lt, y = lerp(-1.9, 2.3, io2(seg(lt, 0, 4.5)));
  return camera([Math.sin(yaw) * 3.1, y, -Math.cos(yaw) * 3.1], [0, y * 0.25, 0], 58, 0.3 * Math.sin(lt * 1.4));
}
function camAloe(lt) {
  const h = lerp(5.2, 1.05, io3(seg(lt, 0, 4.4)));
  return camera([0.001, h, 0], [0, 0, 0], lerp(50, 100, io3(seg(lt, 1.5, 4.4))), PI * io2(seg(lt, 0, 4.5)) + 0.6);
}
let ROM_BUD;
function buildRomanesco() {
  const N1 = 90, N2 = 48, N3 = 28;
  const cone = (n, N) => { const s = (n + 0.5) / N, rp = Math.sqrt(s), a = n * GOLDEN; return [rp * Math.cos(a), 1 - Math.pow(rp, 1.1), rp * Math.sin(a), s]; };
  const basis = (nrm) => { const e1 = norm(cross(nrm, Math.abs(nrm[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0])); return [e1, nrm, cross(e1, nrm)]; };
  const place = (c, B, k, l) => add(c, add(add(mul(B[0], l[0] * k), mul(B[1], l[1] * 1.25 * k)), mul(B[2], l[2] * k)));
  const buds = [];
  for (let i = 0; i < N1; i++) {
    const [x, y, z, s] = cone(i, N1);
    const c = [x * 1.45, -0.6 + y * 2.1, z * 1.45];
    const nrm = norm([x * 0.8, 0.6 + 0.5 * (1 - s), z * 0.8]);
    const k = 0.1 + 0.27 * s;
    const B = basis(nrm), pts = [];
    for (let j = 0; j < N2; j++) { const l = cone(j, N2); pts.push([place(c, B, k, l), l[3]]); }
    buds.push({ c, k, B, pts, s, apex: place(c, B, k, [0, 1, 0]) });
  }
  // the bud the camera dives into: big, facing +x
  let best = 0, score = -1;
  buds.forEach((b, i) => { const sc = b.s * Math.max(0, norm([b.c[0], 0, b.c[2]])[0]); if (sc > score) { score = sc; best = i; } });
  const hb = buds[best], fine = [];
  hb.pts.forEach(([p, s2]) => {
    const nrm = norm(add(sub(p, hb.c), mul(hb.B[1], 0.6)));
    const k = hb.k * (0.08 + 0.22 * s2), B = basis(nrm);
    for (let j = 0; j < N3; j++) fine.push([place(p, B, k, cone(j, N3)), cone(j, N3)[3]]);
  });
  ROM = buds; ROM_BUD = { b: hb, fine };
}
function camRom(lt) {
  const b = ROM_BUD.b;
  const dive = io3(seg(lt, 1.4, 4.5));
  const dir0 = [Math.sin(0.9 - lt * 0.35), 0.45, -Math.cos(0.9 - lt * 0.35)];
  const tgt = vlerp([0, 0.2, 0], b.apex, io3(seg(lt, 1.0, 3.6)));
  const view = norm(add(b.B[1], mul(norm([b.c[0], 0, b.c[2]]), 1.2)));
  const D = Math.exp(lerp(Math.log(4.8), Math.log(b.k * 2.2), dive));
  const dir = norm(vlerp(norm(dir0), view, io3(seg(lt, 0.8, 3.0))));
  return camera(add(tgt, mul(dir, D)), tgt, 50, 0.5 * dive);
}
function camLeaves(lt) {
  const pitch = lerp(1.5, 0.12, io3(seg(lt, 1.8, 4.0)));
  return orbitCam([0, lerp(0, -0.2, seg(lt, 1.8, 4)), 0], lerp(5.6, 4.4, seg(lt, 0, 4)), 0.4 + 0.5 * lt, pitch, 52, 0.0);
}
function drawPine(cam, lt) {
  const g = smooth(seg(lt, 0, 0.6));
  path3(cam, [[0, -1.8, 0], [0, 1.7, 0]]); thin(C.amber, 1.4, 0.5 * g);
  X.beginPath();
  const centers = PINE.map((sc) => [sc.R * Math.cos(sc.a), sc.y, sc.R * Math.sin(sc.a)]);
  PINE.forEach((sc, i) => {
    const C0 = centers[i];
    const n = norm([Math.cos(sc.a), -0.35, Math.sin(sc.a)]), tg = [-Math.sin(sc.a), 0, Math.cos(sc.a)], up = [0, 1, 0];
    const k = 0.42 * (0.45 + sc.R) * g;
    const pts = [add(C0, mul(up, 0.2 * k)), add(add(C0, mul(tg, 0.22 * k)), mul(n, 0.08 * k)), add(add(C0, mul(n, 0.34 * k)), mul(up, -0.12 * k)), add(add(C0, mul(tg, -0.22 * k)), mul(n, 0.08 * k))];
    const qs = pts.map((p) => proj(cam, p));
    if (qs.some((q) => !q)) return;
    X.moveTo(qs[0].x, qs[0].y); qs.slice(1).forEach((q) => X.lineTo(q.x, q.y)); X.closePath();
  });
  neon(C.amber, 1.2, 0.85 * g, 0.5);
  const sp = smooth(seg(lt, 1.4, 2.4));
  for (const [k, col] of [[8, C.gold], [13, C.green]]) {
    for (let j = 0; j < k; j++) {
      const pts = []; for (let i = j; i < PINE.length; i += k) pts.push(mul(centers[i], 1.08));
      path3(cam, partial(pts, sp)); thin(col, 1.4, 0.55 * sp);
    }
  }
}
function drawAloe(cam, lt) {
  ALOE.forEach((lf, i) => {
    const g = o3(clamp((lt * 1.8 - (1 - lf.u) * 0.8)));
    if (g <= 0.01) return;
    const dir = [Math.cos(lf.elev) * Math.cos(lf.a), Math.sin(lf.elev), Math.cos(lf.elev) * Math.sin(lf.a)];
    const perp = [-Math.sin(lf.a), 0, Math.cos(lf.a)];
    const base = [Math.cos(lf.a) * lf.r0, 0, Math.sin(lf.a) * lf.r0], L = lf.L * g, Wd = 0.5 * lf.L;
    const P = (s, w) => add(add(add(base, mul(dir, s * L)), mul(perp, w)), [0, -0.18 * L * s * s * lf.u, 0]);
    // broad fleshy blade: wide near the base, tapering to a point
    const half = (s) => 0.5 * Wd * Math.pow(Math.sin(PI * (0.12 + 0.88 * s)), 0.45) * (1 - s * s * s);
    const pts = [];
    for (let k = 0; k <= 14; k++) { const s = k / 14; pts.push(P(s, half(s))); }
    for (let k = 14; k >= 0; k--) { const s = k / 14; pts.push(P(s, -half(s))); }
    path3(cam, pts, true);
    X.fillStyle = rgba(C.green, 0.018); X.globalAlpha = GA; X.fill();
    neon(mixc(C.green, C.gold, 1 - lf.u), 1.3, 0.3 + 0.5 * lf.u, 0.45);
    path3(cam, [P(0.05, 0), P(0.9, 0)]); thin(C.green, 1, 0.25 * lf.u);
    const q = proj(cam, P(1, 0)); if (q) glow(q.x, q.y, 5, 'gold', 0.9);
  });
  const sp = smooth(seg(lt, 2.2, 3.2));
  if (sp > 0) for (let j = 0; j < 5; j++) {
    const pts = []; for (let i = j; i < ALOE.length; i += 5) { const lf = ALOE[i]; pts.push([Math.cos(lf.a) * (lf.r0 + lf.L * 0.5 * Math.cos(lf.elev)), lf.L * 0.5 * Math.sin(lf.elev), Math.sin(lf.a) * (lf.r0 + lf.L * 0.5 * Math.cos(lf.elev))]); }
    path3(cam, partial(pts, sp)); neon(C.gold, 1.6, 0.6 * sp, 0.5);
  }
}
function drawRom(cam, lt) {
  const g = smooth(seg(lt, 0, 0.5));
  const near = smooth(seg(lt, 2.6, 3.8));
  ROM.forEach((b) => {
    const isHero = b === ROM_BUD.b;
    b.pts.forEach(([p, s2]) => seedDot(cam, p, 0.012 + 0.03 * b.k * (1 - s2 * 0.5), ramp(0.05 + 0.25 * s2), g * (isHero ? 1 - near * 0.7 : 0.85), 0.02));
    const q = proj(cam, b.apex); if (q) glow(q.x, q.y, 4, 'gold', 0.6 * g);
  });
  if (near > 0) ROM_BUD.fine.forEach(([p, s3]) => seedDot(cam, p, 0.004 + 0.006 * (1 - s3), ramp(0.1 + 0.3 * s3), near, 0.01));
}
function drawLeaves(cam, lt) {
  const g = smooth(seg(lt, 0, 0.5));
  path3(cam, [[0, -2.3, 0], [0, 1.95, 0]]); neon(C.green, 2, g, 0.5);
  const lit = smooth(seg(lt, 0.9, 1.9));
  LEAVES.forEach((lf, i) => {
    const dir = [Math.cos(lf.a), 0, Math.sin(lf.a)], perp = [-Math.sin(lf.a), 0, Math.cos(lf.a)];
    const base = [0, lf.y, 0], c = add(base, mul(dir, 0.14 + lf.L * 0.55));
    const pts = [];
    for (let k = 0; k <= 40; k++) {
      const an = (k / 40) * TAU, x = Math.cos(an) * lf.L * 0.5, w = Math.sin(an) * lf.L * 0.26 * (1 - 0.3 * Math.cos(an));
      pts.push(add(add(add(c, mul(dir, x)), mul(perp, w)), [0, -0.12 * ((x / lf.L) * 2 + 1) ** 2 * 0.25, 0]));
    }
    path3(cam, [base, add(base, mul(dir, 0.14 + lf.L * 0.05))]); thin(C.green, 1.4, g);
    path3(cam, pts, true);
    X.fillStyle = rgba(mixc(C.green, C.gold, lit), (0.05 + 0.08 * lit) * g); X.globalAlpha = GA; X.fill();
    neon(mixc(C.green, C.gold, lit * 0.6), 1.3, g, 0.5);
    // sunlight falling on this leaf
    const ra = smooth(seg(lt, 0.4 + i * 0.04, 1.0 + i * 0.04));
    if (ra > 0) {
      const hit = add(c, [0, -0.02, 0]);
      path3(cam, [add(hit, [0, 4.2 * (1 - ra) + 0.01 + 3.2, 0]), add(hit, [0, 3.2 * (1 - ra) + 0.01, 0])]);
      neon(C.gold, 1.1, 0.35 * g, 0.3);
      const q = proj(cam, hit); if (q) glow(q.x, q.y, 22 * lit, 'gold', 0.5 * lit * g);
    }
  });
}
const NATURE = [
  { cam: camSunflower, draw: (cam, lt, t) => { drawSunflower(cam, t, { aperture: 0.03, spin: lt * 0.08 }); path3(cam, [[0, -0.1, 0], [0, -6, 0]]); neon(C.green, 2.2, 0.8, 0.4); } },
  { cam: camPine, draw: (cam, lt) => drawPine(cam, lt) },
  { cam: camAloe, draw: (cam, lt) => drawAloe(cam, lt) },
  { cam: camRom, draw: (cam, lt) => drawRom(cam, lt) },
  { cam: camLeaves, draw: (cam, lt) => drawLeaves(cam, lt) },
];
function shotD(t) {
  const items = TL.nature;
  let i = items.length - 1;
  while (i > 0 && t < items[i][0]) i--;
  const t0 = items[i][0], t1 = i + 1 < items.length ? items[i + 1][0] : TL.uses[0][0];
  const lt = t - t0;
  const cam = rig(NATURE[i].cam(lt), t);
  dust(cam, t, 0.5, cam.dist / 5);
  NATURE[i].draw(cam, lt, t);
  const [s0, s1, word] = TL.slams[0];
  slam(t, s0, s1, word, 150);
  hudTag(t, i === 0 ? s1 : t0, t1, items[i][1], items[i][2], i + 1, items.length);
  whipFlash(t);
}
function whipFlash(t) {
  const w = TL.whips.find((x) => Math.abs(t - x) < 0.3);
  if (w === undefined) return;
  const k = bump(t, w, 0.035);
  fullFlash(0.1 * k);
  sprite(SPR.hot, CX, CY, 1400 * k, 26 * k, 0.5 * k);
}

// ════════════════════════════════════════════════════════════════════════════
// E — what we built with it (66 – 80s)
// ════════════════════════════════════════════════════════════════════════════
const SUN_DIR = norm([-0.5, 1, 0.35]), RECEIVER = [0, 2.6, 0];
function camSolar(lt) {
  const pitch = track(lt, [[0, 1.5], [2.3, 1.45], [4.2, 0.06, io3], [5, 0.1]]);
  const D = track(lt, [[0, 10.5], [2.3, 8.5], [4.2, 3.6, io3], [5, 3.3]]);
  const ty = track(lt, [[0, 0], [2.3, 0], [4.2, 1.7, io3]]);
  const fov = track(lt, [[0, 44], [2.3, 46], [4.2, 84, io3]]);
  return orbitCam([0, ty, 0], D, 1.0 * lt + 0.3, pitch, fov, 0.25 * smooth(seg(lt, 2.4, 4.2)));
}
function drawSolar(cam, lt) {
  const g = smooth(seg(lt, 0, 0.4));
  // ground rings
  for (let k = 1; k <= 6; k++) { path3(cam, circlePts([0, 0, 0], k * 0.9, 0, TAU, 120, 'xz')); thin(C.white, 1, 0.05 * g); }
  // tower
  X.beginPath();
  for (const [x, z] of [[-0.12, -0.12], [0.12, -0.12], [0.12, 0.12], [-0.12, 0.12]]) {
    const a = proj(cam, [x, 0, z]), b = proj(cam, [x * 0.7, 2.45, z * 0.7]);
    if (a && b) { X.moveTo(a.x, a.y); X.lineTo(b.x, b.y); }
  }
  thin(C.white, 1.4, 0.7 * g);
  // mirrors
  X.beginPath();
  const on = (m) => smooth(seg(lt, 0.3 + m.rr * 0.25, 0.6 + m.rr * 0.25));
  MIRRORS.forEach((m) => {
    const nrm = norm(add(SUN_DIR, norm(sub(RECEIVER, m.p))));
    const e1 = norm(cross(nrm, [0, 1, 0])), e2 = cross(nrm, e1), h = 0.075;
    const qs = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([a, b]) => proj(cam, add(m.p, add(mul(e1, a * h), mul(e2, b * h)))));
    if (qs.some((q) => !q)) return;
    X.moveTo(qs[0].x, qs[0].y); qs.slice(1).forEach((q) => X.lineTo(q.x, q.y)); X.closePath();
  });
  thin(C.cyan, 1, 0.75 * g);
  // reflected beams to the receiver
  X.beginPath();
  MIRRORS.forEach((m, i) => {
    if (i % 2) return;
    const k = on(m); if (k <= 0) return;
    const a = proj(cam, m.p), b = proj(cam, vlerp(m.p, RECEIVER, k));
    if (a && b) { X.moveTo(a.x, a.y); X.lineTo(b.x, b.y); }
  });
  thin(C.gold, 1, 0.1 * g);
  X.beginPath();
  MIRRORS.forEach((m, i) => {
    if (i % 9) return;
    const a = proj(cam, add(m.p, mul(SUN_DIR, 5))), b = proj(cam, m.p);
    if (a && b) { X.moveTo(a.x, a.y); X.lineTo(b.x, b.y); }
  });
  thin(C.white, 1, 0.05 * g);
  const q = proj(cam, RECEIVER);
  if (q) lensFlare(q.x, q.y, 20 + 50 * smooth(seg(lt, 0.5, 2.5)), 'gold', g);
}
function camSphere(lt) {
  const D = track(lt, [[0, 4.6], [2.2, 3.6], [3.4, 1.75, io3], [4.5, 2.2]]);
  return orbitCam([0, 0, 0], D, 1.5 * lt, 0.55 * Math.sin(lt * 0.9), lerp(46, 70, seg(lt, 2, 3.5)), 0.45 * Math.sin(lt * 0.8));
}
function drawSphere(cam, lt) {
  const g = smooth(seg(lt, 0, 0.4));
  const pos = SPHERE.map((s, i) => {
    const u = io3(seg(lt, 0.6 + 0.6 * (i / SPHERE.length), 1.5 + 0.6 * (i / SPHERE.length)));
    return norm(vlerp(s.R, s.L, u));
  });
  const done = smooth(seg(lt, 2.0, 2.6));
  // silhouette ring + faint latitude rings
  for (let k = -3; k <= 3; k++) { const y = k / 4, rr = Math.sqrt(1 - y * y); path3(cam, circlePts([0, y, 0], rr, 0, TAU, 80, 'xz')); thin(C.white, 1, 0.05 * g); }
  if (done > 0) {
    X.beginPath();
    for (const off of [21, 34]) for (let i = 0; i + off < pos.length; i++) {
      const a = pos[i], b = pos[i + off];
      if (Math.hypot(...sub(a, b)) > 0.28) continue;
      if (dot3(norm(sub(cam.pos, a)), a) < -0.1) continue;
      const qa = proj(cam, a), qb = proj(cam, b);
      if (qa && qb) { X.moveTo(qa.x, qa.y); X.lineTo(qb.x, qb.y); }
    }
    thin(C.green, 1, 0.45 * done * g);
  }
  pos.forEach((p, i) => {
    const front = dot3(norm(sub(cam.pos, p)), p) > -0.1;
    const u = seg(lt, 0.6 + 0.6 * (i / SPHERE.length), 1.5 + 0.6 * (i / SPHERE.length));
    seedDot(cam, p, 0.022, u < 0.5 ? 'rose' : ramp(0.1 + 0.3 * (i / SPHERE.length)), g * (front ? 1 : 0.25), 0.015);
  });
}
function camArray(lt) {
  if (lt < 2.0) return orbitCam([0, 0, 1.2], 6.2, lerp(1.15, 0.75, lt / 2), 0.28, 48, 0);
  const u = io3(seg(lt, 2.0, 4.5));
  const c0 = orbitCam([0, 0, 1.2], 6.2, 0.75, 0.28, 48);
  const pos = vlerp(c0.pos, [0.25, 0.15, 7.5 - 6.3 * u], io3(seg(lt, 2.0, 2.8)));
  return camera(pos, vlerp([0, 0, 1.2], [0, 0, 0], u), lerp(48, 92, u), 1.4 * u);
}
function drawArray(cam, lt) {
  const g = smooth(seg(lt, 0, 0.4));
  path3(cam, circlePts([0, 0, 0], 1.62, 0, TAU, 120)); neon(C.white, 1.4, 0.5 * g, 0.3);
  ARRAY.forEach((e) => {
    const ph = 0.55 + 0.45 * Math.sin(lt * 14 - e.rr * 9);
    seedDot(cam, e.p, 0.035, ramp(0.2 + 0.4 * e.rr / 1.6), g * ph, 0.01);
    const q = proj(cam, e.p); if (q) sprite(RING, q.x, q.y, 0.06 * q.s, 0.06 * q.s, 0.35 * g);
  });
  // focused beam: wavefronts converge to a focus, then travel on
  for (let k = 0; k < 14; k++) {
    const z = (lt * 2.4 + k * 0.5) % 7;
    const rr = 1.55 * Math.abs(1 - z / 3.6) * 0.92 + 0.08;
    const a = g * (1 - z / 7) * smooth(seg(lt, 0.3, 0.9));
    path3(cam, circlePts([0, 0, z], rr, 0, TAU, 80)); neon(k % 2 ? C.cyan : C.gold, 1.6, a * 0.8, 0.5);
  }
  const qf = proj(cam, [0, 0, 3.6]); if (qf) lensFlare(qf.x, qf.y, 24, 'cyan', g * smooth(seg(lt, 0.6, 1.2)));
  path3(cam, [[0, 0, 0], [0, 0, 7]]); thin(C.cyan, 1, 0.2 * g);
}
const USES = [
  { cam: camSolar, draw: drawSolar },
  { cam: camSphere, draw: drawSphere },
  { cam: camArray, draw: drawArray },
];
function shotE(t) {
  const items = TL.uses;
  let i = items.length - 1;
  while (i > 0 && t < items[i][0]) i--;
  const t0 = items[i][0], t1 = i + 1 < items.length ? items[i + 1][0] : TL.montage[0];
  const lt = t - t0;
  const cam = rig(USES[i].cam(lt), t);
  dust(cam, t, 0.45, cam.dist / 5);
  USES[i].draw(cam, lt);
  const [s0, s1, word] = TL.slams[1];
  slam(t, s0, s1, word, 150);
  hudTag(t, i === 0 ? s1 : t0, t1, items[i][1], items[i][2], i + 1, items.length);
  whipFlash(t);
}

// ════════════════════════════════════════════════════════════════════════════
// F — finale (80 – 90s): strobe flashback, rebirth, end card
// ════════════════════════════════════════════════════════════════════════════
const REBIRTH_N = 2000;
function rebirthN(t) {
  const lt = t - TL.rebirth[0];
  return lt < 1.5 ? Math.floor(lt / 0.25) + 1 : 6 + (REBIRTH_N - 6) * Math.pow(seg(t, TL.rebirth[0] + 1.5, TL.end - 0.1), 2.4);
}
function camF(t) {
  const u = seg(t, TL.rebirth[0], TL.end);
  const fov = lerp(26, 96, io3(u)), rpx = lerp(1600, 420, io2(u));
  const F = (H / 2) / Math.tan((fov * PI) / 360);
  const endSpin = 0.05 * Math.max(0, t - TL.end);
  const pitch = track(t, [[TL.rebirth[0], 1.55], [TL.end - 0.5, 1.05], [TL.end, 1.35], [90, 1.42]]);
  return orbitCam([0, 0, 0], ((F * 2.3) / rpx) * (t > TL.end ? 1 + 0.02 * (t - TL.end) : 1), 0.3, pitch, t > TL.end ? 50 : fov, TAU * io5(u) + endSpin);
}
function shotF(t) {
  const [m0, m1] = TL.montage;
  if (t < m1) {
    const k = Math.min(TL.montageFrom.length - 1, Math.floor((t - m0) / ((m1 - m0) / TL.montageFrom.length)));
    const cut = m0 + (k * (m1 - m0)) / TL.montageFrom.length;
    drawFilm(TL.montageFrom[k] + (t - cut) * 0.7);
    fullFlash(0.45 * flash(t, cut, 0.04));
    return;
  }
  const cam = rig(camF(t), t);
  const N = rebirthN(t);
  const endA = t > TL.end ? 0.42 + 0.58 * flash(t, TL.end, 0.6) : 1;
  for (let n = 0; n < Math.min(N, REBIRTH_N); n++) {
    const m = N - n, rr = 0.046 * Math.sqrt(m), a = n * GOLDEN;
    const born = smooth(clamp(m * 0.4));
    seedDot(cam, [rr * Math.cos(a), 0, rr * Math.sin(a)], 0.03 + 0.016 * Math.sqrt(rr / 2), ramp(rr / 2.1 * 0.9), born * endA);
  }
  // the arm that turns 137.5° before every seed
  const lt = t - TL.rebirth[0];
  if (lt < 2.2) {
    const a = (Math.floor(N) - 1) * GOLDEN, prev = (Math.floor(N) - 2) * GOLDEN;
    const aa = 1 - smooth(seg(lt, 1.6, 2.2));
    path3(cam, [[0, 0, 0], [Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5]]); neon(C.gold, 2, aa, 0.7);
    if (N >= 2) { path3(cam, circlePts([0, 0, 0], 0.32, prev, prev + GOLDEN, 30, 'xz')); neon(C.green, 1.6, aa, 0.6); }
    const q = proj(cam, [Math.cos(prev + GOLDEN / 2) * 0.42, 0, Math.sin(prev + GOLDEN / 2) * 0.42]);
    if (q && N >= 2) text('137.5°', q.x, q.y, 30, FONT.mono, C.green, aa, 'center', 'middle');
  }
  // light burst before the end hit
  const rb = smooth(seg(t, TL.end - 0.6, TL.end)) * (1 - smooth(seg(t, TL.end, TL.end + 0.5)));
  if (rb > 0) for (let k = 0; k < 48; k++) {
    const an = k * GOLDEN; X.beginPath(); X.moveTo(CX + Math.cos(an) * 80, CY + Math.sin(an) * 80); X.lineTo(CX + Math.cos(an) * 1300, CY + Math.sin(an) * 1300);
    thin(k % 2 ? C.gold : C.green, 1.5, rb * 0.5);
  }
  if (t >= TL.end) {
    const ef = flash(t, TL.end, 0.5);
    fullFlash(ef * 0.5, C.gold);
    lensFlare(CX, CY - 40, 220 * ef + 1, 'gold', ef);
    const s = lerp(1.6, 1, o3(seg(t, TL.end, TL.end + 0.35)));
    X.save(); X.translate(CX, CY - 30); X.scale(s, s);
    text('137.5°', 0, 90, 250, FONT.title, C.white, smooth(seg(t, TL.end, TL.end + 0.15)), 'center', 'alphabetic');
    X.restore();
    const str = 'THE GOLDEN ANGLE', n = Math.ceil(clamp((t - TL.end - 0.5) / 0.7) * str.length);
    X.save(); X.letterSpacing = '18px';
    text(str.slice(0, n), CX + 9, CY + 140, 44, FONT.light, C.gold, smooth(seg(t, TL.end + 0.4, TL.end + 0.7)), 'center', 'alphabetic');
    X.restore();
  }
}

// ─── master timeline ────────────────────────────────────────────────────────
function drawFilm(t) {
  if (t < TL.whips[1]) shotA(t);
  else if (t < TL.whips[2]) shotB(t);
  else if (t < TL.whips[3]) shotC(t);
  else if (t < TL.uses[0][0]) shotD(t);
  else if (t < TL.montage[0]) shotE(t);
  else shotF(t);
}
function exposure(t) {
  return (1 + 0.25 * impactK(t, 0.2)) * (1 - smooth(seg(t, ...TL.fade)));
}
function background(t) {
  return smooth(seg(t, 0.3, 3)) * (1 - smooth(seg(t, ...TL.fade)));
}
function aberration(t) {
  let k = impactK(t, 0.25);
  if (whipState(t)) k += 0.8;
  if (t >= TL.montage[0] && t < TL.montage[1]) k += 0.6;
  return Math.min(1.5, k);
}
// motion blur only where something moves fast: the whip pans
function blurSubs(t) {
  return TL.whips.some((w) => Math.abs(t - w) < 0.26) ? 10 : 1;
}
